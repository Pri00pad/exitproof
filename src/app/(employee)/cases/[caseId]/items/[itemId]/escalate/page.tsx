import { notFound } from "next/navigation";
import { AlertTriangleIcon, CheckIcon, MessageIcon } from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, button } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { MOCK_CASE, findMockItem } from "@/lib/mock";

// Screen 5 — Overdue / Escalation. Phase 4: real overdue calculation and a
// deterministic message template; the employee copies it (nothing is sent).
export default async function EscalatePage({
  params,
}: PageProps<"/cases/[caseId]/items/[itemId]/escalate">) {
  const { itemId } = await params;
  const item = findMockItem(itemId);
  if (!item) notFound();

  const message = `Hi ${MOCK_CASE.hrContactName},

I submitted evidence for "${item.title}" on ${item.submittedAt ?? "—"}. The response target was ${item.responseDueAt ?? "—"} (${COPY.responseTarget}), and it is still awaiting validation.

Could you please review it using the verification link I shared? Thank you.

${MOCK_CASE.employeeName}`;

  const steps = [
    { label: "Submitted", detail: item.submittedAt ?? "—", tone: "done" as const },
    { label: "Response target missed", detail: item.responseDueAt ?? "—", tone: "missed" as const },
    { label: "Escalation available", detail: "Send a polite follow-up to HR", tone: "current" as const },
  ];

  return (
    <PageShell
      mock
      eyebrow="Follow up"
      title={item.title}
      subtitle="This item has passed its response target. Use the message below to follow up with HR."
    >
      <div className="-mt-4 mb-6">
        <StatusBadge status="overdue" size="md" />
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
        <ol className="mt-4 space-y-0">
          {steps.map((step, index) => (
            <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px bg-slate-200" />
              )}
              <span
                className={`relative flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ${
                  step.tone === "done"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : step.tone === "missed"
                      ? "bg-red-50 text-red-700 ring-red-200"
                      : "bg-blue-700 text-white ring-blue-700"
                }`}
              >
                {step.tone === "done" ? (
                  <CheckIcon className="size-4" />
                ) : step.tone === "missed" ? (
                  <AlertTriangleIcon className="size-4" />
                ) : (
                  <MessageIcon className="size-4" />
                )}
              </span>
              <div className="pt-1">
                <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                <p className="text-sm text-slate-500">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-slate-900">Follow-up message</h2>
          <CopyButton text={message} label="Copy message" className={button.primary} />
        </div>
        <pre className="px-5 py-5 font-sans text-sm leading-6 whitespace-pre-wrap text-slate-800 sm:px-6">{message}</pre>
      </Card>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        ExitProof doesn&apos;t send this message for you. Paste it into email or WhatsApp. It is not legal advice.
      </p>
    </PageShell>
  );
}
