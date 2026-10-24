import { DownloadIcon, FileIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";

export type HrFile = { id: string; name: string; sizeBytes: number };

// HR-provided documents. Download goes through the employee file route, which
// checks ownership and redirects to a short-lived signed URL — no public URLs.
export function HrFileList({ caseId, itemId, files }: { caseId: string; itemId: string; files: HrFile[] }) {
  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <FileIcon className="size-4 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-slate-800" title={file.name}>{file.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{formatBytes(file.sizeBytes)}</span>
          </span>
          {/* Plain anchor: a route handler response must not be prefetched. */}
          <a
            href={`/cases/${caseId}/items/${itemId}/files/${file.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 pl-6 text-sm font-semibold text-blue-700 hover:underline sm:pl-0"
          >
            <DownloadIcon className="size-4" />
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}
