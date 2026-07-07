import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { LoanDTO, LoanStatus } from "@coopscore/shared";
import { api, ApiClientError } from "../api/client.ts";
import { usePolling } from "../hooks/usePolling.ts";
import { Card } from "../components/ui/Card.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { formatDate, formatNaira } from "../lib/format.ts";

const TABS: { label: string; value: LoanStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const STATUS_TONE = { pending: "amber", approved: "green", rejected: "red" } as const;

export function Loans() {
  const [tab, setTab] = useState<LoanStatus | "all">("all");
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalAmount, setApprovalAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loans = usePolling(() => api.listLoans(tab === "all" ? undefined : tab), [tab]);

  useEffect(() => {
    api.listMembers().then((res) => {
      setMemberNames(Object.fromEntries(res.data.map((m) => [m.id, m.fullName])));
    });
  }, []);

  async function decide(loan: LoanDTO, decision: "approved" | "rejected") {
    setBusy(loan.id);
    setError(null);
    try {
      await api.decideLoan(loan.id, {
        decision,
        amountApproved: decision === "approved" ? Number(approvalAmount) : undefined,
      });
      setApprovingId(null);
      await loans.refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-950">Loan Applications</h1>
        <p className="text-sm text-neutral-500">Review and manage member loan requests.</p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold ${
              tab === t.value ? "border-primary-700 text-primary-700" : "border-transparent text-neutral-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card className="p-0">
        {loans.loading && !loans.data ? (
          <p className="px-5 py-6 text-sm text-neutral-500">Loading…</p>
        ) : loans.data?.data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No loans in this category.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-2.5 font-semibold">Member</th>
                <th className="px-5 py-2.5 font-semibold">Application Date</th>
                <th className="px-5 py-2.5 font-semibold">Amount Requested</th>
                <th className="px-5 py-2.5 font-semibold">Amount Approved</th>
                <th className="px-5 py-2.5 font-semibold">Risk Tier</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {loans.data?.data.map((loan) => (
                <tr key={loan.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-950">
                    <Link to={`/members/${loan.memberId}`} className="hover:text-primary-700">
                      {memberNames[loan.memberId] ?? loan.memberId}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{formatDate(loan.createdAt)}</td>
                  <td className="px-5 py-3 text-neutral-950">{formatNaira(loan.amountRequested)}</td>
                  <td className="px-5 py-3 text-neutral-950">
                    {loan.amountApproved !== null ? formatNaira(loan.amountApproved) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={loan.riskTierAtDecision === "low" ? "green" : loan.riskTierAtDecision === "medium" ? "amber" : "red"}>
                      {loan.riskTierAtDecision}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[loan.status]}>{loan.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {loan.status === "pending" &&
                      (approvingId === loan.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            autoFocus
                            value={approvalAmount}
                            onChange={(e) => setApprovalAmount(e.target.value)}
                            className="w-28 rounded-md border border-neutral-200 px-2 py-1 text-sm"
                          />
                          <Button
                            variant="primary"
                            className="px-2 py-1 text-xs"
                            disabled={busy === loan.id}
                            onClick={() => decide(loan, "approved")}
                          >
                            Confirm
                          </Button>
                          <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => setApprovingId(null)}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            className="px-2 py-1 text-xs"
                            onClick={() => {
                              setApprovingId(loan.id);
                              setApprovalAmount(String(loan.amountRequested));
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            disabled={busy === loan.id}
                            onClick={() => decide(loan, "rejected")}
                          >
                            Reject
                          </Button>
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
