import type { StoredStatus } from "./status";

// Row shapes as selected by the app (no generated Supabase types yet).

export type ExitCaseRow = {
  id: string;
  employee_name: string;
  company_name: string;
  hr_contact_name: string;
  hr_contact_email: string | null;
  last_working_day: string | null;
  response_days: number;
};

export type DashboardItemRow = {
  id: string;
  title: string;
  status: StoredStatus;
  sort_order: number;
  current: { submitted_at: string; response_due_at: string; hr_comment: string | null } | null;
};

export type EvidenceFileRow = {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
};

export type ItemDetailRow = {
  id: string;
  title: string;
  status: StoredStatus;
  current: {
    id: string;
    note: string;
    submitted_at: string;
    response_due_at: string;
    decided_at: string | null;
    hr_comment: string | null;
    evidence_files: EvidenceFileRow[];
  } | null;
};
