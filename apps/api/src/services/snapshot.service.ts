// DB-touching orchestration around the PURE functions in scoring.service.ts.
// Deliberately kept separate from that file — computeRiskTier/computeRecommendedAmount
// must stay unit-testable with no DB access (coopscore-standards-v1.md), so all
// the "turn raw contribution rows into scoring inputs" work lives here instead.
import { asc, eq } from "drizzle-orm";
import type { TrendDirection } from "@coopscore/shared";
import { db } from "../db/client.js";
import { contributions, members, scoreSnapshots } from "../db/schema.js";
import { countElapsedPeriods, getPeriodStart, monthsActive as computeMonthsActive } from "../lib/periods.js";
import { computeRecommendedAmount, computeRiskTier } from "./scoring.service.js";

interface PeriodAggregate {
  periodStart: string;
  total: number;
  isLate: boolean;
}

const TREND_WINDOW = 3;
const TREND_DELTA_THRESHOLD_PP = 10;
const MIN_PERIODS_FOR_TREND = 4;

// coopscore-scoring-rules-v1.md §1: compare on-time rate of the last 3 elapsed
// periods vs the 3 before that; <4 total periods defaults to "stable".
function computeTrend(periods: PeriodAggregate[], expectedAmount: number): TrendDirection {
  if (periods.length < MIN_PERIODS_FOR_TREND) return "stable";

  const onTimeRate = (window: PeriodAggregate[]): number => {
    if (window.length === 0) return 0;
    const onTime = window.filter((p) => p.total >= expectedAmount && !p.isLate).length;
    return (onTime / window.length) * 100;
  };

  const lastWindowStart = periods.length - TREND_WINDOW;
  const prevWindowStart = Math.max(0, lastWindowStart - TREND_WINDOW);

  const delta = onTimeRate(periods.slice(lastWindowStart)) - onTimeRate(periods.slice(prevWindowStart, lastWindowStart));

  if (delta > TREND_DELTA_THRESHOLD_PP) return "improving";
  if (delta < -TREND_DELTA_THRESHOLD_PP) return "declining";
  return "stable";
}

// Recomputes and inserts a new append-only score_snapshots row for a member.
// No-op if fewer than one full contribution period has elapsed yet (per
// coopscore-scoring-rules-v1.md's edge case — nothing to score yet).
export async function generateSnapshot(memberId: string): Promise<void> {
  const member = await db.query.members.findFirst({ where: eq(members.id, memberId) });
  if (!member) return;

  const now = new Date();
  const totalPeriodsElapsed = countElapsedPeriods(member.joinedAt, now, member.contributionFrequency);
  if (totalPeriodsElapsed === 0) return;

  const rows = await db.query.contributions.findMany({
    where: eq(contributions.memberId, memberId),
    orderBy: asc(contributions.contributedAt),
  });

  const expectedAmount = Number(member.expectedContributionAmount);

  const periods: PeriodAggregate[] = [];
  for (let index = 0; index < totalPeriodsElapsed; index++) {
    const periodStart = getPeriodStart(member.joinedAt, index, member.contributionFrequency);
    const periodRows = rows.filter((row) => row.periodStart === periodStart);
    periods.push({
      periodStart,
      total: periodRows.reduce((sum, row) => sum + Number(row.amount), 0),
      isLate: periodRows.some((row) => row.isLate),
    });
  }

  const missedPaymentsCount = periods.filter((p) => p.total === 0).length;
  const onTimePeriods = periods.filter((p) => p.total >= expectedAmount && !p.isLate).length;
  const consistencyPct = (onTimePeriods / totalPeriodsElapsed) * 100;

  const paidPeriods = periods.filter((p) => p.total > 0);
  const averageContribution =
    paidPeriods.length > 0 ? paidPeriods.reduce((sum, p) => sum + p.total, 0) / paidPeriods.length : 0;

  const trend = computeTrend(periods, expectedAmount);
  const monthsActiveValue = computeMonthsActive(member.joinedAt, now);

  const riskTier = computeRiskTier({
    consistencyPct,
    missedPaymentsCount,
    monthsActive: monthsActiveValue,
    trend,
  });
  const recommendedLoanAmount = computeRecommendedAmount(averageContribution, riskTier);

  await db.insert(scoreSnapshots).values({
    memberId,
    consistencyPct: consistencyPct.toFixed(2),
    monthsActive: monthsActiveValue,
    missedPaymentsCount,
    averageContribution: averageContribution.toFixed(2),
    trend,
    riskTier,
    recommendedLoanAmount: String(recommendedLoanAmount),
    inputsSnapshot: { totalPeriodsElapsed, periods },
  });
}
