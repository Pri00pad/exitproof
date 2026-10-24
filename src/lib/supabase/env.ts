// Reads Supabase config lazily so the app still boots (with mock shells)
// before a Supabase project is connected.

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// Origin used to build HR verification links (server-side only).
// 1. NEXT_PUBLIC_SITE_URL if set (local: .env.local; Vercel: project env var).
// 2. On Vercel, the project's production domain, which Vercel sets automatically.
//    Never a per-deployment URL: those can sit behind Vercel Deployment Protection,
//    which an HR verifier could not get past.
// No localhost fallback: a missing value must fail loudly, not mint broken links.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction}`;
  throw new Error("NEXT_PUBLIC_SITE_URL is not set; cannot build verification links.");
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
