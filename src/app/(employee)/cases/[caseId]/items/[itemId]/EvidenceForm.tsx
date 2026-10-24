"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FilePicker } from "@/components/FilePicker";
import { Alert, Card, Spinner, button, inputClass } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { ACCEPTED_FILE_TYPES } from "@/lib/files";
import { createClient } from "@/lib/supabase/browser";
import { saveVerifyLink } from "@/lib/verify-link-storage";
import { submitEvidence, type EvidenceFileInput } from "./actions";

const MAX_NOTE = 5000;

type Phase = "idle" | "uploading" | "sending";
type Mode = "first" | "update" | "resubmit";

const MODE_COPY: Record<Mode, { heading: string; intro: string; cta: string }> = {
  first: {
    heading: "Add evidence",
    intro: "Describe what you did and attach proof, such as a handover receipt or an email screenshot.",
    cta: "Send for Validation",
  },
  update: {
    heading: "Provide updated evidence",
    intro: "Answer the verifier's comment and attach your evidence again, plus anything they asked for.",
    cta: "Provide Updated Evidence",
  },
  resubmit: {
    heading: "Resubmit evidence",
    intro: "Address the reason given and attach your evidence again. A new verification link will be created.",
    cta: "Resubmit Evidence",
  },
};

// Validation workflow: the employee submits evidence for HR to validate.
export function EvidenceForm({ itemId, userId, mode }: { itemId: string; userId: string; mode: Mode }) {
  const copy = MODE_COPY[mode];
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const busy = phase !== "idle";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!note.trim() && files.length === 0) {
      setError("Add a note or attach at least one file so HR has something to review.");
      return;
    }

    // 1. Upload straight to the private bucket as the signed-in employee
    //    (Storage RLS limits paths to {userId}/{itemId}/…).
    setPhase("uploading");
    const supabase = createClient();
    const uploaded: EvidenceFileInput[] = [];
    for (const file of files) {
      const path = `${userId}/${itemId}/${crypto.randomUUID()}.${ACCEPTED_FILE_TYPES[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from("evidence")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setPhase("idle");
        setError(`We couldn't upload ${file.name}. Check your connection and try again.`);
        return;
      }
      uploaded.push({ path, name: file.name });
    }

    // 2. Record the submission and get the one-time HR link.
    setPhase("sending");
    const result = await submitEvidence({ itemId, note, files: uploaded });
    if (!result.ok) {
      setPhase("idle");
      setError(result.error);
      return;
    }
    saveVerifyLink(result.submissionId, result.verifyUrl);
    router.refresh();
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{copy.heading}</h2>
          <p className="mt-0.5 text-sm text-slate-600">{copy.intro}</p>
        </div>

        {error && <Alert tone="error" role="alert">{error}</Alert>}

        <label className="block">
          <span className="text-sm font-medium text-slate-800">Evidence note</span>
          <textarea
            name="note"
            rows={4}
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            placeholder="For example: Laptop handed to the IT desk on 22 Oct, asset tag NL-0417."
            className={`mt-1.5 ${inputClass}`}
          />
          <span className="mt-1.5 flex justify-between text-xs text-slate-500">
            <span>What HR should know when reviewing this item.</span>
            <span className="tabular-nums">{note.length}/{MAX_NOTE}</span>
          </span>
        </label>

        <FilePicker
          label="Evidence files"
          hint={COPY.uploadHint}
          inputLabel="Choose evidence files"
          files={files}
          onChange={setFiles}
          onProblem={setError}
          disabled={busy}
        />

        <div className="border-t border-slate-100 pt-5">
          <button type="submit" disabled={busy} className={`${button.primary} w-full sm:w-auto`}>
            {busy && <Spinner />}
            {phase === "uploading" ? "Uploading files…" : phase === "sending" ? "Sending…" : copy.cta}
          </button>
        </div>
      </form>
    </Card>
  );
}
