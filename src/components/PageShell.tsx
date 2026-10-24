import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  eyebrow,
  mock = false,
  narrow = false,
  top,
  children,
}: {
  /** Non-visual helpers (e.g. AutoRefresh) rendered first inside <main>. */
  top?: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  /** Marks a screen that still renders placeholder data. */
  mock?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 ${narrow ? "max-w-2xl" : "max-w-3xl"}`}>
      {top}
      {mock && (
        <p className="mb-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Placeholder screen: sample data, actions not wired yet.
        </p>
      )}
      {title && (
        <header className="mb-8">
          {eyebrow && <div className="mb-2 text-sm font-medium text-blue-700">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-prose text-sm leading-6 text-slate-600 sm:text-base">{subtitle}</p>}
        </header>
      )}
      {children}
    </main>
  );
}
