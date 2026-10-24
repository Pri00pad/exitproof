"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, DownloadIcon, RefreshIcon } from "@/components/icons";
import { Alert, Card, Spinner, button } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { confirmReceived } from "./actions";
import { HrFileList, type HrFile } from "./HrFileList";
import { RequestForm } from "./RequestForm";

// Request workflow: HR has sent the document (hr_responded) or the employee has
// confirmed receipt (completed, final).
export function HrResponsePanel({
  caseId,
  itemId,
  completed,
  respondedAt,
  comment,
  files,
}: {
  caseId: string;
  itemId: string;
  completed: boolean;
  respondedAt: string | null;
  comment: string | null;
  files: HrFile[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [requestingAgain, setRequestingAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setPending(true);
    setError(null);
    const result = await confirmReceived({ itemId });
    if (!result.ok) {
      setPending(false);
      setConfirming(false);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (requestingAgain) {
    return <RequestForm itemId={itemId} mode="again" onCancel={() => setRequestingAgain(false)} />;
  }

  return (
    <Card className="overflow-hidden">
      <div className={`flex items-start gap-4 px-5 py-5 sm:px-6 ${completed ? "bg-emerald-50/60" : "bg-violet-50/60"}`}>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            completed ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
          }`}
        >
          {completed ? <CheckCircleIcon className="size-5" /> : <DownloadIcon className="size-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{completed ? "Completed" : "Document Available"}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {completed
              ? "You confirmed that you received the document."
              : `${COPY.providedVia}${respondedAt ? ` on ${respondedAt}` : ""}. Download it and check it before you confirm.`}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {error && <Alert tone="error" role="alert">{error}</Alert>}
        {comment && (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 whitespace-pre-line text-slate-700">
            <span className="font-medium">HR comment:</span> {comment}
          </p>
        )}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">{files.length === 1 ? "Document" : "Documents"}</h3>
          <HrFileList caseId={caseId} itemId={itemId} files={files} />
          <p className="mt-2 text-xs text-slate-500">Downloads use a private link that expires after a minute.</p>
        </div>
      </div>

      {!completed && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
          {confirming ? (
            <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-950">
                Confirm you received the correct document? This marks the item Completed and can&apos;t be undone.
              </p>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={button.secondary}>
                  Cancel
                </button>
                <button type="button" onClick={onConfirm} disabled={pending} className={button.success}>
                  {pending && <Spinner />}
                  Yes, confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setConfirming(true)} className={`${button.success} w-full sm:w-auto`}>
                <CheckCircleIcon className="size-4" />
                Confirm Received
              </button>
              <button type="button" onClick={() => setRequestingAgain(true)} className={button.link}>
                <RefreshIcon className="size-4" />
                Document incorrect or incomplete? Request again
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
