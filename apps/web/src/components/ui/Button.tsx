import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary-700 text-white hover:bg-primary-800 disabled:bg-primary-500/60",
  secondary: "bg-neutral-100 text-neutral-950 hover:bg-neutral-200",
  outline: "bg-white text-primary-700 border border-neutral-200 hover:bg-neutral-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400",
};

export function Button({ variant = "primary", className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
