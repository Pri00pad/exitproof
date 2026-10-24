"use client";

import { useActionState, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { Alert, Card, Spinner, TextField, button, inputClass } from "@/components/ui";
import { COPY } from "@/lib/copy";
import { DEFAULT_EXIT_ITEMS, DEFAULT_RESPONSE_DAYS, workflowForTitle } from "@/lib/status";
import { createExitCase, type StartFormState } from "./actions";

const initialState: StartFormState = {};

export function StartForm() {
  const [state, formAction, pending] = useActionState(createExitCase, initialState);
  const v = state.values;

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error" role="alert" title="Please check the form">{state.error}</Alert>}

      <Section step={1} title="Employee" description="How your name should appear to HR.">
        <TextField label="Your full name" name="employee_name" required maxLength={200} autoComplete="name" defaultValue={v?.employee_name} />
      </Section>

      <Section step={2} title="Company" description="The company you are leaving.">
        <TextField label="Company name" name="company_name" required maxLength={200} autoComplete="organization" defaultValue={v?.company_name} />
      </Section>

      <Section step={3} title="HR contact" description="The person who will validate your exit items and respond to your requests.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="HR contact name" name="hr_contact_name" required maxLength={200} defaultValue={v?.hr_contact_name} />
          <TextField label="HR contact email" name="hr_contact_email" type="email" required defaultValue={v?.hr_contact_email} />
        </div>
      </Section>

      <Section step={4} title="Exit timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Last working day (optional)" name="last_working_day" type="date" defaultValue={v?.last_working_day} />
          <TextField
            label="Response target (days)"
            name="response_days"
            type="number"
            required
            min={1}
            max={60}
            inputMode="numeric"
            defaultValue={v?.response_days ?? String(DEFAULT_RESPONSE_DAYS)}
            hint={`${COPY.responseTarget} is ${DEFAULT_RESPONSE_DAYS} days. It is not a legal deadline.`}
          />
        </div>
      </Section>

      <Section
        step={5}
        title="Items to track"
        description="Choose what HR needs to validate or provide. Items marked “Request from HR” are documents you ask HR for. You can add your own."
      >
        <fieldset>
          <legend className="sr-only">Default exit items</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEFAULT_EXIT_ITEMS.map((title) => (
              <label
                key={title}
                className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-700"
              >
                <input
                  type="checkbox"
                  name="items"
                  value={title}
                  defaultChecked={v ? v.items.includes(title) : true}
                  className="peer sr-only"
                />
                <span className="flex size-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-transparent transition-colors peer-checked:border-blue-700 peer-checked:bg-blue-700 peer-checked:text-white">
                  <CheckIcon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{title}</span>
                  {workflowForTitle(title) === "request" && (
                    <span className="block text-xs text-slate-500">{COPY.requestTag}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 block">
          <span className="text-sm font-medium text-slate-800">Other items (optional)</span>
          <textarea
            name="custom_items"
            rows={3}
            defaultValue={v?.custom_items}
            placeholder={"One per line, for example:\nAccess Card Return"}
            className={`mt-1.5 ${inputClass}`}
          />
          <span className="mt-1.5 block text-xs text-slate-500">One item per line, up to 10.</span>
        </label>
      </Section>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">You can review everything on your dashboard next.</p>
        <button type="submit" disabled={pending} className={`${button.primary} w-full sm:w-auto`}>
          {pending && <Spinner />}
          {pending ? "Creating your tracker…" : "Create my exit tracker"}
        </button>
      </div>
    </form>
  );
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex gap-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-200">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}
