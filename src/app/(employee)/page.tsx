import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Entry point: signed out → /login; signed in → most recent case, or /start.
export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("exit_cases")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  redirect(latest ? `/cases/${latest.id}` : "/start");
}
