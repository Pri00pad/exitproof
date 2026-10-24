"use server";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createVerifyToken, verifyUrl } from "@/lib/tokens";
import { isUuid } from "@/lib/validation";

export type EvidenceFileInput = { path: string; name: string };
export type LinkResult = { ok: true; submissionId: string; verifyUrl: string } | { ok: false; error: string };

// Database function errors → friendly messages. Codes come from the migration.
const ERRORS: Record<string, string> = {
  not_authenticated: "Your session has expired. Please log in again.",
  item_not_found: "This item could not be found.",
  item_not_submittable: "This item has already been sent for validation.",
  item_not_awaiting_validation: "This item is no longer awaiting validation.",
  evidence_required: "Add a note or attach at least one file so HR has something to review.",
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

  // Ownership, file paths and storage metadata are re-checked inside the function.
  const { token, hash } = createVerifyToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_exit_item", {
    p_item_id: input.itemId,
    p_note: note,
    p_token_hash: hash,
    p_files: files.map((f) => ({ path: f.path, name: f.name.slice(0, 255) })),
  });
  if (error || typeof data !== "string") return { ok: false, error: friendly(error?.message) };

  return { ok: true, submissionId: data, verifyUrl: verifyUrl(token) };
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
