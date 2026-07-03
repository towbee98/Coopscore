import { and, count, desc, eq, sql } from "drizzle-orm";
import type { CooperativeDTO, CooperativeSummary, RiskTier } from "@coopscore/shared";
import { db } from "../db/client.js";
import { contributions, cooperatives, loans, members, scoreSnapshots } from "../db/schema.js";
import { ApiException } from "../lib/api-exception.js";

export async function getCooperative(cooperativeId: string): Promise<CooperativeDTO> {
  const cooperative = await db.query.cooperatives.findFirst({
    where: eq(cooperatives.id, cooperativeId),
  });
  if (!cooperative) {
    throw new ApiException("NOT_FOUND", "Cooperative not found", 404);
  }
  return {
    id: cooperative.id,
    name: cooperative.name,
    type: cooperative.type,
    contactEmail: cooperative.contactEmail,
    contactPhone: cooperative.contactPhone,
  };
}

export async function getSummary(cooperativeId: string): Promise<CooperativeSummary> {
  const [{ totalMembers }] = await db
    .select({ totalMembers: count() })
    .from(members)
    .where(eq(members.cooperativeId, cooperativeId));

  const [{ activeLoans }] = await db
    .select({ activeLoans: count() })
    .from(loans)
    .innerJoin(members, eq(members.id, loans.memberId))
    .where(and(eq(members.cooperativeId, cooperativeId), eq(loans.status, "approved")));

  const [{ totalCollectedThisMonth }] = await db
    .select({
      totalCollectedThisMonth: sql<string>`COALESCE(SUM(${contributions.amount}), 0)`,
    })
    .from(contributions)
    .innerJoin(members, eq(members.id, contributions.memberId))
    .where(
      and(
        eq(members.cooperativeId, cooperativeId),
        sql`${contributions.periodStart} >= date_trunc('month', CURRENT_DATE)::date`,
        sql`${contributions.periodStart} < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date`,
      ),
    );

  const latestSnapshotsByMember = await db
    .selectDistinctOn([scoreSnapshots.memberId], {
      riskTier: scoreSnapshots.riskTier,
    })
    .from(scoreSnapshots)
    .innerJoin(members, eq(members.id, scoreSnapshots.memberId))
    .where(eq(members.cooperativeId, cooperativeId))
    .orderBy(scoreSnapshots.memberId, desc(scoreSnapshots.computedAt));

  const membersByRiskTier: Record<RiskTier, number> = { low: 0, medium: 0, high: 0 };
  for (const row of latestSnapshotsByMember) {
    membersByRiskTier[row.riskTier] += 1;
  }

  return {
    totalMembers,
    totalCollectedThisMonth: Number(totalCollectedThisMonth),
    activeLoans,
    membersByRiskTier,
  };
}
