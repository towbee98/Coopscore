// LLM narration layer — reuses the NGX stock-screener pattern (structured data
// in, plain-language explanation out). Per the locked architecture decision,
// this NEVER decides risk/amount — it only narrates numbers already computed
// by scoring.service.ts. Failure/timeout returns null, not a thrown error —
// the recommendation is still valid without narration (coopscore-api-design-v1.md §3.13).
import Anthropic from "@anthropic-ai/sdk";
import type { RiskTier, TrendDirection } from "@coopscore/shared";
import { env } from "../config/env.js";

const NARRATION_TIMEOUT_MS = 5000;
const MODEL = "claude-sonnet-5";

export interface NarrationInput {
  memberName: string;
  riskTier: RiskTier;
  consistencyPct: number;
  monthsActive: number;
  missedPaymentsCount: number;
  trend: TrendDirection;
  recommendedAmount: number;
}

function buildPrompt(input: NarrationInput): string {
  return [
    `Member: ${input.memberName}`,
    `Risk tier: ${input.riskTier}`,
    `Consistency: ${input.consistencyPct}%`,
    `Months active: ${input.monthsActive}`,
    `Missed payments: ${input.missedPaymentsCount}`,
    `Trend: ${input.trend}`,
    `Recommended loan amount: NGN ${input.recommendedAmount.toLocaleString()}`,
    "",
    "Write a 2-3 sentence plain-language explanation of this member's credit risk and loan recommendation, for a cooperative loan committee. State the facts above in a natural narrative. Do not suggest a different amount or risk tier than the ones given.",
  ].join("\n");
}

export async function generateNarration(input: NarrationInput): Promise<string | null> {
  if (!env.ANTHROPIC_API_KEY) {
    return null;
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NARRATION_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: buildPrompt(input) }],
      },
      { signal: controller.signal },
    );

    const block = response.content[0];
    return block?.type === "text" ? block.text : null;
  } catch (cause) {
    console.error("LLM narration failed, falling back to structured-only response", cause);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
