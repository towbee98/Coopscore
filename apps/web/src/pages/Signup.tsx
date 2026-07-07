import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CoopType } from "@coopscore/shared";
import { api, ApiClientError } from "../api/client.ts";
import { setSession } from "../lib/auth.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input, PasswordInput, Select } from "../components/ui/Input.tsx";
import { CoopScoreLogo } from "../components/icons.tsx";

const COOP_TYPES: { value: CoopType; label: string }[] = [
  { value: "cooperative", label: "Cooperative" },
  { value: "sacco", label: "SACCO" },
  { value: "church", label: "Church" },
  { value: "trade_association", label: "Trade Association" },
  { value: "other", label: "Other" },
];

export function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<CoopType | "">("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) {
      setError("Select an organization type");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { token, cooperative } = await api.signup({ name, type, contactEmail, contactPhone, password });
      setSession(token, cooperative);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-700">
            <CoopScoreLogo className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-neutral-950">Register Organization</h1>
          <p className="text-center text-sm text-neutral-500">Set up your CoopScore workspace.</p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Cooperative Name"
            name="name"
            placeholder="e.g., Apex Farmers Cooperative"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Select
            label="Organization Type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as CoopType)}
            required
          >
            <option value="" disabled>
              Select type...
            </option>
            {COOP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input
            label="Contact Email"
            type="email"
            name="contactEmail"
            placeholder="manager@coop.org"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />
          <Input
            label="Contact Phone"
            name="contactPhone"
            placeholder="+234 800 000 0000"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            required
          />
          <PasswordInput
            label="Password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <p className="-mt-2 text-xs text-neutral-500">Minimum 8 characters.</p>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <Button type="submit" className="mt-5 w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="mt-5 text-center text-sm text-neutral-500">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-primary-700">
            Sign in to workspace
          </Link>
        </p>
      </form>
    </div>
  );
}
