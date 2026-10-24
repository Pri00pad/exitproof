import type { StoredStatus, Workflow } from "./status";

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
  workflow_type: Workflow;
  sort_order: number;
  current: { submitted_at: string; response_due_at: string; hr_comment: string | null } | null;
};

export type EvidenceFileRow = {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: "employee" | "hr";
};

export type SubmissionDetail = {
  id: string;
  note: string;
  submitted_at: string;
  response_due_at: string;
  decided_at: string | null;
  hr_comment: string | null;
  evidence_files: EvidenceFileRow[];
};

export type ItemDetailRow = {
  id: string;
  title: string;
  status: StoredStatus;
  workflow_type: Workflow;
  current: SubmissionDetail | null;
};
