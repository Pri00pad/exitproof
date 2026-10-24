"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { DEFAULT_EXIT_ITEMS, DEFAULT_RESPONSE_DAYS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { MAX_CUSTOM_ITEMS, formText, isEmail } from "@/lib/validation";

export type StartFormValues = {
  employee_name: string;
  company_name: string;
  hr_contact_name: string;
  hr_contact_email: string;
  last_working_day: string;
  response_days: string;
  items: string[];
  custom_items: string;
};

export type StartFormState = { error?: string; values?: StartFormValues };

const DEFAULT_TITLES: readonly string[] = DEFAULT_EXIT_ITEMS;

export async function createExitCase(_prev: StartFormState, formData: FormData): Promise<StartFormState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const values: StartFormValues = {
    employee_name: formText(formData, "employee_name"),
    company_name: formText(formData, "company_name"),
    hr_contact_name: formText(formData, "hr_contact_name"),
    hr_contact_email: formText(formData, "hr_contact_email").toLowerCase(),
    last_working_day: formText(formData, "last_working_day"),
    response_days: formText(formData, "response_days") || String(DEFAULT_RESPONSE_DAYS),
    items: formData.getAll("items").map(String),
    custom_items: String(formData.get("custom_items") ?? ""),
  };
  const fail = (error: string): StartFormState => ({ error, values });

  for (const [field, label] of [
    ["employee_name", "Your name"],
    ["company_name", "Company name"],
    ["hr_contact_name", "HR contact name"],
  ] as const) {
    if (!values[field]) return fail(`${label} is required.`);
    if (values[field].length > 200) return fail(`${label} must be 200 characters or fewer.`);
  }
  if (!isEmail(values.hr_contact_email)) return fail("Enter a valid HR contact email.");
  if (values.last_working_day && !/^\d{4}-\d{2}-\d{2}$/.test(values.last_working_day)) {
    return fail("Enter a valid last working day.");
  }
  const responseDays = Number(values.response_days);
  if (!Number.isInteger(responseDays) || responseDays < 1 || responseDays > 60) {
    return fail("Response target must be a whole number of days between 1 and 60.");
  }

  const custom = values.custom_items.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (custom.length > MAX_CUSTOM_ITEMS) return fail(`Add at most ${MAX_CUSTOM_ITEMS} custom items.`);
  if (custom.some((title) => title.length > 120)) return fail("Each item must be 120 characters or fewer.");

  // Defaults keep their standard order; custom items follow. Case-insensitive de-dupe.
  const seen = new Set<string>();
  const titles = [...DEFAULT_TITLES.filter((t) => values.items.includes(t)), ...custom].filter((title) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (titles.length === 0) return fail("Choose at least one exit item to track.");

  // User-scoped client: owner_user_id defaults to auth.uid() and RLS enforces it.
  const supabase = await createClient();
  const { data: created, error: caseError } = await supabase
    .from("exit_cases")
    .insert({
      employee_name: values.employee_name,
      company_name: values.company_name,
      hr_contact_name: values.hr_contact_name,
      hr_contact_email: values.hr_contact_email,
      last_working_day: values.last_working_day || null,
      response_days: responseDays,
    })
    .select("id")
    .single();
  if (caseError || !created) return fail("Could not create your exit tracker. Please try again.");

  const { error: itemsError } = await supabase.from("exit_items").insert(
    titles.map((title, index) => ({
      case_id: created.id,
      title,
      is_default: DEFAULT_TITLES.includes(title),
      sort_order: index,
    })),
  );
  if (itemsError) {
    return fail("Your exit tracker was created, but its items could not be saved. Please contact support.");
  }

  redirect(`/cases/${created.id}`);
}
