import { createBrowserClient } from "@supabase/ssr";

// Browser client for Client Components (evidence uploads in Phase 2).
// Auth (sign up / log in / log out) runs in Server Actions via server.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
