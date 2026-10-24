"use server";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createVerifyToken, verifyUrl } from "@/lib/tokens";
import { isUuid } from "@/lib/validation";

export type EvidenceFileInput = { path: string; name: string };
export type LinkResult = { ok: true; submissionId: string; verifyUrl: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

// Database function errors → friendly messages. Codes come from the migrations.
const ERRORS: Record<string, string> = {
  not_authenticated: "Your session has expired. Please log in again.",
  item_not_found: "This item could not be found.",
  item_not_submittable: "This item can't be sent right now. Refresh the page to see its latest status.",
  item_not_awaiting_validation: "This item is no longer waiting for HR.",
  item_not_awaiting_confirmation: "This item is no longer waiting for your confirmation.",
  wrong_workflow: "This action isn't available for this item.",
  evidence_required: "Add a note or attach at least one file so HR has something to review.",
  request_note_required: "Tell HR what you are requesting.",
  request_files_not_allowed: "Requests don't take attachments. HR will upload the document.",
  too_many_files: "You can attach up to 5 files.",
  invalid_file_path: "One of your files did not upload correctly. Remove it and try again.",
  file_not_found: "One of your files did not upload correctly. Remove it and try again.",
  evidence_files_mime_type_check: "Only PDF, PNG, JPG or WEBP files are accepted.",
  evidence_files_size_bytes_check: "Each file must be 10 MB or smaller.",
};

function friendly(message: string | undefined): string {
  const code = Object.keys(ERRORS).find((k) => message?.includes(k));
  return code ? ERRORS[code] : "Something went wrong. Please try again.";
}

// Starts a round (validation evidence or a request to HR) via submit_exit_item,
// which checks ownership, the item's workflow and status, and every file path.
async function startRound(itemId: string, note: string, files: EvidenceFileInput[]): Promise<LinkResult> {
  const { token, hash } = createVerifyToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_exit_item", {
    p_item_id: itemId,
    p_note: note,
    p_token_hash: hash,
    p_files: files.map((f) => ({ path: f.path, name: f.name.slice(0, 255) })),
  });
  if (error || typeof data !== "string") return { ok: false, error: friendly(error?.message) };

  return { ok: true, submissionId: data, verifyUrl: verifyUrl(token) };
}

// Validation workflow: submit or resubmit evidence.
export async function submitEvidence(input: {
  itemId: string;
  note: string;
  files: EvidenceFileInput[];
}): Promise<LinkResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: ERRORS.not_authenticated };

  const note = typeof input.note === "string" ? input.note.trim() : "";
  const files = Array.isArray(input.files) ? input.files : [];
  if (!isUuid(input.itemId)) return { ok: false, error: ERRORS.item_not_found };
  if (note.length > 5000) return { ok: false, error: "Your note must be 5,000 characters or fewer." };
  if (files.length > 5) return { ok: false, error: ERRORS.too_many_files };
  if (files.some((f) => typeof f?.path !== "string" || typeof f?.name !== "string" || f.path.length > 500)) {
    return { ok: false, error: ERRORS.invalid_file_path };
  }

  return startRound(input.itemId, note, files);
}

// Request workflow: ask HR for the document (first request or a re-request
// after HR responded). Always a new submission, token and response target.
export async function sendRequest(input: { itemId: string; note: string }): Promise<LinkResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: ERRORS.not_authenticated };

  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (!isUuid(input.itemId)) return { ok: false, error: ERRORS.item_not_found };
  if (!note) return { ok: false, error: ERRORS.request_note_required };
  if (note.length > 5000) return { ok: false, error: "Your request must be 5,000 characters or fewer." };

  return startRound(input.itemId, note, []);
}

export async function regenerateLink(input: { itemId: string; submissionId: string }): Promise<LinkResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: ERRORS.not_authenticated };
  if (!isUuid(input.itemId) || !isUuid(input.submissionId)) return { ok: false, error: ERRORS.item_not_found };

  const { token, hash } = createVerifyToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_verify_link", {
    p_item_id: input.itemId,
    p_token_hash: hash,
  });
  if (error) return { ok: false, error: friendly(error.message) };

  return { ok: true, submissionId: input.submissionId, verifyUrl: verifyUrl(token) };
}

// Request workflow: the employee confirms they received HR's document. Final.
export async function confirmReceived(input: { itemId: string }): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: ERRORS.not_authenticated };
  if (!isUuid(input.itemId)) return { ok: false, error: ERRORS.item_not_found };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_received", { p_item_id: input.itemId });
  if (error) return { ok: false, error: friendly(error.message) };

  return { ok: true };
}
