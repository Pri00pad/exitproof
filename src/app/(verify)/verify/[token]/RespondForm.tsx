"use client";

import { useState, type FormEvent } from "react";
import { FilePicker } from "@/components/FilePicker";
import { CheckCircleIcon, SendIcon } from "@/components/icons";
import { Alert, Spinner, button, inputClass } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { createSessionlessClient } from "@/lib/supabase/browser";
import { prepareHrUpload, sendToEmployee, type ClosedState } from "./actions";
import { ClosedNotice } from "./ClosedNotice";

const MAX_COMMENT = 2000;

type Phase = "idle" | "uploading" | "sending";

// Request workflow: HR attaches 1–5 documents (and an optional comment) and
// sends them to the employee. Files go straight from this browser to the
// private 'hr-documents' bucket using server-issued signed upload tokens.
export function RespondForm({ token }: { token: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [done, setDone] = useState(false);
  const [closed, setClosed] = useState<ClosedState | null>(null);
  const busy = phase !== "idle";

  function fail(message: string, closedState?: ClosedState) {
    setPhase("idle");
    if (closedState) setClosed(closedState);
    else setError(message);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) {
      setError("Attach the requested document before sending.");
      return;
    }

    // 1. Server validates the link and issues one signed upload slot per file.
    setPhase("uploading");
    const prepared = await prepareHrUpload({
      token,
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    });
    if (!prepared.ok) return fail(prepared.error, prepared.closed);

    // 2. Upload directly to Storage (private bucket) with each signed token.
    const storage = createSessionlessClient().storage.from("hr-documents");
    for (const [i, file] of files.entries()) {
      const slot = prepared.slots[i];
      const { error: uploadError } = await storage.uploadToSignedUrl(slot.path, slot.uploadToken, file, {
        contentType: file.type,
      });
      if (uploadError) return fail(`We couldn't upload ${file.name}. Check your connection and try again.`);
    }

    // 3. Record the response; the server re-checks the link and every path.
    setPhase("sending");
    const result = await sendToEmployee({
      token,
      comment,
      files: prepared.slots.map((slot, i) => ({ path: slot.path, name: files[i].name })),
    });
    if (!result.ok) return fail(result.error, result.closed);
    setPhase("idle");
    setDone(true);
  }

  if (closed) {
    return (
      <div className="border-t border-slate-100 p-4 sm:p-6">
        <ClosedNotice state={closed} />
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className="border-t border-slate-100 px-5 py-8 text-center sm:px-6">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircleIcon className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Response sent</h2>
        <p className="mt-1 text-sm text-slate-600">The requested document is now available to the employee.</p>
        <p className="mt-4 text-xs text-slate-500">You can close this page. This link can&apos;t be used again.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
      <h2 className="text-sm font-semibold text-slate-900">Your response</h2>
      {error && <Alert tone="error" role="alert">{error}</Alert>}

      <FilePicker
        label="Requested document"
        hint={COPY.hrUploadHint}
        inputLabel="Choose documents to send"
        files={files}
        onChange={setFiles}
        onProblem={setError}
        disabled={busy}
      />

      <label className="block">
        <span className="text-sm font-medium text-slate-800">Comment (optional)</span>
        <textarea
          name="comment"
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy}
          placeholder="For example: Signed copy attached. The original will be couriered."
          className={`mt-1.5 ${inputClass}`}
        />
        <span className="mt-1.5 block text-xs text-slate-500">The employee will see it with the document.</span>
      </label>

      <button type="submit" disabled={busy} className={`${button.primary} w-full sm:w-auto`}>
        {busy ? <Spinner /> : <SendIcon className="size-4" />}
        {phase === "uploading" ? "Uploading…" : phase === "sending" ? "Sending…" : "Send to Employee"}
      </button>
    </form>
  );
}
