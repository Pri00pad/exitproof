// Upload rules shared by the browser pickers and the server actions. Must match
// the 'evidence' and 'hr-documents' bucket allowlists (see migrations).

export const ACCEPTED_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

// The only private buckets a file row may point at (evidence_files.storage_bucket).
export const FILE_BUCKETS = ["evidence", "hr-documents"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];

export function isFileBucket(value: string): value is FileBucket {
  return (FILE_BUCKETS as readonly string[]).includes(value);
}
