import { BrandMark } from "@/components/Brand";
import type { Workflow } from "@/lib/status";

const LABELS: Record<Workflow, string> = {
  validation: "Verification Request",
  request: "Document Request",
};

// Minimal verifier header: no employee navigation, identity or Log out. Lives
// in the page (not the layout) because the label depends on the link's workflow.
export function VerifierHeader({ workflow }: { workflow: Workflow }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandMark />
        <span className="text-sm font-medium text-slate-500">{LABELS[workflow]}</span>
      </div>
    </header>
  );
}
