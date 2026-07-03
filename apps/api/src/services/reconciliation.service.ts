import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contributions, members, virtualAccounts } from "../db/schema.js";
import { computeContributionPeriod } from "../lib/periods.js";
import { ApiException } from "../lib/api-exception.js";
import { generateSnapshot } from "./snapshot.service.js";

export type ReconciliationResult = "processed" | "duplicate" | "unmatched_account";

type ReconciliationMember = {
  id: string;
  joinedAt: string;
  contributionFrequency: (typeof members.$inferSelect)["contributionFrequency"];
};

// The one place a contribution row gets inserted — both the real Nomba
// webhook and the simulate-contribution demo fallback funnel through this,
// so period assignment/lateness/dedup/snapshot-trigger can never drift
// between the two paths. See coopscore-architecture-v1.md §4.2.
async function recordContribution(params: {
  member: ReconciliationMember;
  virtualAccountId: string;
  amount: number;
  nombaTransactionRef: string;
  contributedAt: Date;
  rawPayload: unknown;
}): Promise<Exclude<ReconciliationResult, "unmatched_account">> {
  const { periodStart, periodEnd, isLate } = computeContributionPeriod(
    params.member.joinedAt,
    params.contributedAt,
    params.member.contributionFrequency,
  );

  const inserted = await db
    .insert(contributions)
    .values({
      memberId: params.member.id,
      virtualAccountId: params.virtualAccountId,
      amount: String(params.amount),
      nombaTransactionRef: params.nombaTransactionRef,
      periodStart,
      periodEnd,
      contributedAt: params.contributedAt,
      isLate,
      rawWebhookPayload: params.rawPayload,
    })
    // The actual idempotency mechanism — see coopscore-data-model-v1.md §4.
    .onConflictDoNothing({ target: contributions.nombaTransactionRef })
    .returning({ id: contributions.id });

  if (inserted.length === 0) {
    return "duplicate";
  }

  await generateSnapshot(params.member.id);
  return "processed";
}

// Best-effort shape — Nomba's actual webhook payload hasn't been verified
// against sandbox docs yet (same caveat as nomba.service.ts's auth header).
// Adjust once real webhook deliveries are observed.
interface NombaWebhookPayload {
  data?: {
    accountNumber?: string;
    amount?: number;
    transactionRef?: string;
    transactionDate?: string;
  };
}

export async function reconcileWebhookPayload(payload: unknown): Promise<ReconciliationResult> {
  const body = payload as NombaWebhookPayload;
  const accountNumber = body.data?.accountNumber;
  const amount = body.data?.amount;
  const transactionRef = body.data?.transactionRef;
  const transactionDate = body.data?.transactionDate;

  if (!accountNumber || !amount || !transactionRef) {
    throw new ApiException("VALIDATION_ERROR", "Unrecognized webhook payload shape", 400);
  }

  const match = await db
    .select({
      virtualAccountId: virtualAccounts.id,
      memberId: members.id,
      joinedAt: members.joinedAt,
      contributionFrequency: members.contributionFrequency,
    })
    .from(virtualAccounts)
    .innerJoin(members, eq(members.id, virtualAccounts.memberId))
    .where(and(eq(virtualAccounts.accountNumber, accountNumber), eq(virtualAccounts.status, "active")))
    .limit(1);

  if (match.length === 0) {
    // Not our problem to retry-fix — ack the webhook regardless (see
    // webhooks.routes.ts) and let this show up in server logs for follow-up.
    return "unmatched_account";
  }

  const [{ virtualAccountId, memberId, joinedAt, contributionFrequency }] = match;

  return recordContribution({
    member: { id: memberId, joinedAt, contributionFrequency },
    virtualAccountId,
    amount,
    nombaTransactionRef: transactionRef,
    contributedAt: transactionDate ? new Date(transactionDate) : new Date(),
    rawPayload: payload,
  });
}

// Demo/dev fallback per coopscore-handoff-v4.md's risk mitigation — lets a
// manager (or test script) inject a contribution without a live Nomba
// webhook. Goes through the exact same recordContribution path above.
export async function recordSimulatedContribution(
  cooperativeId: string,
  memberId: string,
  amount: number,
  contributedAt: Date,
): Promise<Exclude<ReconciliationResult, "unmatched_account">> {
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, memberId), eq(members.cooperativeId, cooperativeId)),
  });
  if (!member) {
    throw new ApiException("NOT_FOUND", "Member not found", 404);
  }

  const virtualAccount = await db.query.virtualAccounts.findFirst({
    where: eq(virtualAccounts.memberId, memberId),
  });
  if (!virtualAccount) {
    throw new ApiException(
      "NO_VIRTUAL_ACCOUNT",
      "This member has no provisioned virtual account to simulate a contribution into",
      409,
    );
  }

  return recordContribution({
    member: {
      id: member.id,
      joinedAt: member.joinedAt,
      contributionFrequency: member.contributionFrequency,
    },
    virtualAccountId: virtualAccount.id,
    amount,
    nombaTransactionRef: `sim_${randomUUID()}`,
    contributedAt,
    rawPayload: { simulated: true },
  });
}
