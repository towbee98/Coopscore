import { useState } from "react";
import { Link } from "react-router-dom";
import type { MemberDetail, MemberStatus, RiskTier } from "@coopscore/shared";
import { api } from "../api/client.ts";
import { usePolling } from "../hooks/usePolling.ts";
import { Card } from "../components/ui/Card.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input, Select } from "../components/ui/Input.tsx";
import { RiskBadge, Badge } from "../components/ui/Badge.tsx";
import { AddMemberModal } from "../components/AddMemberModal.tsx";
import { SearchIcon } from "../components/icons.tsx";
import { formatDate } from "../lib/format.ts";

const STATUS_TONE = { active: "green", inactive: "gray", suspended: "red" } as const;

export function Members() {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MemberStatus | "">("");
  const [riskTier, setRiskTier] = useState<RiskTier | "">("");

  const members = usePolling(
    () =>
      api.listMembers({
        search: search || undefined,
        status: status || undefined,
        riskTier: riskTier || undefined,
      }),
    [search, status, riskTier],
  );

  function handleCreated(_member: MemberDetail) {
    members.refetch();
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-950">Members</h1>
          <p className="text-sm text-neutral-500">Manage cooperative members and their contribution accounts.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ Add Member</Button>
      </div>

      <div className="mb-4 flex gap-3">
        <div className="flex-1">
          <Input
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="Filter members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as MemberStatus)} className="w-40">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select value={riskTier} onChange={(e) => setRiskTier(e.target.value as RiskTier)} className="w-40">
          <option value="">All risk tiers</option>
          <option value="low">Low risk</option>
          <option value="medium">Medium risk</option>
          <option value="high">High risk</option>
        </Select>
      </div>

      <Card className="p-0">
        {members.loading && !members.data ? (
          <p className="px-5 py-6 text-sm text-neutral-500">Loading…</p>
        ) : members.data?.data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No members match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-2.5 font-semibold">Name</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold">Risk Tier</th>
                <th className="px-5 py-2.5 font-semibold">Months Active</th>
                <th className="px-5 py-2.5 font-semibold">Last Contribution</th>
                <th className="px-5 py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {members.data?.data.map((member) => (
                <tr key={member.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-neutral-950">{member.fullName}</td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[member.status]}>{member.status}</Badge>
                  </td>
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
