"use server";

import { ACCEPTED_FILE_TYPES, MAX_FILES, MAX_FILE_BYTES } from "@/lib/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashVerifyToken } from "@/lib/tokens";
import { isWellFormedToken, resolveToken, type ClosedState } from "@/lib/verification";

export type { ClosedState };
export type Decision = "approved" | "info_requested" | "rejected";
export type DecisionResult =
  | { ok: true; decision: Decision }
  | { ok: false; error: string; closed?: ClosedState };

const DECISIONS: readonly Decision[] = ["approved", "info_requested", "rejected"];
const MAX_COMMENT = 2000;

// hr_decide / hr_respond errors (see migrations) → verifier-safe outcomes.
const CLOSED: Record<string, ClosedState> = {
  invalid_token: "invalid",
  token_expired: "expired",
  already_decided: "reviewed",
  submission_not_current: "not_current",
  wrong_workflow: "not_current",
};

function closedFrom(message: string): ClosedState | undefined {
  const code = Object.keys(CLOSED).find((k) => message.includes(k));
  return code ? CLOSED[code] : undefined;
}

// Validation workflow. The only caller of hr_decide. The browser sends the
// token from the URL; the server hashes it and calls the service-role-only function.
export async function recordDecision(input: { token: string; decision: Decision; comment: string }): Promise<DecisionResult> {
  const decision = input.decision;
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";

  if (!DECISIONS.includes(decision)) return { ok: false, error: "Choose Approve, Request More Information or Reject." };
  if (typeof input.token !== "string" || !isWellFormedToken(input.token)) {
    return { ok: false, error: "This verification link is not valid.", closed: "invalid" };
  }
  if (decision !== "approved" && !comment) {
    return {
      ok: false,
      error: decision === "rejected" ? "Add a reason so the employee knows why." : "Tell the employee what information you need.",
    };
  }
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Comments must be ${MAX_COMMENT} characters or fewer.` };

  const admin = createAdminClient();
  const { error } = await admin.rpc("hr_decide", {
    p_token_hash: hashVerifyToken(input.token),
    p_decision: decision,
    p_comment: comment || null,
  });

  if (error) {
    const closed = closedFrom(error.message);
    if (closed) return { ok: false, error: "This request can no longer be reviewed.", closed };
    if (error.message.includes("comment_required")) return { ok: false, error: "A comment is required for this decision." };
    return { ok: false, error: "We couldn't record your decision. Please try again." };
  }

  return { ok: true, decision };
}

// ---------------------------------------------------------------------------
// Request workflow: HR sends the requested document(s).
// 1. prepareHrUpload — validates the token, then (secret key, server only)
//    creates one signed upload URL per file for a path it derives from the
//    token's own submission: {owner}/{item}/{submission}/{uuid}.{ext}.
// 2. The browser uploads each file straight to the private 'hr-documents'
//    bucket with that signed token — the bytes never pass through this server.
// 3. sendToEmployee — calls hr_respond, which re-checks the token and that
//    every path is inside this submission's folder and exists in Storage.
// ---------------------------------------------------------------------------

export type UploadSlot = { path: string; uploadToken: string };
export type PrepareResult = { ok: true; slots: UploadSlot[] } | { ok: false; error: string; closed?: ClosedState };
export type RespondResult = { ok: true } | { ok: false; error: string; closed?: ClosedState };

// Upload slots one request link can ever be issued (abandoned uploads included).
const MAX_OBJECTS_PER_ROUND = 20;

type FileMeta = { name: string; type: string; size: number };

function checkFiles(files: unknown): string | null {
  if (!Array.isArray(files) || files.length === 0) return "Attach at least one document.";
  if (files.length > MAX_FILES) return `You can attach up to ${MAX_FILES} files.`;
  for (const f of files as FileMeta[]) {
    if (typeof f?.name !== "string" || !f.name.trim() || f.name.length > 255) return "One of the file names isn't valid.";
    if (!ACCEPTED_FILE_TYPES[f.type]) return `${f.name} isn't a PDF, PNG, JPG or WEBP file.`;
    if (typeof f.size !== "number" || f.size <= 0 || f.size > MAX_FILE_BYTES) return `${f.name} must be between 1 byte and 10 MB.`;
  }
  return null;
}

