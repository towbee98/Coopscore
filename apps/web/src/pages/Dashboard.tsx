import { useState } from "react";
import { Link } from "react-router-dom";
import type { MemberDetail } from "@coopscore/shared";
import { api } from "../api/client.ts";
import { usePolling } from "../hooks/usePolling.ts";
import { Card } from "../components/ui/Card.tsx";
import { Button } from "../components/ui/Button.tsx";
import { RiskBadge } from "../components/ui/Badge.tsx";
import { AddMemberModal } from "../components/AddMemberModal.tsx";
import { formatDate, formatNaira } from "../lib/format.ts";

export function Dashboard() {
  const [addOpen, setAddOpen] = useState(false);
  const summary = usePolling(() => api.getSummary());
  const members = usePolling(() => api.listMembers());

  function handleCreated(_member: MemberDetail) {
    summary.refetch();
    members.refetch();
  }

  const recentMembers = members.data?.data.slice(0, 6) ?? [];
  const riskCounts = summary.data?.membersByRiskTier ?? { low: 0, medium: 0, high: 0 };
  const totalRisked = riskCounts.low + riskCounts.medium + riskCounts.high || 1;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-950">Overview</h1>
          <p className="text-sm text-neutral-500">Snapshot of cooperative performance for current period.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Member</Button>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <Card>
          <p className="text-2xl font-bold text-neutral-950">{summary.data?.totalMembers ?? "—"}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">Total Members</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-neutral-950">
            {summary.data ? formatNaira(summary.data.totalCollectedThisMonth) : "—"}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">Total Collected This Month</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-neutral-950">{summary.data?.activeLoans ?? "—"}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">Active Loans</p>
        </Card>
        <Card>
          <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="bg-secondary-600"
              style={{ width: `${(riskCounts.low / totalRisked) * 100}%` }}
            />
            <div
              className="bg-tertiary-600"
              style={{ width: `${(riskCounts.medium / totalRisked) * 100}%` }}
            />
            <div className="bg-red-500" style={{ width: `${(riskCounts.high / totalRisked) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
            Members by Risk — {riskCounts.low} low / {riskCounts.medium} med / {riskCounts.high} high
          </p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-sm font-bold text-neutral-950">Members</h2>
          <Link to="/members" className="text-sm font-semibold text-primary-700">
            View all
          </Link>
        </div>

        {members.loading && recentMembers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">Loading…</p>
        ) : recentMembers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No members yet. Add your first member to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-2.5 font-semibold">Name</th>
                <th className="px-5 py-2.5 font-semibold">Risk Tier</th>
                <th className="px-5 py-2.5 font-semibold">Months Active</th>
                <th className="px-5 py-2.5 font-semibold">Last Contribution</th>
                <th className="px-5 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {recentMembers.map((member) => (
                <tr key={member.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-950">{member.fullName}</td>
                  <td className="px-5 py-3">
                    <RiskBadge tier={member.riskTier} />
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{member.monthsActive ?? "—"}</td>
                  <td className="px-5 py-3 text-neutral-500">{formatDate(member.lastContributionAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/members/${member.id}`} className="font-semibold text-primary-700">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {addOpen && <AddMemberModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
    </div>
  );
}
