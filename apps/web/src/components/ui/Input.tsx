import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { EyeIcon, EyeOffIcon } from "../icons.tsx";

interface FieldProps {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, icon, className = "", id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label className="block" htmlFor={inputId}>
        {label && <span className="mb-1.5 block text-sm font-semibold text-neutral-950">{label}</span>}
        <span className="relative flex items-center">
          {icon && <span className="pointer-events-none absolute left-3 text-neutral-500">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 placeholder:text-neutral-500 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 ${icon ? "pl-9" : ""} ${className}`}
            {...props}
          />
        </span>
        {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      </label>
    );
  },
);
Input.displayName = "Input";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<FieldProps & InputHTMLAttributes<HTMLInputElement>, "type">
>(({ label, error, className = "", id, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? props.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-sm font-semibold text-neutral-950">{label}</span>}
      <span className="relative flex items-center">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-2 pr-9 text-sm text-neutral-950 placeholder:text-neutral-500 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 text-neutral-500 hover:text-neutral-950"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </span>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});
PasswordInput.displayName = "PasswordInput";

export const Select = forwardRef<
  HTMLSelectElement,
  FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
>(({ label, error, className = "", id, children, ...props }, ref) => {
  const selectId = id ?? props.name;
  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="mb-1.5 block text-sm font-semibold text-neutral-950">{label}</span>}
      <select
        ref={ref}
        id={selectId}
        className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});
Select.displayName = "Select";
