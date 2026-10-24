import type { ComponentProps, ReactNode } from "react";
import { AlertTriangleIcon, CheckCircleIcon, InfoCircleIcon, XCircleIcon } from "./icons";

// Shared visual system: one button size, one card style, one input style.

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const button = {
  primary: `${buttonBase} bg-blue-700 text-white shadow-sm hover:bg-blue-800 focus-visible:outline-blue-700`,
  secondary: `${buttonBase} border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50 focus-visible:outline-blue-700`,
  success: `${buttonBase} bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-emerald-700`,
  warning: `${buttonBase} border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:outline-amber-600`,
  danger: `${buttonBase} border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 focus-visible:outline-rose-600`,
  link: "inline-flex items-center gap-1 rounded text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
};

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

type FieldProps = ComponentProps<"input"> & { label: string; hint?: ReactNode };

export function TextField({ label, hint, className = "", ...input }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input {...input} className={`mt-1.5 ${inputClass}`} />
      {hint && <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}

const ALERT_TONES = {
  error: { cls: "border-rose-200 bg-rose-50 text-rose-900", Icon: XCircleIcon, iconCls: "text-rose-600" },
  warning: { cls: "border-amber-200 bg-amber-50 text-amber-950", Icon: AlertTriangleIcon, iconCls: "text-amber-600" },
  success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircleIcon, iconCls: "text-emerald-600" },
  info: { cls: "border-slate-200 bg-slate-50 text-slate-800", Icon: InfoCircleIcon, iconCls: "text-slate-500" },
} as const;

export function Alert({
  tone,
  title,
  children,
  role,
}: {
  tone: keyof typeof ALERT_TONES;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
}) {
  const { cls, Icon, iconCls } = ALERT_TONES[tone];
  return (
    <div role={role} className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <Icon className={`mt-0.5 size-4 ${iconCls}`} />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-6">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}
