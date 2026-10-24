"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileIcon, UploadIcon, XIcon } from "@/components/icons";
import { Alert, Card, Spinner, button, inputClass } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { formatBytes } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import { saveVerifyLink } from "@/lib/verify-link-storage";
import { submitEvidence, type EvidenceFileInput } from "./actions";

// Must match the evidence bucket's allowlist (see migration).
const ACCEPTED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
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

export function EvidenceForm({ itemId, userId, mode }: { itemId: string; userId: string; mode: Mode }) {
  const copy = MODE_COPY[mode];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const busy = phase !== "idle";

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED[file.type]) {
        problems.push(`${file.name} isn't a PDF, PNG, JPG or WEBP file.`);
      } else if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 10 MB.`);
      } else if (file.size === 0) {
        problems.push(`${file.name} is empty.`);
      } else if (next.length >= MAX_FILES) {
        problems.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      } else if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    setFiles(next);
    setError(problems.length ? problems.join(" ") : null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy) addFiles(e.dataTransfer.files);
  }

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
      const path = `${userId}/${itemId}/${crypto.randomUUID()}.${ACCEPTED[file.type]}`;
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

        <div>
          <span className="text-sm font-medium text-slate-800">Evidence files</span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-slate-50/70"
            }`}
          >
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
              <UploadIcon className="size-5" />
            </span>
            <p className="mt-3 text-sm text-slate-700">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy || files.length >= MAX_FILES}
                className={button.link}
              >
                Choose files
              </button>{" "}
              <span className="hidden sm:inline">or drag and drop them here</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG or WEBP · up to 10 MB each · max {MAX_FILES} files</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              tabIndex={-1}
              aria-label="Choose evidence files"
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{COPY.uploadHint}</p>

          {files.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 px-3 py-2.5">
                  <FileIcon className="size-4 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{file.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    disabled={busy}
                    aria-label={`Remove ${file.name}`}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    <XIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
