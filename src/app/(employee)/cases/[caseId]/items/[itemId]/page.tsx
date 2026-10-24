import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ArrowLeftIcon, CheckCircleIcon, FileIcon } from "@/components/icons";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { COPY } from "@/lib/copy";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { displayStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { EvidenceFileRow, ItemDetailRow, SubmissionDetail } from "@/lib/types";
import { isUuid } from "@/lib/validation";
import { AwaitingPanel } from "./AwaitingPanel";
import { EvidenceForm } from "./EvidenceForm";
import { HrFileList, type HrFile } from "./HrFileList";
import { HrResponsePanel } from "./HrResponsePanel";
import { RequestForm } from "./RequestForm";

const SUBMISSION_FIELDS =
  "id, note, submitted_at, response_due_at, decided_at, hr_comment, evidence_files(id, original_name, mime_type, size_bytes, uploaded_by)";

// Screen 3 — the item page for both workflows. Loaded with the employee's
// client: RLS hides items in other people's cases, and the case_id filter
// stops ID mixing.
export default async function ItemPage({ params }: PageProps<"/cases/[caseId]/items/[itemId]">) {
  const user = await requireUser();
  const { caseId, itemId } = await params;
  if (!isUuid(caseId) || !isUuid(itemId)) notFound();

  const supabase = await createClient();
  const [{ data: exitCase }, { data: row, error }] = await Promise.all([
    supabase.from("exit_cases").select("company_name, hr_contact_name").eq("id", caseId).maybeSingle(),
    supabase
      .from("exit_items")
      .select(`id, title, status, workflow_type, current:submissions!exit_items_current_submission_fk(${SUBMISSION_FIELDS})`)
      .eq("id", itemId)
      .eq("case_id", caseId)
      .maybeSingle(),
  ]);
  if (error) throw new Error("Could not load this item.");
  if (!exitCase || !row) notFound();

  const item = row as unknown as ItemDetailRow;
  const current = item.current;
  const status = displayStatus(item.status, item.workflow_type, current ? new Date(current.response_due_at) : null);
  const isRequest = item.workflow_type === "request";

  // Request items keep earlier HR responses (from before a re-request) as history.
  let earlier: SubmissionDetail[] = [];
  if (isRequest && current) {
    const { data: rounds, error: roundsError } = await supabase
      .from("submissions")
      .select(SUBMISSION_FIELDS)
      .eq("item_id", item.id)
      .neq("id", current.id)
      .not("decided_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (roundsError) throw new Error("Could not load this item's history.");
    earlier = (rounds ?? []) as unknown as SubmissionDetail[];
  }

  return (
    <PageShell
      top={<AutoRefresh />}
      eyebrow={
        <Link href={`/cases/${caseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeftIcon className="size-4" />
          {exitCase.company_name} dashboard
        </Link>
      }
      title={item.title}
    >
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={status} size="md" />
        {isRequest && <span className="text-sm text-slate-500">{COPY.requestTag}</span>}
      </div>

      {isRequest ? (
        <div className="space-y-4">
          {item.status === "not_submitted" && <RequestForm itemId={item.id} mode="first" />}

          {current && item.status === "requested" && (
            <AwaitingPanel
              itemId={item.id}
              submissionId={current.id}
              submittedAt={formatDate(current.submitted_at)}
              responseDueAt={formatDate(current.response_due_at)}
              overdue={status === "overdue"}
              hrContactName={exitCase.hr_contact_name}
              workflow="request"
            />
          )}

          {current && (item.status === "hr_responded" || item.status === "completed") && (
            <HrResponsePanel
              caseId={caseId}
              itemId={item.id}
              completed={item.status === "completed"}
              respondedAt={current.decided_at ? formatDateTime(current.decided_at) : null}
              comment={current.hr_comment}
              files={hrFiles(current.evidence_files)}
            />
          )}

          {current && <RequestSummary submission={current} />}

          {earlier.length > 0 && <EarlierResponses caseId={caseId} itemId={item.id} rounds={earlier} />}
        </div>
      ) : (
        <ValidationItem item={item} userId={user.id} hrContactName={exitCase.hr_contact_name} overdue={status === "overdue"} />
      )}
    </PageShell>
  );
}

function hrFiles(files: EvidenceFileRow[]): HrFile[] {
  return files.filter((f) => f.uploaded_by === "hr").map((f) => ({ id: f.id, name: f.original_name, sizeBytes: f.size_bytes }));
}

// Validation workflow — unchanged behaviour from Phase 3.
function ValidationItem({
  item,
  userId,
  hrContactName,
  overdue,
}: {
  item: ItemDetailRow;
  userId: string;
  hrContactName: string;
  overdue: boolean;
}) {
  const current = item.current;
  const canSubmit = item.status === "not_submitted" || item.status === "needs_information" || item.status === "rejected";

  return (
    <div className="space-y-4">
      {item.status === "needs_information" && current?.hr_comment && (
        <Alert tone="warning" title="More information was requested">
          <span className="font-medium">Verifier comment:</span> “{current.hr_comment}”
          {current.decided_at && <span className="block text-xs opacity-80">Requested {formatDateTime(current.decided_at)}</span>}
        </Alert>
      )}
      {item.status === "rejected" && current?.hr_comment && (
        <Alert tone="error" title="This submission was rejected">
          <span className="font-medium">Reason:</span> “{current.hr_comment}”
          {current.decided_at && <span className="block text-xs opacity-80">Rejected {formatDateTime(current.decided_at)}</span>}
        </Alert>
      )}

      {item.status === "validated" && current && (
        <Card className="flex items-start gap-4 border-emerald-200 bg-emerald-50/60 px-5 py-5 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircleIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{COPY.validatedVia}</h2>
            {current.decided_at && (
              <p className="mt-0.5 text-sm text-slate-600">
                Validated on <time dateTime={current.decided_at}>{formatDateTime(current.decided_at)}</time>
              </p>
            )}
            {current.hr_comment && (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Verifier comment:</span> “{current.hr_comment}”
              </p>
            )}
          </div>
        </Card>
      )}

      {current && item.status === "awaiting_validation" && (
        <AwaitingPanel
          itemId={item.id}
          submissionId={current.id}
          submittedAt={formatDate(current.submitted_at)}
          responseDueAt={formatDate(current.response_due_at)}
          overdue={overdue}
          hrContactName={hrContactName}
          workflow="validation"
        />
      )}

      {canSubmit && (
        <EvidenceForm
          itemId={item.id}
          userId={userId}
          mode={item.status === "needs_information" ? "update" : item.status === "rejected" ? "resubmit" : "first"}
        />
      )}

      {current && <SubmissionSummary submission={current} heading={canSubmit ? "Previous submission" : "Your submission"} />}
    </div>
  );
}

function SubmissionSummary({ submission, heading }: { submission: SubmissionDetail; heading: string }) {
  const files = submission.evidence_files.filter((f) => f.uploaded_by === "employee");
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
        <p className="text-xs text-slate-500">Sent {formatDate(submission.submitted_at)}</p>
      </div>
      {submission.note ? (
        <p className="mt-3 text-sm leading-6 whitespace-pre-line text-slate-700">{submission.note}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No note was added.</p>
      )}
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <FileIcon className="size-4 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-slate-800">{file.original_name}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{formatBytes(file.size_bytes)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RequestSummary({ submission }: { submission: SubmissionDetail }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Your request</h2>
        <p className="text-xs text-slate-500">Sent {formatDate(submission.submitted_at)}</p>
      </div>
      <p className="mt-3 text-sm leading-6 whitespace-pre-line text-slate-700">{submission.note}</p>
    </Card>
  );
}

function EarlierResponses({ caseId, itemId, rounds }: { caseId: string; itemId: string; rounds: SubmissionDetail[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-slate-900">Earlier requests</h2>
      <p className="mt-0.5 text-xs text-slate-500">Kept for your records. Their private links are closed.</p>
      <ol className="mt-4 space-y-5">
        {rounds.map((round) => (
          <li key={round.id} className="space-y-2 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
            <p className="text-xs text-slate-500">
              Requested {formatDate(round.submitted_at)}
              {round.decided_at && ` · HR responded ${formatDate(round.decided_at)}`}
            </p>
            <p className="text-sm leading-6 whitespace-pre-line text-slate-700">{round.note}</p>
            {round.hr_comment && (
              <p className="text-sm text-slate-700">
                <span className="font-medium">HR comment:</span> {round.hr_comment}
              </p>
            )}
            <HrFileList caseId={caseId} itemId={itemId} files={hrFiles(round.evidence_files)} />
          </li>
        ))}
      </ol>
    </Card>
  );
}
