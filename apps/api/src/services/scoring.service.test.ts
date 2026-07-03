// The 8-row test table from coopscore-scoring-rules-v1.md §5, verbatim.
import { describe, expect, it } from "vitest";
import { computeRecommendedAmount, computeRiskTier } from "./scoring.service.js";

const cases = [
  {
    consistencyPct: 95,
    missedPaymentsCount: 0,
    monthsActive: 6,
    trend: "stable" as const,
    averageContribution: 50_000,
    expectedTier: "low" as const,
    expectedAmount: 300_000,
  },
  {
    consistencyPct: 95,
    missedPaymentsCount: 0,
    monthsActive: 6,
    trend: "declining" as const,
    averageContribution: 50_000,
    expectedTier: "medium" as const,
    expectedAmount: 150_000,
  },
  {
    consistencyPct: 92,
    missedPaymentsCount: 0,
    monthsActive: 1,
    trend: "stable" as const,
    averageContribution: 20_000,
    expectedTier: "high" as const,
    expectedAmount: 20_000,
  },
  {
    consistencyPct: 60,
    missedPaymentsCount: 1,
    monthsActive: 8,
    trend: "stable" as const,
    averageContribution: 30_000,
    expectedTier: "high" as const,
    expectedAmount: 30_000,
  },
  {
    consistencyPct: 85,
    missedPaymentsCount: 4,
    monthsActive: 12,
    trend: "improving" as const,
    averageContribution: 40_000,
    expectedTier: "high" as const,
    expectedAmount: 40_000,
  },
  {
    consistencyPct: 80,
    missedPaymentsCount: 1,
    monthsActive: 4,
    trend: "stable" as const,
    averageContribution: 60_000,
    expectedTier: "medium" as const,
    expectedAmount: 180_000,
  },
  {
    consistencyPct: 100,
    missedPaymentsCount: 0,
    monthsActive: 24,
    trend: "stable" as const,
    averageContribution: 400_000,
    expectedTier: "low" as const,
    expectedAmount: 2_000_000,
  },
  {
    consistencyPct: 90,
    missedPaymentsCount: 0,
    monthsActive: 3,
    trend: "stable" as const,
    averageContribution: 500,
    expectedTier: "low" as const,
    expectedAmount: 10_000,
  },
];

describe("computeRiskTier", () => {
  it.each(cases)(
    "consistency=$consistencyPct missed=$missedPaymentsCount months=$monthsActive trend=$trend -> $expectedTier",
    ({ expectedTier, ...inputs }) => {
      expect(computeRiskTier(inputs)).toBe(expectedTier);
    },
  );
});

describe("computeRecommendedAmount", () => {
  it.each(cases)(
    "avg=$averageContribution tier=$expectedTier -> $expectedAmount",
    ({ averageContribution, expectedTier, expectedAmount }) => {
      expect(computeRecommendedAmount(averageContribution, expectedTier)).toBe(expectedAmount);
    },
  );
});
