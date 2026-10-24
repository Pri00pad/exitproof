# ExitProof

An employee-initiated shared exit tracker for employees leaving small and mid-sized companies that still manage offboarding manually through email, WhatsApp, spreadsheets and HR follow-ups.

The employee tracks each exit item, submits evidence, and sends HR a private verification link. The verifier approves, requests more information, or rejects — no HR account needed. The employee always sees what has been validated and what is overdue.

ExitProof does not provide legal advice and does not calculate F&F entitlement. A verification link proves possession of the link, not the identity of the person who used it.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Auth email + password, Postgres, Storage) · Vercel

## Local development

```bash
cp .env.example .env.local   # fill in Supabase values; keep NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm install
npm run dev                  # http://localhost:3000
```

Database: run each file in `supabase/migrations/` once in the Supabase SQL Editor, **in filename order, one file per run** (each run must succeed before the next): the initial schema, then the request-workflow enums, then the request workflow (tables, RLS, functions, private `evidence` and `hr-documents` buckets and storage policies). In Supabase Auth, enable Email sign-ups and turn **Confirm email** off.

For local development against a separate Supabase project, put its three values in `.env.development.local` (git-ignored). `npm run dev` reads it in preference to `.env.local`; `next build` / `next start` do not.

## Deploying to Vercel

Import the repository with the default Next.js settings and set these environment variables (Production):

| Variable | Kind |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | config |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | config (safe in the browser) |
| `NEXT_PUBLIC_SITE_URL` | config: the production origin, e.g. `https://<project>.vercel.app` (no trailing slash) |
| `SUPABASE_SECRET_KEY` | **secret** — server-only, never prefix with `NEXT_PUBLIC_` |

`NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing them. If `NEXT_PUBLIC_SITE_URL` is unset on Vercel, verification links fall back to the project's production domain.

See `docs/PLAN.md` for the approved plan, data model and acceptance criteria.
