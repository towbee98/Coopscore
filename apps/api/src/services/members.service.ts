import { and, count, desc, eq, ilike } from "drizzle-orm";
import type {
  AccountSlipDTO,
  ContributionDTO,
  CreateMemberRequest,
  MemberDetail,
  MemberStatus,
  MemberSummary,
  PaginatedListResponse,
  RiskTier,
  ScoreSnapshotDTO,
  UpdateMemberRequest,
} from "@coopscore/shared";
import { db } from "../db/client.js";
import {
  contributions,
  cooperatives,
  members,
  scoreSnapshots,
  virtualAccounts,
} from "../db/schema.js";
import { ApiException } from "../lib/api-exception.js";
import { logAction } from "./audit.service.js";
import { provisionAccount } from "./nomba.service.js";

interface ListMembersFilters {
  status?: MemberStatus;
  riskTier?: RiskTier;
  search?: string;
}

// Cross-tenant lookups return 404, not 403 — see coopscore-api-design-v1.md §1.
async function getMemberOrThrow(cooperativeId: string, memberId: string) {
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, memberId), eq(members.cooperativeId, cooperativeId)),
  });
  if (!member) {
    throw new ApiException("NOT_FOUND", "Member not found", 404);
  }
  return member;
}

export async function listMembers(
  cooperativeId: string,
  filters: ListMembersFilters,
): Promise<MemberSummary[]> {
  const latestScores = db
    .selectDistinctOn([scoreSnapshots.memberId], {
      memberId: scoreSnapshots.memberId,
      riskTier: scoreSnapshots.riskTier,
      monthsActive: scoreSnapshots.monthsActive,
    })
    .from(scoreSnapshots)
    .orderBy(scoreSnapshots.memberId, desc(scoreSnapshots.computedAt))
    .as("latest_scores");

  const conditions = [eq(members.cooperativeId, cooperativeId)];
  if (filters.status) conditions.push(eq(members.status, filters.status));
  if (filters.search) conditions.push(ilike(members.fullName, `%${filters.search}%`));
  if (filters.riskTier) conditions.push(eq(latestScores.riskTier, filters.riskTier));

  const rows = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      status: members.status,
      riskTier: latestScores.riskTier,
      monthsActive: latestScores.monthsActive,
    })
    .from(members)
    .leftJoin(latestScores, eq(latestScores.memberId, members.id))
    .where(and(...conditions));

  // Last contribution date fetched per-row rather than via a third join —
  // simplest correct thing at hackathon scale (see coopscore-standards-v1.md
  // on not over-engineering query performance ahead of an actual bottleneck).
  return Promise.all(
    rows.map(async (row) => {
      const lastContribution = await db.query.contributions.findFirst({
        where: eq(contributions.memberId, row.id),
        orderBy: desc(contributions.contributedAt),
      });
      return {
        id: row.id,
        fullName: row.fullName,
        status: row.status,
        riskTier: row.riskTier ?? null,
        monthsActive: row.monthsActive ?? null,
        lastContributionAt: lastContribution?.contributedAt.toISOString() ?? null,
      };
    }),
  );
}

export async function createMember(
  cooperativeId: string,
  input: CreateMemberRequest,
): Promise<MemberDetail> {
  const [member] = await db
    .insert(members)
    .values({
      cooperativeId,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      expectedContributionAmount: String(input.expectedContributionAmount),
      contributionFrequency: input.contributionFrequency,
    })
    .returning();

  try {
    const provisioned = await provisionAccount(`member_${member.id}`);
    await db.insert(virtualAccounts).values({
      memberId: member.id,
      nombaAccountRef: `member_${member.id}`,
      accountNumber: provisioned.accountNumber,
      bankName: provisioned.bankName,
      providerResponse: provisioned.providerResponse,
    });
  } catch (cause) {
    if (cause instanceof ApiException) {
      throw new ApiException(cause.code, cause.message, cause.status, {
        memberId: member.id,
      });
    }
    throw cause;
  }

  return getMemberDetail(cooperativeId, member.id);
}

export async function getMemberDetail(
  cooperativeId: string,
  memberId: string,
): Promise<MemberDetail> {
  const member = await getMemberOrThrow(cooperativeId, memberId);

  const virtualAccount = await db.query.virtualAccounts.findFirst({
    where: eq(virtualAccounts.memberId, memberId),
  });

  const latestScore = await db.query.scoreSnapshots.findFirst({
    where: eq(scoreSnapshots.memberId, memberId),
    orderBy: desc(scoreSnapshots.computedAt),
  });

  const lastContribution = await db.query.contributions.findFirst({
    where: eq(contributions.memberId, memberId),
    orderBy: desc(contributions.contributedAt),
  });

  return {
    id: member.id,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    status: member.status,
    expectedContributionAmount: Number(member.expectedContributionAmount),
    contributionFrequency: member.contributionFrequency,
    monthsActive: latestScore?.monthsActive ?? null,
    riskTier: latestScore?.riskTier ?? null,
    lastContributionAt: lastContribution?.contributedAt.toISOString() ?? null,
    virtualAccount: virtualAccount
      ? {
          id: virtualAccount.id,
          accountNumber: virtualAccount.accountNumber,
          bankName: virtualAccount.bankName,
          status: virtualAccount.status,
        }
      : null,
    latestScore: latestScore
      ? {
          id: latestScore.id,
          memberId: latestScore.memberId,
          consistencyPct: Number(latestScore.consistencyPct),
          monthsActive: latestScore.monthsActive,
          missedPaymentsCount: latestScore.missedPaymentsCount,
          averageContribution: Number(latestScore.averageContribution),
          trend: latestScore.trend,
          riskTier: latestScore.riskTier,
          recommendedLoanAmount: Number(latestScore.recommendedLoanAmount),
          computedAt: latestScore.computedAt.toISOString(),
        }
      : null,
  };
}

