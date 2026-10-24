"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "@/components/icons";
import { Alert, Card, Spinner, button, inputClass } from "@/components/ui";
import { saveVerifyLink } from "@/lib/verify-link-storage";
import { sendRequest } from "./actions";

const MAX_NOTE = 5000;

type Mode = "first" | "again";

const MODE_COPY: Record<Mode, { heading: string; intro: string; cta: string; placeholder: string }> = {
  first: {
    heading: "Request from HR",
    intro: "Tell HR what you need. ExitProof creates a private link for your HR contact to respond and upload the document.",
    cta: "Send Request to HR",
    placeholder: "For example: Please issue my relieving and experience letter. My last working day was 31 Oct.",
  },
  again: {
    heading: "Request again",
    intro: "Explain what is incorrect or missing. This creates a new request and a new private link; the previous link stays closed.",
    cta: "Send New Request",
    placeholder: "For example: The letter shows the wrong last working day. It should be 31 Oct.",
  },
};

// Request workflow: the employee sends a note; HR provides the document.
// No uploads here — the employee asks, HR attaches.
export function RequestForm({ itemId, mode, onCancel }: { itemId: string; mode: Mode; onCancel?: () => void }) {
  const copy = MODE_COPY[mode];
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!note.trim()) {
      setError("Tell HR what you are requesting.");
      return;
    }
    setPending(true);
    const result = await sendRequest({ itemId, note });
    if (!result.ok) {
      setPending(false);
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
          <span className="text-sm font-medium text-slate-800">Your request</span>
          <textarea
            name="note"
            rows={4}
            required
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            placeholder={copy.placeholder}
            className={`mt-1.5 ${inputClass}`}
          />
          <span className="mt-1.5 flex justify-between text-xs text-slate-500">
            <span>HR sees this when they open the private link.</span>
            <span className="tabular-nums">{note.length}/{MAX_NOTE}</span>
          </span>
        </label>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
          <button type="submit" disabled={pending} className={`${button.primary} w-full sm:w-auto`}>
            {pending ? <Spinner /> : <SendIcon className="size-4" />}
            {pending ? "Sending…" : copy.cta}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={pending} className={`${button.secondary} w-full sm:w-auto`}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
