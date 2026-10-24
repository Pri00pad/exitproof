import "server-only";
import type { Workflow } from "./status";
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
  workflow: Workflow;
  employeeName: string;
  companyName: string;
  itemTitle: string;
  submittedAt: string;
  responseDueAt: string;
  note: string;
  files: VerifierFile[];
};

export type ClosedState = "invalid" | "expired" | "reviewed" | "responded" | "not_current";

// workflow is included on closed states when the link matched a submission
// (display only: it picks the page header label). Unknown links have none.
export type VerificationLookup =
  | { state: ClosedState; workflow?: Workflow }
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
  evidence_files: {
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    storage_bucket: string;
    storage_path: string;
    uploaded_by: string;
  }[];
  item: {
    id: string;
    title: string;
    status: string;
    workflow_type: Workflow;
    current_submission_id: string | null;
    exit_case: { owner_user_id: string; employee_name: string; company_name: string } | null;
  } | null;
};

type Admin = ReturnType<typeof createAdminClient>;

// The one place a token is resolved to a submission. Returns the row only if
// the link may still act: right hash, not decided, not expired, and still the
// item's current round in the status its workflow expects.
export async function resolveToken(
  admin: Admin,
  token: string,
): Promise<
  | { state: ClosedState; workflow?: Workflow }
  | { state: "ready"; sub: SubmissionRow & { item: NonNullable<SubmissionRow["item"]> } }
> {
  if (!isWellFormedToken(token)) return { state: "invalid" };

  const { data, error } = await admin
    .from("submissions")
    .select(
      "id, note, submitted_at, response_due_at, verify_token_expires_at, decision, " +
        "evidence_files(id, original_name, mime_type, size_bytes, storage_bucket, storage_path, uploaded_by), " +
        "item:exit_items!submissions_item_id_fkey(id, title, status, workflow_type, current_submission_id, " +
        "exit_case:exit_cases(owner_user_id, employee_name, company_name))",
    )
    .eq("verify_token_hash", hashVerifyToken(token))
    .maybeSingle();
  if (error) throw new Error("Could not load this verification request.");

  const sub = data as unknown as SubmissionRow | null;
  // Order matters: a decided link should say so even after expiry.
  if (!sub || !sub.item || !sub.item.exit_case) return { state: "invalid" };
  const workflow = sub.item.workflow_type;
  if (sub.decision === "responded") return { state: "responded", workflow };
  if (sub.decision) return { state: "reviewed", workflow };
  if (new Date(sub.verify_token_expires_at) < new Date()) return { state: "expired", workflow };
  const waitingStatus = workflow === "request" ? "requested" : "awaiting_validation";
  if (sub.item.current_submission_id !== sub.id || sub.item.status !== waitingStatus) return { state: "not_current", workflow };

  return { state: "ready", sub: { ...sub, item: sub.item } };
}

export async function loadVerification(token: string): Promise<VerificationLookup> {
  const admin = createAdminClient();
  const resolved = await resolveToken(admin, token);
  if (resolved.state !== "ready") return resolved;

  const { sub } = resolved;
  // The verifier only ever sees the employee's own evidence.
  const files = await signFiles(admin, sub.evidence_files.filter((f) => f.uploaded_by === "employee"));
  return {
    state: "ready",
    request: {
      workflow: sub.item.workflow_type,
      employeeName: sub.item.exit_case!.employee_name,
      companyName: sub.item.exit_case!.company_name,
      itemTitle: sub.item.title,
      submittedAt: sub.submitted_at,
      responseDueAt: sub.response_due_at,
      note: sub.note,
      files,
    },
  };
}

// Short-lived signed URLs; the buckets stay private. Each file is signed from
// its own row's bucket and path. The signed URL contains the object path
// ({user_id}/{item_id}/{uuid}.ext — ids only, no secrets) and expires.
async function signFiles(admin: Admin, rows: SubmissionRow["evidence_files"]): Promise<VerifierFile[]> {
  return Promise.all(
    rows.map(async (f) => {
      const bucket = admin.storage.from(f.storage_bucket);
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
