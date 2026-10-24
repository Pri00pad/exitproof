"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangleIcon, CheckCircleIcon, RefreshIcon } from "@/components/icons";
import { CopyField } from "@/components/CopyButton";
import { Alert, Card, Spinner, button } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { readVerifyLink, saveVerifyLink } from "@/lib/verify-link-storage";
import { regenerateLink } from "./actions";

const noopSubscribe = () => () => {};

export function AwaitingPanel({
  itemId,
  submissionId,
  submittedAt,
  responseDueAt,
  overdue,
  hrContactName,
}: {
  itemId: string;
  submissionId: string;
  submittedAt: string;
  responseDueAt: string;
  overdue: boolean;
  hrContactName: string;
}) {
  // The link only exists in this tab's sessionStorage (set right after submitting).
  const stored = useSyncExternalStore(noopSubscribe, () => readVerifyLink(submissionId), () => null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = fresh ?? stored;

  async function onRegenerate() {
    setPending(true);
    setError(null);
    const result = await regenerateLink({ itemId, submissionId });
    setPending(false);
    setConfirming(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveVerifyLink(submissionId, result.verifyUrl);
    setFresh(result.verifyUrl);
  }

  return (
    <Card className="overflow-hidden">
      <div className={`flex items-start gap-4 px-5 py-5 sm:px-6 ${overdue ? "bg-red-50" : "bg-emerald-50/60"}`}>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            overdue ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {overdue ? <AlertTriangleIcon className="size-5" /> : <CheckCircleIcon className="size-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            {overdue ? "Response target passed" : "Sent for validation"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {overdue
              ? `${hrContactName} hasn't responded by the response target yet.`
              : `Share the verification link with ${hrContactName} so they can review your evidence.`}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-y border-slate-100 px-5 py-4 text-sm sm:px-6">
        <div>
          <dt className="text-slate-500">Submitted</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{submittedAt}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Response target</dt>
          <dd className={`mt-0.5 font-semibold ${overdue ? "text-red-700" : "text-slate-900"}`}>{responseDueAt}</dd>
        </div>
      </dl>

      <div className="space-y-3 px-5 py-5 sm:px-6">
        <h3 className="text-sm font-semibold text-slate-900">Verification link</h3>
        {error && <Alert tone="error" role="alert">{error}</Alert>}

        {link ? (
          <>
            <CopyField value={link} label="Verification link" />
            <p className="text-xs leading-5 text-slate-500">{COPY.hrLinkWarning}</p>
          </>
        ) : (
          <p className="text-sm leading-6 text-slate-600">
            For security, ExitProof shows a verification link only right after it&apos;s created. If you need to share it
            again, create a new link. Any earlier link will stop working.
          </p>
        )}

        {confirming ? (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-950">Create a new link? The current link will stop working.</p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={button.secondary}>
                Cancel
              </button>
              <button type="button" onClick={onRegenerate} disabled={pending} className={button.primary}>
                {pending && <Spinner />}
                Create new link
              </button>
            </div>
          </div>
        ) : link ? (
          <button type="button" onClick={() => setConfirming(true)} className={button.link}>
            <RefreshIcon className="size-4" />
            Create a new link
          </button>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={button.secondary}>
            <RefreshIcon className="size-4" />
            Create new verification link
          </button>
        )}
      </div>
    </Card>
  );
}
