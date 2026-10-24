"use client";

import { useState } from "react";
import { CheckCircleIcon, InfoCircleIcon, MessageIcon, XCircleIcon } from "@/components/icons";
import { Alert, Spinner, button, inputClass } from "@/components/ui";
import { ClosedNotice } from "./ClosedNotice";
import { recordDecision, type ClosedState, type Decision } from "./actions";

const CONFIRMATION: Record<Decision, { title: string; body: string; Icon: typeof CheckCircleIcon; tone: string }> = {
  approved: {
    title: "Validation recorded",
    body: "This item is now Validated.",
    Icon: CheckCircleIcon,
    tone: "bg-emerald-50 text-emerald-700",
  },
  info_requested: {
    title: "More information requested.",
    body: "The employee will see your comment in ExitProof.",
    Icon: InfoCircleIcon,
    tone: "bg-amber-50 text-amber-700",
  },
  rejected: {
    title: "Submission rejected.",
    body: "The employee will see your reason in ExitProof.",
    Icon: XCircleIcon,
    tone: "bg-rose-50 text-rose-700",
  },
};

export function DecisionForm({ token }: { token: string }) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Decision | null>(null);
  const [closed, setClosed] = useState<ClosedState | null>(null);

  async function decide(decision: Decision) {
    setError(null);
    if (decision !== "approved" && !comment.trim()) {
      setError(
        decision === "rejected"
          ? "Add a reason in the comment box so the employee knows why."
          : "Add a comment telling the employee what information you need.",
      );
      return;
    }
    setPending(decision);
    const result = await recordDecision({ token, decision, comment });
    setPending(null);
    if (result.ok) setDone(result.decision);
    else if (result.closed) setClosed(result.closed);
    else setError(result.error);
  }

  if (closed) {
    return (
      <div className="border-t border-slate-100 p-4 sm:p-6">
        <ClosedNotice state={closed} />
      </div>
    );
  }

  if (done) {
    const { title, body, Icon, tone } = CONFIRMATION[done];
    return (
      <div role="status" className="border-t border-slate-100 px-5 py-8 text-center sm:px-6">
        <span className={`mx-auto flex size-12 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{body}</p>
        <p className="mt-4 text-xs text-slate-500">You can close this page. No further action is needed.</p>
      </div>
    );
  }

  const busy = pending !== null;
  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
      <h2 className="text-sm font-semibold text-slate-900">Your decision</h2>
      {error && <Alert tone="error" role="alert">{error}</Alert>}
      <label className="block">
        <span className="text-sm font-medium text-slate-800">Comment</span>
        <textarea
          name="comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy}
          className={`mt-1.5 ${inputClass}`}
        />
        <span className="mt-1.5 block text-xs text-slate-500">
          Optional to approve. Required to request more information or reject. The employee will see it.
        </span>
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => decide("approved")} disabled={busy} className={button.success}>
          {pending === "approved" ? <Spinner /> : <CheckCircleIcon className="size-4" />}
          Approve
        </button>
        <button type="button" onClick={() => decide("info_requested")} disabled={busy} className={button.warning}>
          {pending === "info_requested" ? <Spinner /> : <MessageIcon className="size-4" />}
          Request More Information
        </button>
        <button type="button" onClick={() => decide("rejected")} disabled={busy} className={button.danger}>
          {pending === "rejected" ? <Spinner /> : <XCircleIcon className="size-4" />}
          Reject
        </button>
      </div>
    </div>
  );
}
