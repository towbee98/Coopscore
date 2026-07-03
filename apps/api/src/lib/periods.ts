// Period boundary + lateness calculation, shared by reconciliation.service.ts
// (assigns each incoming contribution to a period) and snapshot.service.ts
// (aggregates already-assigned contributions back into scoring inputs) — both
// MUST use this same module so a contribution's period never gets computed
// two different ways.
//
// Design note not pinned down anywhere else in the docs: what counts as
// "late" within a period. Chosen here: on-time = arrives within the first
// 25% of the period length; anything after that grace window is late, but
// still counts toward that period (not a missed period) per
// coopscore-scoring-rules-v1.md's "full amount required to count as on time"
// / "late, counted separately from missed" distinction.
import type { Frequency } from "@coopscore/shared";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PERIOD_LENGTH_DAYS: Record<Frequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const LATE_GRACE_FRACTION = 0.25;

export function getPeriodLengthDays(frequency: Frequency): number {
  return PERIOD_LENGTH_DAYS[frequency];
}

export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// Full periods completed between joinedAt and now — the denominator for
// consistency_pct etc. Zero if less than one full period has elapsed yet.
export function countElapsedPeriods(joinedAt: string, now: Date, frequency: Frequency): number {
  const elapsedDays = daysBetween(parseDateOnly(joinedAt), now);
  return Math.max(0, Math.floor(elapsedDays / getPeriodLengthDays(frequency)));
}

// Tenure in months — independent of contribution_frequency, per
// coopscore-scoring-rules-v1.md §1 ("months_active" is a fixed 30-day-month
// calculation, distinct from the frequency-based period length above).
export function monthsActive(joinedAt: string, now: Date): number {
  return Math.max(0, Math.floor(daysBetween(parseDateOnly(joinedAt), now) / 30));
}

export function getPeriodStart(joinedAt: string, periodIndex: number, frequency: Frequency): string {
  const periodLengthDays = getPeriodLengthDays(frequency);
  return formatDateOnly(addDays(parseDateOnly(joinedAt), periodIndex * periodLengthDays));
}

export function getPeriodEnd(periodStart: string, frequency: Frequency): string {
  return formatDateOnly(addDays(parseDateOnly(periodStart), getPeriodLengthDays(frequency) - 1));
}

export interface ContributionPeriod {
  periodStart: string;
  periodEnd: string;
  isLate: boolean;
}

// Assigns a contribution to the period window containing its own timestamp
// (not a "which period was this meant to catch up" judgment — see module
// header), then flags it late relative to that period's grace cutoff.
export function computeContributionPeriod(
  joinedAt: string,
  contributedAt: Date,
  frequency: Frequency,
): ContributionPeriod {
  const periodLengthDays = getPeriodLengthDays(frequency);
  const elapsedDays = Math.max(0, daysBetween(parseDateOnly(joinedAt), contributedAt));
  const periodIndex = Math.floor(elapsedDays / periodLengthDays);
  const periodStart = getPeriodStart(joinedAt, periodIndex, frequency);
  const periodEnd = getPeriodEnd(periodStart, frequency);

  const graceDays = Math.floor(periodLengthDays * LATE_GRACE_FRACTION);
  const daysIntoPeriod = daysBetween(parseDateOnly(periodStart), contributedAt);

  return { periodStart, periodEnd, isLate: daysIntoPeriod > graceDays };
}
