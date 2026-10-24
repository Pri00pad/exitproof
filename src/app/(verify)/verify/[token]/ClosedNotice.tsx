import { AlertTriangleIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import type { ClosedState } from "./actions";

// Verifier-safe states: no case, employee or item details are shown.
const STATES: Record<ClosedState, { title: string; body: string; Icon: typeof XCircleIcon; tone: string }> = {
  invalid: {
    title: "Invalid verification link",
    body: "This link isn't valid. It may have been mistyped or replaced with a newer link. Ask the employee to send you their current verification link.",
    Icon: XCircleIcon,
    tone: "bg-slate-100 text-slate-600",
  },
  expired: {
    title: "Verification link expired",
    body: "This link has expired. Ask the employee to create a new verification link in ExitProof.",
    Icon: ClockIcon,
    tone: "bg-amber-50 text-amber-700",
  },
  reviewed: {
    title: "This request has already been reviewed",
    body: "A decision has already been recorded for this submission, so it can't be changed through this link.",
    Icon: CheckCircleIcon,
    tone: "bg-emerald-50 text-emerald-700",
  },
  not_current: {
    title: "This verification link is no longer current",
    body: "The employee has updated this item since this link was created. Ask them for their current verification link.",
    Icon: AlertTriangleIcon,
    tone: "bg-amber-50 text-amber-700",
  },
};

export function ClosedNotice({ state }: { state: ClosedState }) {
  const { title, body, Icon, tone } = STATES[state];
  return (
    <Card className="px-6 py-10 text-center sm:px-10">
      <span className={`mx-auto flex size-12 items-center justify-center rounded-full ${tone}`}>
        <Icon className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{body}</p>
    </Card>
  );
}
