# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

ExitProof — an employee-initiated shared exit tracker for employees leaving small and mid-sized companies that still manage offboarding manually. The employee owns the record; HR is only a verifier via a per-submission link (no HR account). Full approved plan, data model, demo script and acceptance criteria: `docs/PLAN.md`. This is a 2-day Buildathon build — the #1 priority is the working core journey on Vercel with real Supabase data, not polish.

**Current phase:** Phase 3 done, plus the request workflow (branch `feature/request-fulfillment`). Two workflows share one model (`exit_items.workflow_type`):
- **validation** (Knowledge Transfer, Laptop, Expense, custom items): evidence → HR link → `hr_decide` (Approve / Request info / Reject) → Validated.
- **request** (Relieving / Experience Letter, F&F): employee note → Requested from HR → HR uploads 1–5 documents via the link → `hr_respond` → Document Available → employee Confirm Received (`confirm_received`) → Completed (final). Re-requesting after a response starts a new submission + token.

Only Escalation is still a mock screen (`src/lib/mock.ts`, `PageShell mock`).

**Environments:** local `npm run dev` uses the separate **exitproof-dev** Supabase project via `.env.development.local` (overrides `.env.local` in development mode only). `.env.local` holds production values and is used by `next build`/`next start`. Migrations are applied to dev first, as separate SQL Editor runs in filename order.

**Layouts:** routes live in route groups. `src/app/(employee)/` has the signed-in header/Log out; `src/app/(verify)/` has a minimal verifier layout (noindex, no-referrer) and must never show employee chrome. URLs are unaffected by the groups. Verification lookups live in `src/lib/verification.ts` (secret key, server-only); `/verify` response headers and the dev-log exclusion for `/verify/` are in `next.config.ts`.

**UI conventions:** shared styles live in `src/components/ui.tsx` (`button.*`, `Card`, `TextField`, `Alert`, `Spinner`, `Skeleton`) and icons in `src/components/icons.tsx`; reuse them rather than writing new Tailwind button/input classes. Statuses always render via `StatusBadge` (icon + text). The raw HR link is never stored server-side; the browser keeps it in sessionStorage (`src/lib/verify-link-storage.ts`). Work phase by phase as listed in `docs/PLAN.md` and stop for review at each phase boundary.

## Commands

