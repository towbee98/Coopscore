import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ContributionDTO, RecommendationDTO, ScoreSnapshotDTO } from "@coopscore/shared";
import { api, ApiClientError } from "../api/client.ts";
import { usePolling } from "../hooks/usePolling.ts";
import { Card } from "../components/ui/Card.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Badge, RiskBadge } from "../components/ui/Badge.tsx";
import { CopyIcon } from "../components/icons.tsx";
import { formatDate, formatNaira } from "../lib/format.ts";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="text-xs text-neutral-500">Not enough history yet for a trend line.</p>;
  }
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${40 - ((v - min) / range) * 40}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full text-primary-700">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MemberDetail() {
  const { id = "" } = useParams();
  const member = usePolling(() => api.getMember(id), [id]);
  const [contributions, setContributions] = useState<ContributionDTO[]>([]);
  const [snapshots, setSnapshots] = useState<ScoreSnapshotDTO[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationDTO | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountRequested, setAmountRequested] = useState<string>("");

  async function loadSideData() {
    const [contribRes, snapRes, recRes] = await Promise.all([
      api.listContributions(id),
      api.listScoreSnapshots(id),
      api.listRecommendations(id),
    ]);
    setContributions(contribRes.data);
    setSnapshots(snapRes.data);
    const latest = recRes.data[0] ?? null;
    setRecommendation(latest);
    setAmountRequested(latest ? String(latest.recommendedAmount) : "");
  }

  useEffect(() => {
    if (id) loadSideData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const detail = member.data;
  if (member.loading && !detail) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!detail) return <p className="text-sm text-red-600">Member not found.</p>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-950">{detail.fullName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={detail.status === "active" ? "green" : detail.status === "suspended" ? "red" : "gray"}>
              {detail.status}
            </Badge>
            <RiskBadge tier={detail.riskTier} />
          </div>
        </div>

        {detail.virtualAccount ? (
          <Card className="w-72 p-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Virtual Account</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-primary-700">
                {detail.virtualAccount.accountNumber}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(detail.virtualAccount!.accountNumber)}
                className="text-neutral-500 hover:text-neutral-950"
                aria-label="Copy account number"
              >
                <CopyIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">{detail.virtualAccount.bankName}</p>
          </Card>
        ) : (
          <Card className="w-72 p-3">
            <p className="text-sm font-semibold text-red-600">No virtual account</p>
            <p className="mt-1 text-xs text-neutral-500">Provisioning failed or hasn't run yet.</p>
            <Button
              variant="outline"
              className="mt-2 w-full"
              disabled={busy === "provision"}
              onClick={() => withBusy("provision", async () => { await api.retryProvisioning(id); await member.refetch(); })}
            >
              {busy === "provision" ? "Retrying…" : "Retry provisioning"}
            </Button>
          </Card>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <Card>
            <h2 className="mb-4 text-sm font-bold text-neutral-950">Score History</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-neutral-950">
                  {detail.latestScore ? `${detail.latestScore.consistencyPct.toFixed(0)}%` : "—"}
                </p>
                <p className="text-xs text-neutral-500">Consistency</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-950">{detail.monthsActive ?? "—"}</p>
                <p className="text-xs text-neutral-500">Months Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-950">
                  {detail.latestScore?.missedPaymentsCount ?? "—"}
                </p>
                <p className="text-xs text-neutral-500">Missed Payments</p>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-neutral-100 bg-neutral-50 p-3">
              <Sparkline values={[...snapshots].reverse().map((s) => s.consistencyPct)} />
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="text-sm font-bold text-neutral-950">Contribution History</h2>
              <Button
                variant="outline"
                disabled={busy === "simulate"}
                onClick={() =>
                  withBusy("simulate", async () => {
                    await api.simulateContribution(id, { amount: detail.expectedContributionAmount });
                    await Promise.all([member.refetch(), loadSideData()]);
                  })
                }
              >
                {busy === "simulate" ? "Simulating…" : "Simulate contribution"}
              </Button>
            </div>
            {contributions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-500">No contributions recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-5 py-2.5 font-semibold">Amount (NGN)</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-5 py-3 text-neutral-500">{formatDate(c.contributedAt)}</td>
                      <td className="px-5 py-3 font-medium text-neutral-950">{formatNaira(c.amount)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={c.isLate ? "amber" : "green"}>{c.isLate ? "Late" : "On-time"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 text-sm font-bold text-neutral-950">Loan Recommendation</h2>

          {!recommendation ? (
            <div>
              <p className="text-sm text-neutral-500">
                No recommendation generated yet. Generate one from the member's current contribution history.
              </p>
              <Button
                className="mt-4 w-full"
                disabled={busy === "recommend"}
                onClick={() =>
                  withBusy("recommend", async () => {
                    const rec = await api.createRecommendation(id);
                    setRecommendation(rec);
                    setAmountRequested(String(rec.recommendedAmount));
                  })
                }
              >
                {busy === "recommend" ? "Generating…" : "Generate Recommendation"}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Recommended Amount</p>
              <p className="text-2xl font-bold text-neutral-950">{formatNaira(recommendation.recommendedAmount)}</p>
              <div className="mt-2">
                <RiskBadge tier={recommendation.riskTier} />
              </div>
              <p className="mt-3 text-sm italic text-neutral-500">
                {recommendation.llmExplanation ?? "No AI explanation available for this recommendation."}
              </p>

              <label className="mt-4 block text-xs font-semibold text-neutral-950">
                Loan amount to request
                <input
                  type="number"
                  min={1}
                  value={amountRequested}
                  onChange={(e) => setAmountRequested(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none"
                />
              </label>

              <Button
                className="mt-3 w-full"
                disabled={busy === "loan"}
                onClick={() =>
                  withBusy("loan", async () => {
                    await api.createLoan(id, {
                      recommendationId: recommendation.id,
                      amountRequested: Number(amountRequested),
                    });
                    await loadSideData();
                  })
                }
              >
                {busy === "loan" ? "Submitting…" : "Submit Loan Application"}
              </Button>
              <p className="mt-2 text-xs text-neutral-500">
                Creates a pending loan for review on the Loans page — this doesn't approve it outright.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
