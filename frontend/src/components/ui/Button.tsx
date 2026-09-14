import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700",
  secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:bg-slate-800",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:text-slate-500 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
