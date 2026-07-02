// Mirrors coopscore-data-model-v1.md 1:1. Do not diverge without updating that doc.
//
// Prerequisite (run once against the target database before the first migration):
//   CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() on Postgres < 15
//   CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email columns

import type {
  AccountStatus,
  CoopType,
  Frequency,
  LoanStatus,
  MemberStatus,
  RiskTier,
  TrendDirection,
} from "@coopscore/shared";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// citext isn't a first-class drizzle-orm column type — defined once here and reused.
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

// --- Enums -------------------------------------------------------------
// Array literals are typed against packages/shared's unions via `satisfies`,
// so the DB enum and the frontend-facing type can't silently drift apart.

export const coopTypeEnum = pgEnum("coop_type", [
  "cooperative",
  "sacco",
  "church",
  "trade_association",
  "other",
] satisfies readonly CoopType[] as [CoopType, ...CoopType[]]);

export const frequencyEnum = pgEnum("frequency", [
  "weekly",
  "biweekly",
  "monthly",
] satisfies readonly Frequency[] as [Frequency, ...Frequency[]]);

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "inactive",
  "suspended",
] satisfies readonly MemberStatus[] as [MemberStatus, ...MemberStatus[]]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
] satisfies readonly AccountStatus[] as [AccountStatus, ...AccountStatus[]]);

export const trendEnum = pgEnum("trend", [
  "improving",
  "stable",
  "declining",
] satisfies readonly TrendDirection[] as [TrendDirection, ...TrendDirection[]]);

export const riskTierEnum = pgEnum("risk_tier", [
  "low",
  "medium",
  "high",
] satisfies readonly RiskTier[] as [RiskTier, ...RiskTier[]]);

export const loanStatusEnum = pgEnum("loan_status", [
  "pending",
  "approved",
  "rejected",
] satisfies readonly LoanStatus[] as [LoanStatus, ...LoanStatus[]]);

// --- 1. cooperatives -----------------------------------------------------
// Also holds manager auth — single manager per cooperative for MVP (locked decision).

export const cooperatives = pgTable(
  "cooperatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: coopTypeEnum("type").notNull(),
    contactEmail: citext("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cooperatives_contact_email_idx").on(table.contactEmail)],
);

// --- 2. members ------------------------------------------------------------

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperatives.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: citext("email"),
    expectedContributionAmount: numeric("expected_contribution_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    contributionFrequency: frequencyEnum("contribution_frequency").notNull(),
    status: memberStatusEnum("status").notNull().default("active"),
    joinedAt: date("joined_at")
      .notNull()
      .default(sql`CURRENT_DATE`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("members_cooperative_id_idx").on(table.cooperativeId),
    index("members_cooperative_id_status_idx").on(table.cooperativeId, table.status),
    check("members_expected_contribution_positive", sql`${table.expectedContributionAmount} > 0`),
  ],
);

// --- 3. virtual_accounts ----------------------------------------------------
// One-to-one with members; own lifecycle (provisioned -> suspended) independent of member lifecycle.

export const virtualAccounts = pgTable(
  "virtual_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .unique()
      .references(() => members.id, { onDelete: "restrict" }),
    nombaAccountRef: text("nomba_account_ref").notNull(),
    accountNumber: text("account_number").notNull(),
    bankName: text("bank_name").notNull(),
    status: accountStatusEnum("status").notNull().default("active"),
    providerResponse: jsonb("provider_response"),
    provisionedAt: timestamp("provisioned_at", { withTimezone: true }).notNull().defaultNow(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("virtual_accounts_nomba_account_ref_idx").on(table.nombaAccountRef),
    uniqueIndex("virtual_accounts_account_number_idx").on(table.accountNumber),
  ],
);

// --- 4. contributions --------------------------------------------------------
// Append-only ledger of inbound transfers — the reconciliation output.

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    virtualAccountId: uuid("virtual_account_id")
      .notNull()
      .references(() => virtualAccounts.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    nombaTransactionRef: text("nomba_transaction_ref").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    contributedAt: timestamp("contributed_at", { withTimezone: true }).notNull(),
    isLate: boolean("is_late").notNull().default(false),
    rawWebhookPayload: jsonb("raw_webhook_payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The actual idempotency mechanism — webhook inserts use ON CONFLICT (nomba_transaction_ref) DO NOTHING.
    uniqueIndex("contributions_nomba_transaction_ref_idx").on(table.nombaTransactionRef),
    // Scoring engine sums contributions per period — this is how installment/partial payments combine.
    index("contributions_member_id_period_start_idx").on(table.memberId, table.periodStart),
    check("contributions_amount_positive", sql`${table.amount} > 0`),
  ],
);

