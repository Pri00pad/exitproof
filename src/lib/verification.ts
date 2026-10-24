import "server-only";
import { createAdminClient } from "./supabase/admin";
import { hashVerifyToken } from "./tokens";

// HR verification lookup. Runs only on the server with the secret key, because
// the verifier has no session. The raw token is hashed immediately and never
// stored or logged.

export const SIGNED_URL_SECONDS = 600; // ~10 minutes

export type VerifierFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  viewUrl: string | null;
  downloadUrl: string | null;
};

export type VerificationRequest = {
  employeeName: string;
  companyName: string;
  itemTitle: string;
  submittedAt: string;
  responseDueAt: string;
  note: string;
  files: VerifierFile[];
};

export type VerificationLookup =
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "reviewed" }
  | { state: "not_current" }
  | { state: "ready"; request: VerificationRequest };

// Tokens are 32 random bytes, base64url → 43 chars. Anything else is rejected
// without touching the database.
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

type SubmissionRow = {
  id: string;
  note: string;
  submitted_at: string;
  response_due_at: string;
  verify_token_expires_at: string;
  decision: string | null;
  evidence_files: { id: string; original_name: string; mime_type: string; size_bytes: number; storage_path: string }[];
  item: {
    title: string;
    status: string;
    current_submission_id: string | null;
    exit_case: { employee_name: string; company_name: string } | null;
  } | null;
};

export async function loadVerification(token: string): Promise<VerificationLookup> {
  if (!isWellFormedToken(token)) return { state: "invalid" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select(
      "id, note, submitted_at, response_due_at, verify_token_expires_at, decision, " +
        "evidence_files(id, original_name, mime_type, size_bytes, storage_path), " +
        "item:exit_items!submissions_item_id_fkey(title, status, current_submission_id, exit_case:exit_cases(employee_name, company_name))",
    )
    .eq("verify_token_hash", hashVerifyToken(token))
    .maybeSingle();
  if (error) throw new Error("Could not load this verification request.");

  const sub = data as unknown as SubmissionRow | null;
  // Order matters: a decided link should say "already reviewed" even after expiry.
  if (!sub || !sub.item || !sub.item.exit_case) return { state: "invalid" };
  if (sub.decision) return { state: "reviewed" };
  if (new Date(sub.verify_token_expires_at) < new Date()) return { state: "expired" };
  if (sub.item.current_submission_id !== sub.id || sub.item.status !== "awaiting_validation") {
    return { state: "not_current" };
  }

  const files = await signFiles(admin, sub.evidence_files);
  return {
    state: "ready",
    request: {
      employeeName: sub.item.exit_case.employee_name,
      companyName: sub.item.exit_case.company_name,
      itemTitle: sub.item.title,
      submittedAt: sub.submitted_at,
      responseDueAt: sub.response_due_at,
      note: sub.note,
      files,
    },
  };
}

// Short-lived signed URLs; the bucket stays private. The signed URL contains the
// object path ({user_id}/{item_id}/{uuid}.ext — ids only, no secrets) and expires.
async function signFiles(
  admin: ReturnType<typeof createAdminClient>,
  rows: SubmissionRow["evidence_files"],
): Promise<VerifierFile[]> {
  const bucket = admin.storage.from("evidence");
  return Promise.all(
    rows.map(async (f) => {
      const [view, download] = await Promise.all([
        bucket.createSignedUrl(f.storage_path, SIGNED_URL_SECONDS),
        bucket.createSignedUrl(f.storage_path, SIGNED_URL_SECONDS, { download: f.original_name }),
      ]);
      return {
        id: f.id,
        name: f.original_name,
        mimeType: f.mime_type,
        sizeBytes: f.size_bytes,
        viewUrl: view.data?.signedUrl ?? null,
        downloadUrl: download.data?.signedUrl ?? null,
      };
    }),
  );
}
