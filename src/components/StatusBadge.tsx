import { STATUS_LABELS, type DisplayStatus } from "@/lib/status";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  InfoCircleIcon,
  XCircleIcon,
} from "./icons";

// Icon + text so status never depends on colour alone.
const META: Record<DisplayStatus, { cls: string; Icon: typeof CircleIcon }> = {
  not_submitted: { cls: "bg-slate-100 text-slate-700 ring-slate-300/70", Icon: CircleIcon },
  awaiting_validation: { cls: "bg-blue-50 text-blue-800 ring-blue-200", Icon: ClockIcon },
  validated: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircleIcon },
  needs_information: { cls: "bg-amber-50 text-amber-900 ring-amber-300", Icon: InfoCircleIcon },
  rejected: { cls: "bg-rose-50 text-rose-800 ring-rose-200", Icon: XCircleIcon },
  overdue: { cls: "bg-red-700 text-white ring-red-700", Icon: AlertTriangleIcon },
};

export function StatusBadge({ status, size = "sm" }: { status: DisplayStatus; size?: "sm" | "md" }) {
  const { cls, Icon } = META[status];
  const sizing = size === "md" ? "gap-1.5 px-3 py-1 text-sm" : "gap-1 px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold ring-1 ring-inset ${sizing} ${cls}`}>
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
      {STATUS_LABELS[status]}
    </span>
  );
}
