// Implements coopscore-scoring-rules-v1.md §2-4 exactly. Pure functions only —
// no DB/network access — per coopscore-standards-v1.md's hard rule that the
// rules engine must be unit-testable without a database.
import type { RiskTier, TrendDirection } from "@coopscore/shared";

export interface ScoringInputs {
  consistencyPct: number;
  missedPaymentsCount: number;
  monthsActive: number;
  trend: TrendDirection;
}

const RISK_THRESHOLDS = {
  HIGH_CONSISTENCY_CEILING: 70,
  HIGH_MISSED_FLOOR: 3,
  HIGH_MIN_MONTHS: 2,
  LOW_CONSISTENCY_FLOOR: 90,
  LOW_MIN_MONTHS: 3,
} as const;

const LOAN_MULTIPLIERS: Record<RiskTier, number> = { low: 6, medium: 3, high: 1 };
const MIN_LOAN_AMOUNT = 10_000;
const MAX_LOAN_AMOUNT = 2_000_000;
const ROUNDING_STEP = 10_000;

// Evaluated top-down, first match wins — see the scoring rules doc's decision
// table for why each gate exists and why this ordering must not change.
export function computeRiskTier(inputs: ScoringInputs): RiskTier {
  const { consistencyPct, missedPaymentsCount, monthsActive, trend } = inputs;

  if (
    consistencyPct < RISK_THRESHOLDS.HIGH_CONSISTENCY_CEILING ||
    missedPaymentsCount >= RISK_THRESHOLDS.HIGH_MISSED_FLOOR ||
    monthsActive < RISK_THRESHOLDS.HIGH_MIN_MONTHS
  ) {
    return "high";
  }

  if (
    consistencyPct >= RISK_THRESHOLDS.LOW_CONSISTENCY_FLOOR &&
    missedPaymentsCount === 0 &&
    monthsActive >= RISK_THRESHOLDS.LOW_MIN_MONTHS &&
    trend !== "declining"
  ) {
    return "low";
  }

  return "medium";
}

export function computeRecommendedAmount(averageContribution: number, tier: RiskTier): number {
  const raw = averageContribution * LOAN_MULTIPLIERS[tier];
  const clamped = Math.min(Math.max(raw, MIN_LOAN_AMOUNT), MAX_LOAN_AMOUNT);
  return Math.round(clamped / ROUNDING_STEP) * ROUNDING_STEP;
}