export async function prepareHrUpload(input: { token: string; files: FileMeta[] }): Promise<PrepareResult> {
  if (typeof input.token !== "string" || !isWellFormedToken(input.token)) {
    return { ok: false, error: "This link is not valid.", closed: "invalid" };
  }
  const problem = checkFiles(input.files);
  if (problem) return { ok: false, error: problem };

  const admin = createAdminClient();
  const resolved = await resolveToken(admin, input.token);
  if (resolved.state !== "ready") return { ok: false, error: "This request can no longer be answered.", closed: resolved.state };
  const { sub } = resolved;
  if (sub.item.workflow_type !== "request") return { ok: false, error: "This link is not a document request.", closed: "not_current" };

  const folder = `${sub.item.exit_case!.owner_user_id}/${sub.item.id}/${sub.id}`;
  const bucket = admin.storage.from("hr-documents");

  const { data: existing, error: listError } = await bucket.list(folder, { limit: MAX_OBJECTS_PER_ROUND + 1 });
  if (listError) return { ok: false, error: "We couldn't prepare the upload. Please try again." };
  if ((existing?.length ?? 0) + input.files.length > MAX_OBJECTS_PER_ROUND) {
    return { ok: false, error: "Too many upload attempts for this request. Ask the employee for a new link." };
  }

  const slots: UploadSlot[] = [];
  for (const f of input.files) {
    const path = `${folder}/${crypto.randomUUID()}.${ACCEPTED_FILE_TYPES[f.type]}`;
    const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });
    if (error || !data) return { ok: false, error: "We couldn't prepare the upload. Please try again." };
    slots.push({ path: data.path, uploadToken: data.token });
  }
  return { ok: true, slots };
}

export async function sendToEmployee(input: {
  token: string;
  comment: string;
  files: { path: string; name: string }[];
}): Promise<RespondResult> {
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (typeof input.token !== "string" || !isWellFormedToken(input.token)) {
    return { ok: false, error: "This link is not valid.", closed: "invalid" };
  }
  if (comment.length > MAX_COMMENT) return { ok: false, error: `Comments must be ${MAX_COMMENT} characters or fewer.` };
  const files = Array.isArray(input.files) ? input.files : [];
  if (files.length === 0) return { ok: false, error: "Attach at least one document." };
  if (files.length > MAX_FILES) return { ok: false, error: `You can attach up to ${MAX_FILES} files.` };
  if (files.some((f) => typeof f?.path !== "string" || typeof f?.name !== "string" || f.path.length > 500)) {
    return { ok: false, error: "One of the files didn't upload correctly. Remove it and try again." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("hr_respond", {
    p_token_hash: hashVerifyToken(input.token),
    p_comment: comment || null,
    p_files: files.map((f) => ({ path: f.path, name: f.name.slice(0, 255) })),
  });

  if (error) {
    const closed = closedFrom(error.message);
    if (closed) return { ok: false, error: "This request can no longer be answered.", closed: closed === "reviewed" ? "responded" : closed };
    if (error.message.includes("document_required")) return { ok: false, error: "Attach at least one document." };
    if (/invalid_file_path|file_not_found/.test(error.message)) {
      return { ok: false, error: "One of the files didn't finish uploading. Please try again." };
    }
    if (error.message.includes("mime_type_check")) return { ok: false, error: "Only PDF, PNG, JPG or WEBP files are accepted." };
    if (error.message.includes("size_bytes_check")) return { ok: false, error: "Each file must be 10 MB or smaller." };
    return { ok: false, error: "We couldn't send your response. Please try again." };
  }

  return { ok: true };
}
