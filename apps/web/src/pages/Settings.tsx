import { usePolling } from "../hooks/usePolling.ts";
import { api } from "../api/client.ts";
import { Card } from "../components/ui/Card.tsx";

const COOP_TYPE_LABEL: Record<string, string> = {
  cooperative: "Cooperative",
  sacco: "SACCO",
  church: "Church",
  trade_association: "Trade Association",
  other: "Other",
};

export function Settings() {
  const cooperative = usePolling(() => api.getCooperative());
  const coop = cooperative.data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-950">Settings</h1>
        <p className="text-sm text-neutral-500">Cooperative details on file.</p>
      </div>

      <Card className="max-w-lg">
        {!coop ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Cooperative Name</dt>
              <dd className="mt-1 font-semibold text-neutral-950">{coop.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Organization Type</dt>
              <dd className="mt-1 font-semibold text-neutral-950">{COOP_TYPE_LABEL[coop.type] ?? coop.type}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Contact Email</dt>
              <dd className="mt-1 font-semibold text-neutral-950">{coop.contactEmail}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Contact Phone</dt>
              <dd className="mt-1 font-semibold text-neutral-950">{coop.contactPhone}</dd>
            </div>
          </dl>
        )}
      </Card>

      <p className="mt-4 text-xs text-neutral-500">
        Editing cooperative info, changing password, and risk threshold tuning aren't wired up yet — there's no
        backend endpoint for any of those today, only <code>GET /api/cooperatives/me</code>. Worth a real
        conversation about scope before building UI for them.
      </p>
    </div>
  );
}
