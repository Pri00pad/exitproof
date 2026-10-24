// Statuses stored in exit_items.status. "overdue" is never stored — it is
// derived from awaiting_validation + response_due_at (see displayStatus).
export const STORED_STATUSES = [
  "not_submitted",
  "awaiting_validation",
  "validated",
  "needs_information",
  "rejected",
] as const;

export type StoredStatus = (typeof STORED_STATUSES)[number];
export type DisplayStatus = StoredStatus | "overdue";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  not_submitted: "Not Submitted",
  awaiting_validation: "Awaiting Validation",
  validated: "Validated",
  needs_information: "Needs Information",
  rejected: "Rejected",
  overdue: "Overdue",
};

export function displayStatus(
  status: StoredStatus,
  responseDueAt: Date | null,
  now: Date = new Date(),
): DisplayStatus {
  if (status === "awaiting_validation" && responseDueAt && now > responseDueAt) {
    return "overdue";
  }
  return status;
}

export const DEFAULT_EXIT_ITEMS = [
  "Knowledge Transfer",
  "Laptop / Asset Return",
  "Expense / Reimbursement",
  "Full & Final Settlement",
  "Relieving / Experience Letter",
] as const;

// ExitProof's default response target — a product setting, not a legal deadline.
export const DEFAULT_RESPONSE_DAYS = 7;