export async function updateMember(
  cooperativeId: string,
  memberId: string,
  input: UpdateMemberRequest,
): Promise<MemberDetail> {
  await getMemberOrThrow(cooperativeId, memberId);

  // `inactive` is system-owned (set by the scoring engine) — see
  // coopscore-api-design-v1.md §3.8. Managers may only set active/suspended.
  if (input.status === "inactive") {
    throw new ApiException(
      "VALIDATION_ERROR",
      "status 'inactive' is set automatically by the scoring engine and cannot be assigned manually",
      400,
    );
  }

  await db
    .update(members)
    .set({
      ...(input.status && { status: input.status }),
      ...(input.expectedContributionAmount !== undefined && {
        expectedContributionAmount: String(input.expectedContributionAmount),
      }),
      ...(input.contributionFrequency && { contributionFrequency: input.contributionFrequency }),
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId));

  if (input.status === "suspended") {
    await db
      .update(virtualAccounts)
      .set({ status: "suspended", suspendedAt: new Date() })
      .where(eq(virtualAccounts.memberId, memberId));
    await logAction(cooperativeId, "member", memberId, "suspended");
  }

  return getMemberDetail(cooperativeId, memberId);
}

export async function retryProvisioning(
  cooperativeId: string,
  memberId: string,
): Promise<MemberDetail> {
  const member = await getMemberOrThrow(cooperativeId, memberId);

  const existing = await db.query.virtualAccounts.findFirst({
    where: eq(virtualAccounts.memberId, memberId),
  });
  if (existing) {
    throw new ApiException("ALREADY_PROVISIONED", "This member already has an account", 409);
  }

  const provisioned = await provisionAccount(`member_${member.id}`);
  await db.insert(virtualAccounts).values({
    memberId: member.id,
    nombaAccountRef: `member_${member.id}`,
    accountNumber: provisioned.accountNumber,
    bankName: provisioned.bankName,
    providerResponse: provisioned.providerResponse,
  });

  return getMemberDetail(cooperativeId, memberId);
}

export async function listContributions(
  cooperativeId: string,
  memberId: string,
  limit: number,
  offset: number,
): Promise<PaginatedListResponse<ContributionDTO>> {
  await getMemberOrThrow(cooperativeId, memberId);

  const rows = await db.query.contributions.findMany({
    where: eq(contributions.memberId, memberId),
    orderBy: desc(contributions.contributedAt),
    limit,
    offset,
  });
  const [{ total }] = await db
    .select({ total: count() })
    .from(contributions)
    .where(eq(contributions.memberId, memberId));

  return {
    data: rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      contributedAt: row.contributedAt.toISOString(),
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      isLate: row.isLate,
    })),
    pagination: { limit, offset, total },
  };
}

export async function listScoreSnapshots(
  cooperativeId: string,
  memberId: string,
  limit: number,
  offset: number,
): Promise<PaginatedListResponse<ScoreSnapshotDTO>> {
  await getMemberOrThrow(cooperativeId, memberId);

  const rows = await db.query.scoreSnapshots.findMany({
    where: eq(scoreSnapshots.memberId, memberId),
    orderBy: desc(scoreSnapshots.computedAt),
    limit,
    offset,
  });
  const [{ total }] = await db
    .select({ total: count() })
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.memberId, memberId));

  return {
    data: rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      consistencyPct: Number(row.consistencyPct),
      monthsActive: row.monthsActive,
      missedPaymentsCount: row.missedPaymentsCount,
      averageContribution: Number(row.averageContribution),
      trend: row.trend,
      riskTier: row.riskTier,
      recommendedLoanAmount: Number(row.recommendedLoanAmount),
      computedAt: row.computedAt.toISOString(),
    })),
    pagination: { limit, offset, total },
  };
}

// FR8 bulk path — see coopscore-api-design-v1.md §3.12.
export async function listAccountSlips(cooperativeId: string): Promise<AccountSlipDTO[]> {
  const rows = await db
    .select({
      memberId: members.id,
      fullName: members.fullName,
      phone: members.phone,
      accountNumber: virtualAccounts.accountNumber,
      bankName: virtualAccounts.bankName,
      cooperativeName: cooperatives.name,
    })
    .from(members)
    .innerJoin(virtualAccounts, eq(virtualAccounts.memberId, members.id))
    .innerJoin(cooperatives, eq(cooperatives.id, members.cooperativeId))
    .where(and(eq(members.cooperativeId, cooperativeId), eq(virtualAccounts.status, "active")));

  return rows;
}
