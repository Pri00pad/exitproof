// Statuses stored in exit_items.status. "overdue" and "not_requested" are never
// stored — they are derived for display (see displayStatus).
export const STORED_STATUSES = [
  "not_submitted",
  "awaiting_validation",
  "validated",
  "needs_information",
  "rejected",
  "requested",
  "hr_responded",
  "completed",
] as const;

export type StoredStatus = (typeof STORED_STATUSES)[number];
export type DisplayStatus = StoredStatus | "overdue" | "not_requested";

// validation: the employee submits evidence and HR validates it.
// request:    the employee asks HR for something and HR sends a document back.
// Fixed when the item is created (exit_items.workflow_type).
export type Workflow = "validation" | "request";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  not_submitted: "Not Submitted",
  awaiting_validation: "Awaiting Validation",
  validated: "Validated",
  needs_information: "Needs Information",
  rejected: "Rejected",
  overdue: "Overdue",
  not_requested: "Not Requested",
  requested: "Requested from HR",
  hr_responded: "Document Available",
  completed: "Completed",
};

// The round is with HR: a validation decision or a requested document is pending.
export function isWaitingOnHr(status: StoredStatus): boolean {
  return status === "awaiting_validation" || status === "requested";
}

// Resolved = Validated (validation) or Completed (request). Document Available
// is not resolved until the employee confirms receipt.
export function isResolved(status: StoredStatus): boolean {
  return status === "validated" || status === "completed";
}

export function displayStatus(
  status: StoredStatus,
  workflow: Workflow,
  responseDueAt: Date | null,
  now: Date = new Date(),
): DisplayStatus {
  if (isWaitingOnHr(status) && responseDueAt && now > responseDueAt) return "overdue";
  if (status === "not_submitted" && workflow === "request") return "not_requested";
  return status;
}

// The single most useful next action on the dashboard, in priority order.
const NEXT_STEP_ORDER: readonly DisplayStatus[] = [
  "hr_responded",
  "needs_information",
  "rejected",
  "overdue",
  "not_submitted",
];

// Items arrive in dashboard order; the first item of the highest-priority kind wins.
export function pickNextStep<T extends { display: DisplayStatus }>(items: T[]): T | null {
  let best: T | null = null;
  let bestRank = Infinity;
  for (const item of items) {
    // Not started (either workflow) shares one rank so items keep their order.
    const rank = NEXT_STEP_ORDER.indexOf(item.display === "not_requested" ? "not_submitted" : item.display);
    if (rank !== -1 && rank < bestRank) {
      best = item;
      bestRank = rank;
    }
  }
  return best;
}

export const DEFAULT_EXIT_ITEMS = [
  "Knowledge Transfer",
  "Laptop / Asset Return",
  "Expense / Reimbursement",
  "Full & Final Settlement",
  "Relieving / Experience Letter",
] as const;

// Default items the employee requests from HR. Everything else, including
// custom items, follows the validation workflow.
export const REQUEST_EXIT_ITEMS: readonly string[] = ["Full & Final Settlement", "Relieving / Experience Letter"];

export function workflowForTitle(title: string): Workflow {
  return REQUEST_EXIT_ITEMS.includes(title) ? "request" : "validation";
}

// ExitProof's default response target — a product setting, not a legal deadline.
export const DEFAULT_RESPONSE_DAYS = 7;