Node is installed per-user at `%LOCALAPPDATA%\Programs\nodejs` (on the user PATH; a shell started before install may need it appended).

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (also type-checks)
npm run lint         # eslint
npx tsc --noEmit     # type-check only (run `npx next typegen` first if PageProps/LayoutProps types are missing)
```

No test runner is set up yet (planned in Phase 4 for overdue/status/escalation logic).

## Next.js 16 specifics (differs from older training data)

- Middleware is now **`src/proxy.ts`** exporting `proxy()`. It refreshes the Supabase session and (from Phase 1) redirects signed-out users to `/login`; its matcher excludes `/verify/` (HR has no session). It is a convenience, not the security boundary — pages and actions re-check the user.
- `params` is a Promise: use the global `PageProps<"/route/[param]">` / `LayoutProps<"/">` helpers and `await params`.
- `cacheComponents` and `partialPrefetching` are deliberately **off** in `next.config.ts` so session-reading pages render normally at request time without mandatory `<Suspense>` boundaries. Don't re-enable them.
- Bundled docs for this exact version live in `node_modules/next/dist/docs/` — check them before using an unfamiliar API.

## Architecture

- **Employee auth:** Supabase **email + password** (`signUp` / `signInWithPassword` / `signOut` in Server Actions). `/login` has Log In and Create Account (email, password, confirm) modes. Supabase "Confirm email" is disabled on the project, so `signUp` returns a session immediately — the app has no email flows at all. After auth, `/` routes to the user's most recent case or `/start`. Out of scope: password reset, magic links, social login, SSO, MFA.
- **Demo reviewer account** is created in the Supabase Dashboard, never in code; scripts read its email from `DEMO_EMAIL` in `.env.local`. Never commit credentials.
- **Two Supabase clients, strictly separated:**
  - `src/lib/supabase/server.ts` — user-scoped (publishable key + session cookies). All employee reads/writes go through it, so **RLS on `owner_user_id = auth.uid()` is the isolation guarantee.**
  - `src/lib/supabase/admin.ts` — secret/service-role key, bypasses RLS. Use **only** in `/verify/[token]` server code, after hashing the token and matching a current, unexpired, undecided submission (`resolveToken` in `src/lib/verification.ts`).
  - `browser.ts` is for client-side evidence uploads into the private `evidence` bucket under `{auth.uid()}/…`.
- **Schema lives in `supabase/migrations/`** (applied by pasting into the Supabase SQL Editor, one file per run, in order; no Supabase CLI). The request-workflow migration is split in two (A: enum values, B: everything else) because Postgres can't use a new enum value in the transaction that added it. Employees have only SELECT (own rows) and INSERT (cases, `not_submitted` items) — no UPDATE/DELETE. All status changes go through the SQL functions `submit_exit_item`, `regenerate_verify_link`, `confirm_received` (employee, ownership checked inside) and `hr_decide` / `hr_respond` (`service_role` only). Don't add UPDATE grants or policies to work around this; add or extend a function instead.
- **Verify tokens:** 256-bit random, only the SHA-256 hash is stored, one token per submission; resubmission or regeneration invalidates the old link.
- **Status model** (`src/lib/status.ts`): eight stored statuses (five validation, `requested` / `hr_responded` / `completed` for requests; a DB check ties each status to its workflow). **Overdue is derived** (`awaiting_validation` or `requested` past `response_due_at`), never written; so is "Not Requested". `response_due_at` is fixed at submit time. Only `hr_decide` may set `validated` and only `confirm_received` may set `completed`. Resolved = `isResolved()` (validated or completed); `hr_responded` is not resolved.
- **HR documents:** private `hr-documents` bucket, paths `{owner}/{item}/{submission}/{uuid}.ext`. `prepareHrUpload` (server, secret key) issues signed upload URLs for the token's own submission folder; the browser uploads directly (bytes never pass through Next/Vercel); `sendToEmployee` → `hr_respond` re-checks every path. Employees download via `cases/[caseId]/items/[itemId]/files/[fileId]/route.ts`, which signs with the employee's own client using the file row's `storage_bucket` + `storage_path`. Employees have SELECT-only Storage access there.
- **Dashboard freshness:** polling with `router.refresh()`, not Supabase Realtime.
- **Escalation:** a deterministic template the employee copies; ExitProof sends no emails.
- Mutations are Server Actions; re-check the session (or verify token) inside every action and confirm route params (`caseId`/`itemId`) belong to the caller.

## Product rules (enforce in UI copy and server logic)

- Never say "employment exit complete" — say **"All tracked exit items resolved."** (see `src/lib/copy.ts`).
- A verification link proves possession of the link, not HR identity. Say **"Validated"** or **"Validated via verification link"** (`COPY.validatedVia`); never claim ExitProof verified who the HR person is.
- The 7-day period is **"ExitProof's default response target"**, configurable per case, not a legal deadline.
- No legal advice, no F&F entitlement calculation.
- Reject and Request More Information **require an HR comment** (validate on the server, not just the form).
- Out of scope — do not build: HR dashboard, admin accounts, IT/Finance/Manager portals, payroll/F&F/PF, HRIS, SSO, social login, MFA, password reset, AI chatbot, automated emails, analytics, payments, settings pages.

## Environment

Copy `.env.example` to `.env.local`. `SUPABASE_SECRET_KEY` must never get a `NEXT_PUBLIC_` prefix. The app boots without Supabase env vars (the proxy skips session refresh) so shells render before the project is connected.
