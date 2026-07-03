import { and, desc, eq } from "drizzle-orm";
import type { RecommendationDTO } from "@coopscore/shared";
import { db } from "../db/client.js";
import { members, recommendations, scoreSnapshots } from "../db/schema.js";
import { ApiException } from "../lib/api-exception.js";
import { generateNarration } from "../llm/claude.js";

async function getMemberOrThrow(cooperativeId: string, memberId: string) {
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, memberId), eq(members.cooperativeId, cooperativeId)),
  });
  if (!member) {
    throw new ApiException("NOT_FOUND", "Member not found", 404);
  }
  return member;
}

export async function createRecommendation(
  cooperativeId: string,
  memberId: string,
): Promise<RecommendationDTO> {
  const member = await getMemberOrThrow(cooperativeId, memberId);

  const latestScore = await db.query.scoreSnapshots.findFirst({
    where: eq(scoreSnapshots.memberId, memberId),
    orderBy: desc(scoreSnapshots.computedAt),
  });
  if (!latestScore) {
    throw new ApiException(
      "NO_SCORE_SNAPSHOT",
      "This member has no score snapshot yet — nothing to recommend against",
      409,
    );
  }

  // LLM narration is additive and best-effort — see coopscore-api-design-v1.md §3.13.
  // A 201 is still returned below even if this resolves to null.
  const llmExplanation = await generateNarration({
    memberName: member.fullName,
    riskTier: latestScore.riskTier,
    consistencyPct: Number(latestScore.consistencyPct),
    monthsActive: latestScore.monthsActive,
    missedPaymentsCount: latestScore.missedPaymentsCount,
    trend: latestScore.trend,
    recommendedAmount: Number(latestScore.recommendedLoanAmount),
  });

  const [recommendation] = await db
    .insert(recommendations)
    .values({
      memberId,
      scoreSnapshotId: latestScore.id,
      riskTier: latestScore.riskTier,
      recommendedAmount: latestScore.recommendedLoanAmount,
      llmExplanation,
      llmModelUsed: llmExplanation ? "claude-sonnet-5" : null,
    })
    .returning();

  return {
    id: recommendation.id,
    memberId: recommendation.memberId,
    scoreSnapshotId: recommendation.scoreSnapshotId,
    riskTier: recommendation.riskTier,
    recommendedAmount: Number(recommendation.recommendedAmount),
    llmExplanation: recommendation.llmExplanation,
    generatedAt: recommendation.generatedAt.toISOString(),
  };
}

export async function listRecommendations(
  cooperativeId: string,
  memberId: string,
): Promise<RecommendationDTO[]> {
  await getMemberOrThrow(cooperativeId, memberId);

  const rows = await db.query.recommendations.findMany({
    where: eq(recommendations.memberId, memberId),
    orderBy: desc(recommendations.generatedAt),
  });

  return rows.map((row) => ({
    id: row.id,
    memberId: row.memberId,
    scoreSnapshotId: row.scoreSnapshotId,
    riskTier: row.riskTier,
    recommendedAmount: Number(row.recommendedAmount),
    llmExplanation: row.llmExplanation,
    generatedAt: row.generatedAt.toISOString(),
  }));
}
