import type { ReactNode } from "react";
import type { RiskTier } from "@coopscore/shared";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-secondary-100 text-secondary-700",
  amber: "bg-tertiary-100 text-tertiary-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-primary-100 text-primary-700",
  gray: "bg-neutral-100 text-neutral-500",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const RISK_TONE: Record<RiskTier, Tone> = { low: "green", medium: "amber", high: "red" };
const RISK_LABEL: Record<RiskTier, string> = { low: "Low Risk", medium: "Medium Risk", high: "High Risk" };

export function RiskBadge({ tier }: { tier: RiskTier | null }) {
  if (!tier) return <Badge tone="gray">Unscored</Badge>;
  return <Badge tone={RISK_TONE[tier]}>{RISK_LABEL[tier]}</Badge>;
}
