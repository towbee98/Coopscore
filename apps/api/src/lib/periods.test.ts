import { describe, expect, it } from "vitest";
import {
  computeContributionPeriod,
  countElapsedPeriods,
  getPeriodEnd,
  getPeriodStart,
  monthsActive,
} from "./periods.js";

describe("countElapsedPeriods", () => {
  it("is 0 the same day a member joins, regardless of frequency", () => {
    const joinedAt = "2026-01-01";
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(countElapsedPeriods(joinedAt, now, "weekly")).toBe(0);
    expect(countElapsedPeriods(joinedAt, now, "monthly")).toBe(0);
  });

  it("counts one full monthly period at exactly 30 days", () => {
    expect(countElapsedPeriods("2026-01-01", new Date("2026-01-31T00:00:00.000Z"), "monthly")).toBe(1);
    expect(countElapsedPeriods("2026-01-01", new Date("2026-01-30T00:00:00.000Z"), "monthly")).toBe(0);
  });

  it("counts one full weekly period at exactly 7 days", () => {
    expect(countElapsedPeriods("2026-01-01", new Date("2026-01-08T00:00:00.000Z"), "weekly")).toBe(1);
    expect(countElapsedPeriods("2026-01-01", new Date("2026-01-07T00:00:00.000Z"), "weekly")).toBe(0);
  });

  it("counts one full biweekly period at exactly 14 days", () => {
    expect(countElapsedPeriods("2026-01-01", new Date("2026-01-15T00:00:00.000Z"), "biweekly")).toBe(1);
    expect(countElapsedPeriods("2026-01-01", new Date("2026-01-14T00:00:00.000Z"), "biweekly")).toBe(0);
  });
});

describe("getPeriodStart / getPeriodEnd", () => {
  it("computes contiguous 30-day monthly windows anchored at joinedAt", () => {
    expect(getPeriodStart("2026-01-01", 0, "monthly")).toBe("2026-01-01");
    expect(getPeriodStart("2026-01-01", 1, "monthly")).toBe("2026-01-31");
    expect(getPeriodEnd("2026-01-01", "monthly")).toBe("2026-01-30");
  });

  it("computes contiguous 7-day weekly windows anchored at joinedAt", () => {
    expect(getPeriodStart("2026-01-01", 2, "weekly")).toBe("2026-01-15");
    expect(getPeriodEnd("2026-01-01", "weekly")).toBe("2026-01-07");
  });
});

describe("computeContributionPeriod", () => {
  const joinedAt = "2026-01-01";

  it("assigns a same-period contribution and marks it on-time within the grace window", () => {
    const result = computeContributionPeriod(joinedAt, new Date("2026-01-03T00:00:00.000Z"), "monthly");
    expect(result).toEqual({ periodStart: "2026-01-01", periodEnd: "2026-01-30", isLate: false });
  });

  it("marks a contribution late once it's past the 25% grace window of its period", () => {
    // monthly grace = floor(30 * 0.25) = 7 days; day 9 into the period is late
    const result = computeContributionPeriod(joinedAt, new Date("2026-01-10T00:00:00.000Z"), "monthly");
    expect(result).toEqual({ periodStart: "2026-01-01", periodEnd: "2026-01-30", isLate: true });
  });

  it("assigns a contribution to its actual (second) period, not the first", () => {
    const result = computeContributionPeriod(joinedAt, new Date("2026-02-05T00:00:00.000Z"), "monthly");
    expect(result).toEqual({ periodStart: "2026-01-31", periodEnd: "2026-03-01", isLate: false });
  });

  it("uses a 1-day grace window for weekly (floor(7 * 0.25) = 1)", () => {
    const onTime = computeContributionPeriod(joinedAt, new Date("2026-01-02T00:00:00.000Z"), "weekly");
    const late = computeContributionPeriod(joinedAt, new Date("2026-01-03T00:00:00.000Z"), "weekly");
    expect(onTime.isLate).toBe(false);
    expect(late.isLate).toBe(true);
  });
});

describe("monthsActive", () => {
  it("floors to whole 30-day months, independent of contribution frequency", () => {
    expect(monthsActive("2026-01-01", new Date("2026-01-01T00:00:00.000Z"))).toBe(0);
    expect(monthsActive("2026-01-01", new Date("2026-01-30T00:00:00.000Z"))).toBe(0);
    expect(monthsActive("2026-01-01", new Date("2026-01-31T00:00:00.000Z"))).toBe(1);
    expect(monthsActive("2026-01-01", new Date("2026-07-01T00:00:00.000Z"))).toBe(6);
  });
});