// --- 5. score_snapshots --------------------------------------------------------
// Append-only, never updated — this is what makes trend computable. No updated_at by design.

export const scoreSnapshots = pgTable(
  "score_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    consistencyPct: numeric("consistency_pct", { precision: 5, scale: 2 }).notNull(),
    monthsActive: integer("months_active").notNull(),
    missedPaymentsCount: integer("missed_payments_count").notNull(),
    averageContribution: numeric("average_contribution", { precision: 14, scale: 2 }).notNull(),
    trend: trendEnum("trend").notNull(),
    riskTier: riskTierEnum("risk_tier").notNull(),
    recommendedLoanAmount: numeric("recommended_loan_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    inputsSnapshot: jsonb("inputs_snapshot").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("score_snapshots_member_id_computed_at_idx").on(table.memberId, table.computedAt),
    check("score_snapshots_consistency_pct_range", sql`${table.consistencyPct} BETWEEN 0 AND 100`),
    check("score_snapshots_months_active_nonnegative", sql`${table.monthsActive} >= 0`),
    check("score_snapshots_missed_payments_nonnegative", sql`${table.missedPaymentsCount} >= 0`),
  ],
);

// --- 6. recommendations --------------------------------------------------------

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    scoreSnapshotId: uuid("score_snapshot_id")
      .notNull()
      .references(() => scoreSnapshots.id, { onDelete: "restrict" }),
    // Denormalized copy from the snapshot at generation time, so this row stays
    // meaningful even after a newer snapshot exists.
    riskTier: riskTierEnum("risk_tier").notNull(),
    recommendedAmount: numeric("recommended_amount", { precision: 14, scale: 2 }).notNull(),
    llmExplanation: text("llm_explanation"),
    llmModelUsed: text("llm_model_used"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recommendations_member_id_generated_at_idx").on(table.memberId, table.generatedAt),
  ],
);

// --- 7. loans --------------------------------------------------------
// `approved` is the terminal state for v1 — repayment tracking is out of scope.

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    recommendationId: uuid("recommendation_id").references(() => recommendations.id, {
      onDelete: "restrict",
    }),
    amountRequested: numeric("amount_requested", { precision: 14, scale: 2 }).notNull(),
    amountApproved: numeric("amount_approved", { precision: 14, scale: 2 }),
    riskTierAtDecision: riskTierEnum("risk_tier_at_decision").notNull(),
    status: loanStatusEnum("status").notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("loans_member_id_idx").on(table.memberId),
    index("loans_status_idx").on(table.status),
  ],
);

// --- 8. audit_logs --------------------------------------------------------
// Polymorphic by design (entity_type + entity_id) — no FK to a specific table.

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperatives.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_type_entity_id_idx").on(table.entityType, table.entityId),
    index("audit_logs_cooperative_id_created_at_idx").on(table.cooperativeId, table.createdAt),
  ],
);

// --- Relations --------------------------------------------------------
// Enables db.query.<table>.findMany({ with: {...} }) instead of hand-written joins.

export const cooperativesRelations = relations(cooperatives, ({ many }) => ({
  members: many(members),
  auditLogs: many(auditLogs),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [members.cooperativeId],
    references: [cooperatives.id],
  }),
  virtualAccount: one(virtualAccounts),
  contributions: many(contributions),
  scoreSnapshots: many(scoreSnapshots),
  recommendations: many(recommendations),
  loans: many(loans),
}));

export const virtualAccountsRelations = relations(virtualAccounts, ({ one, many }) => ({
  member: one(members, {
    fields: [virtualAccounts.memberId],
    references: [members.id],
  }),
  contributions: many(contributions),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
  member: one(members, {
    fields: [contributions.memberId],
    references: [members.id],
  }),
  virtualAccount: one(virtualAccounts, {
    fields: [contributions.virtualAccountId],
    references: [virtualAccounts.id],
  }),
}));

export const scoreSnapshotsRelations = relations(scoreSnapshots, ({ one, many }) => ({
  member: one(members, {
    fields: [scoreSnapshots.memberId],
    references: [members.id],
  }),
  recommendations: many(recommendations),
}));

export const recommendationsRelations = relations(recommendations, ({ one, many }) => ({
  member: one(members, {
    fields: [recommendations.memberId],
    references: [members.id],
  }),
  scoreSnapshot: one(scoreSnapshots, {
    fields: [recommendations.scoreSnapshotId],
    references: [scoreSnapshots.id],
  }),
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  member: one(members, {
    fields: [loans.memberId],
    references: [members.id],
  }),
  recommendation: one(recommendations, {
    fields: [loans.recommendationId],
    references: [recommendations.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [auditLogs.cooperativeId],
    references: [cooperatives.id],
  }),
}));
