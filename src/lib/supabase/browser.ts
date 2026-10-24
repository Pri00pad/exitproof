import { createBrowserClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";

// Browser client for Client Components (evidence uploads in Phase 2).
// Auth (sign up / log in / log out) runs in Server Actions via server.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

// Session-less browser client for the /verify page: HR uploads use a
// server-issued signed upload token, never anyone's login session.
export function createSessionlessClient() {
  return createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
