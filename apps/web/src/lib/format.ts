export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}
