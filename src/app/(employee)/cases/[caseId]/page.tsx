import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, CalendarIcon, CheckCircleIcon, ClockIcon, MessageIcon, UserIcon } from "@/components/icons";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { COPY } from "@/lib/copy";
import { formatDate, formatDateOnly } from "@/lib/format";
import { displayStatus, type DisplayStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { DashboardItemRow, ExitCaseRow } from "@/lib/types";
import { isUuid } from "@/lib/validation";

type Item = DashboardItemRow & { display: DisplayStatus };

// Screen 2 — Exit Dashboard. Reads through the employee's own client, so RLS
// returns nothing for a case owned by someone else → 404.
export default async function DashboardPage({ params }: PageProps<"/cases/[caseId]">) {
  await requireUser();
  const { caseId } = await params;
  if (!isUuid(caseId)) notFound();

  const supabase = await createClient();
  const { data: exitCase, error: caseError } = await supabase
    .from("exit_cases")
    .select("id, employee_name, company_name, hr_contact_name, hr_contact_email, last_working_day, response_days")
    .eq("id", caseId)
    .maybeSingle<ExitCaseRow>();
  if (caseError) throw new Error("Could not load your exit case.");
  if (!exitCase) notFound();

  const { data, error: itemsError } = await supabase
    .from("exit_items")
    .select(
      "id, title, status, sort_order, current:submissions!exit_items_current_submission_fk(submitted_at, response_due_at, hr_comment)",
    )
    .eq("case_id", caseId)
    .order("sort_order");
  if (itemsError) throw new Error("Could not load your exit items.");

  const now = new Date();
  const items: Item[] = ((data ?? []) as unknown as DashboardItemRow[]).map((item) => ({
    ...item,
    display: displayStatus(item.status, item.current ? new Date(item.current.response_due_at) : null, now),
  }));
  const resolved = items.filter((i) => i.status === "validated").length;
  const total = items.length;
  const percent = total ? Math.round((resolved / total) * 100) : 0;
  const allResolved = total > 0 && resolved === total;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <AutoRefresh />
      <Card className="p-5 sm:p-6">
        <p className="text-sm font-medium text-blue-700">Exit tracker</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance text-slate-900 sm:text-3xl">
          {exitCase.company_name}
        </h1>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <Meta Icon={UserIcon} label="Employee" value={exitCase.employee_name} />
          <Meta
            Icon={CalendarIcon}
            label="Last working day"
            value={exitCase.last_working_day ? formatDateOnly(exitCase.last_working_day) : "Not set"}
          />
          <Meta Icon={MessageIcon} label="HR contact" value={exitCase.hr_contact_name} />
        </dl>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-semibold text-slate-900">
              {resolved} of {total} tracked items resolved
            </p>
            <p className="text-sm tabular-nums text-slate-500">{percent}%</p>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={resolved}
            aria-label="Tracked items resolved"
          >
            <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <NextStep caseId={caseId} items={items} allResolved={allResolved} />
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Tracked items</h2>
        <p className="text-sm text-slate-500">{total} total</p>
      </div>

      {total === 0 ? (
        <Card className="mt-3 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No exit items are being tracked</p>
          <p className="mt-1 text-sm text-slate-500">Items you choose when starting your exit appear here.</p>
        </Card>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard caseId={caseId} item={item} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-slate-500">
        Response targets use {COPY.responseTarget} of {exitCase.response_days} days from submission. They are not legal deadlines.
      </p>
    </main>
  );
}

function Meta({ Icon, label, value }: { Icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="truncate font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}

// The single most useful action, so the dashboard never has competing CTAs.
function NextStep({ caseId, items, allResolved }: { caseId: string; items: Item[]; allResolved: boolean }) {
  if (allResolved) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <CheckCircleIcon className="size-5 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-900">{COPY.allResolved}</p>
      </div>
    );
  }

  const pick =
    items.find((i) => i.display === "needs_information") ??
    items.find((i) => i.display === "rejected") ??
    items.find((i) => i.display === "overdue") ??
    items.find((i) => i.display === "not_submitted");

  if (!pick) {
    const waiting = items.filter((i) => i.display === "awaiting_validation").length;
    return (
      <Card className="flex items-start gap-3 px-5 py-4">
        <ClockIcon className="mt-0.5 size-5 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Waiting for HR</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {waiting} {waiting === 1 ? "item is" : "items are"} awaiting validation. Response targets are shown below.
          </p>
        </div>
      </Card>
    );
  }

  const copy: Record<string, { title: string; cta: string }> = {
    needs_information: { title: `More information was requested for ${pick.title}`, cta: "Provide Updated Evidence" },
    rejected: { title: `${pick.title} was rejected by the verifier`, cta: "Resubmit Evidence" },
    overdue: { title: `${pick.title} is past its response target`, cta: "View item" },
    not_submitted: { title: `Submit evidence for ${pick.title}`, cta: "Add evidence" },
  };
  const { title, cta } = copy[pick.display];

  return (
    <Card className="flex flex-col gap-4 border-blue-200 bg-blue-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Next step</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <Link href={`/cases/${caseId}/items/${pick.id}`} className={`${button.primary} w-full shrink-0 sm:w-auto`}>
        {cta}
        <ArrowRightIcon className="size-4" />
      </Link>
    </Card>
  );
}

function ItemCard({ caseId, item }: { caseId: string; item: Item }) {
  const urgent = item.display === "overdue";
  return (
    <Link
      href={`/cases/${caseId}/items/${item.id}`}
      className={`group block rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:p-5 ${
        urgent ? "border-red-200 hover:border-red-300" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
        <StatusBadge status={item.display} />
      </div>

      {item.current ? (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-slate-500">Submitted</dt>
            <dd className="font-medium text-slate-800">{formatDate(item.current.submitted_at)}</dd>
          </div>
          {(item.display === "awaiting_validation" || urgent) && (
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Response target</dt>
              <dd className={`font-medium ${urgent ? "text-red-700" : "text-slate-800"}`}>
                {formatDate(item.current.response_due_at)}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No evidence submitted yet.</p>
      )}

      {item.current?.hr_comment && (item.status === "needs_information" || item.status === "rejected") && (
        <p className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">Verifier comment:</span> {item.current.hr_comment}
        </p>
      )}

      <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-blue-700">
        View item
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
