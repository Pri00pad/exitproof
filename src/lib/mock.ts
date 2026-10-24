// PHASE 0 ONLY — static fixtures so the five screen shells render.
// Replaced by Supabase queries in Phases 1–3; delete this file then.
import type { StoredStatus } from "./status";

export type MockItem = {
  id: string;
  title: string;
  status: StoredStatus;
  submittedAt: string | null;
  responseDueAt: string | null;
  note?: string;
  hrComment?: string;
};

export const MOCK_CASE = {
  id: "demo",
  employeeName: "Priya Sharma",
  companyName: "Northwind Labs",
  hrContactName: "Anita Rao",
  hrContactEmail: "anita@example.com",
  responseDays: 7,
  items: [
    { id: "knowledge-transfer", title: "Knowledge Transfer", status: "validated", submittedAt: "2026-10-14", responseDueAt: "2026-10-21" },
    { id: "laptop", title: "Laptop / Asset Return", status: "awaiting_validation", submittedAt: "2026-10-22", responseDueAt: "2026-10-29", note: "Handed to IT desk on 22 Oct, asset tag NL-0417." },
    { id: "expense", title: "Expense / Reimbursement", status: "needs_information", submittedAt: "2026-10-20", responseDueAt: "2026-10-27", hrComment: "Please attach the March travel receipts." },
    { id: "fnf", title: "Full & Final Settlement", status: "awaiting_validation", submittedAt: "2026-10-15", responseDueAt: "2026-10-22" },
    { id: "relieving-letter", title: "Relieving / Experience Letter", status: "not_submitted", submittedAt: null, responseDueAt: null },
  ] satisfies MockItem[],
};

export function findMockItem(itemId: string): MockItem | undefined {
  return MOCK_CASE.items.find((item) => item.id === itemId);
}
