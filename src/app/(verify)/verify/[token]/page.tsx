import { FileIcon, InfoCircleIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { formatBytes, formatDate } from "@/lib/format";
import { loadVerification, type VerifierFile } from "@/lib/verification";
import { ClosedNotice } from "./ClosedNotice";
import { DecisionForm } from "./DecisionForm";

// Screen 4 — HR Verification. No login: possession of the link is the only
// credential (accepted MVP limitation). All lookups use the server-only secret key.
export default async function VerifyPage({ params }: PageProps<"/verify/[token]">) {
  const { token } = await params;
  const result = await loadVerification(token);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      {result.state !== "ready" ? (
        <ClosedNotice state={result.state} />
      ) : (
        <>
          <header className="mb-6">
            <p className="text-sm font-medium text-blue-700">ExitProof Verification</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance text-slate-900 sm:text-3xl">
              {result.request.itemTitle}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {result.request.employeeName} has asked you to review this exit item and record a decision.
            </p>
          </header>

          <div role="note" className="mb-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xs">
            <InfoCircleIcon className="mt-0.5 size-4 text-blue-600" />
            <p>{COPY.verifyPageNotice}</p>
          </div>

          <Card>
            <dl className="grid gap-4 px-5 py-5 text-sm sm:grid-cols-2 sm:px-6">
              <Detail label="Employee" value={result.request.employeeName} />
              <Detail label="Company" value={result.request.companyName} />
              <Detail label="Exit item" value={result.request.itemTitle} />
              <Detail label="Submitted" value={formatDate(result.request.submittedAt)} />
              <Detail label="Response target" value={formatDate(result.request.responseDueAt)} />
            </dl>

            <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="text-sm font-semibold text-slate-900">Employee evidence note</h2>
              {result.request.note ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 whitespace-pre-line text-slate-700">
                  {result.request.note}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No note was added.</p>
              )}

              <h2 className="mt-6 text-sm font-semibold text-slate-900">Evidence files</h2>
              {result.request.files.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No files were attached.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {result.request.files.map((file) => (
                    <FileRow key={file.id} file={file} />
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">File links expire after about 10 minutes. Reload the page to get fresh links.</p>
            </div>

            <DecisionForm token={token} />
          </Card>
        </>
      )}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium break-words text-slate-900">{value}</dd>
    </div>
  );
}

function FileRow({ file }: { file: VerifierFile }) {
  const isImage = file.mimeType.startsWith("image/");
  return (
    <li className="overflow-hidden rounded-lg border border-slate-200">
      {isImage && file.viewUrl && (
        <a href={file.viewUrl} target="_blank" rel="noreferrer noopener" className="block bg-slate-50">
          {/* Signed Supabase URL (short-lived); next/image would proxy/cache it, which we don't want. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.viewUrl} alt={`Evidence: ${file.name}`} referrerPolicy="no-referrer" className="mx-auto max-h-72 w-auto object-contain" />
        </a>
      )}
      <div className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <FileIcon className="size-4 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-slate-800" title={file.name}>{file.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-slate-500">{formatBytes(file.sizeBytes)}</span>
        </span>
        <span className="flex shrink-0 gap-4 pl-6 sm:pl-0">
          {file.viewUrl && (
            <a href={file.viewUrl} target="_blank" rel="noreferrer noopener" className="text-sm font-semibold text-blue-700 hover:underline">
              Open
            </a>
          )}
          {file.downloadUrl && (
            <a href={file.downloadUrl} rel="noreferrer noopener" className="text-sm font-semibold text-blue-700 hover:underline">
              Download
            </a>
          )}
        </span>
      </div>
    </li>
  );
}
