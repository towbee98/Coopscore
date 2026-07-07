import { useState, type SubmitEvent } from "react";
import type { Frequency, MemberDetail } from "@coopscore/shared";
import { api, ApiClientError } from "../api/client.ts";
import { Button } from "./ui/Button.tsx";
import { Input, Select } from "./ui/Input.tsx";
import { CopyIcon } from "./icons.tsx";

interface AddMemberModalProps {
  onClose: () => void;
  onCreated: (member: MemberDetail) => void;
}

type Step = { kind: "form" } | { kind: "success"; member: MemberDetail } | { kind: "failed"; memberId: string };

export function AddMemberModal({ onClose, onCreated }: AddMemberModalProps) {
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [expectedContributionAmount, setExpectedContributionAmount] = useState("50000");
  const [contributionFrequency, setContributionFrequency] = useState<Frequency | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contributionFrequency) {
      setError("Select a contribution frequency");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const member = await api.createMember({
        fullName,
        phone,
        email: email || undefined,
        expectedContributionAmount: Number(expectedContributionAmount),
        contributionFrequency,
      });
      setStep({ kind: "success", member });
      onCreated(member);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "PROVISIONING_FAILED") {
        const memberId = (err.details as { memberId?: string } | undefined)?.memberId;
        if (memberId) {
          setStep({ kind: "failed", memberId });
          return;
        }
      }
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry() {
    if (step.kind !== "failed") return;
    setSubmitting(true);
    setError(null);
    try {
      const member = await api.retryProvisioning(step.memberId);
      setStep({ kind: "success", member });
      onCreated(member);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-base font-bold text-neutral-950">Add Member</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-950" aria-label="Close">
            ✕
          </button>
        </div>

        {step.kind === "form" && (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-4">
              <Input
                label="Full Name"
                name="fullName"
                placeholder="e.g. Adebayo Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Phone Number"
                name="phone"
                placeholder="+234 801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Input
                label="Email Address (Optional)"
                type="email"
                name="email"
                placeholder="adebayo.j@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <hr className="border-neutral-200" />
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Financial Setup</p>

              <Input
                label="Expected Contribution"
                type="number"
                name="expectedContributionAmount"
                min={1}
                value={expectedContributionAmount}
                onChange={(e) => setExpectedContributionAmount(e.target.value)}
                required
              />
              <Select
                label="Contribution Frequency"
                name="contributionFrequency"
                value={contributionFrequency}
                onChange={(e) => setContributionFrequency(e.target.value as Frequency)}
                required
              >
                <option value="" disabled>
                  Select frequency
                </option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-auto flex gap-3 pt-6">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Adding…" : "Add member & provision account"}
              </Button>
            </div>
          </form>
        )}

        {step.kind === "failed" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
              !
            </div>
            <h3 className="text-base font-bold text-neutral-950">Provisioning Failed</h3>
            <p className="text-sm text-neutral-500">
              Virtual Account Provisioning Failed. We encountered an issue connecting to Nomba.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex w-full gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleRetry} disabled={submitting}>
                {submitting ? "Retrying…" : "Retry"}
              </Button>
            </div>
          </div>
        )}

        {step.kind === "success" && step.member.virtualAccount && (
          <div className="flex flex-1 flex-col px-5 py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-100 text-2xl text-secondary-700">
                ✓
              </div>
              <h3 className="text-base font-bold text-neutral-950">Virtual Account Provisioned!</h3>
              <p className="text-sm text-neutral-500">
                {step.member.fullName} has been added successfully and a dedicated contribution account is ready.
              </p>
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Bank Name</span>
                <span className="font-semibold text-neutral-950">{step.member.virtualAccount.bankName}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-neutral-500">Account Number</span>
                <span className="font-mono font-semibold text-primary-700">
                  {step.member.virtualAccount.accountNumber}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() =>
                navigator.clipboard.writeText(
                  `${step.member.virtualAccount!.bankName} — ${step.member.virtualAccount!.accountNumber}`,
                )
              }
            >
              <CopyIcon className="h-4 w-4" />
              Copy account details
            </Button>

            <a
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-secondary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-secondary-700"
              href={`https://wa.me/?text=${encodeURIComponent(
                `Hi ${step.member.fullName}, your CoopScore contribution account is ready.\nBank: ${step.member.virtualAccount!.bankName}\nAccount Number: ${step.member.virtualAccount!.accountNumber}`,
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              Share via WhatsApp
            </a>

            <Button variant="outline" className="mt-3 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
