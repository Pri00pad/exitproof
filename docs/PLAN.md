# ExitProof — Buildathon Plan (approved)

## Positioning

"An employee-initiated shared exit tracker for employees leaving small and mid-sized companies that still manage offboarding manually through email, WhatsApp, spreadsheets and HR follow-ups."

- The employee starts the process and owns the record.
- HR participates only when validation is required — no HR account, no HR dashboard.
- Differentiator: structured offboarding tools depend on the employer adopting them. ExitProof is started by the employee and gives them a persistent, personal record of what was submitted, what HR actually validated, what needs more information, and what is overdue.

## Product rules (non-negotiable)

1. Never say "Your employment exit is complete." Say **"All tracked exit items resolved."**
2. The 7-day period is **"ExitProof's default response target"** — configurable, not a legal deadline.
3. ExitProof does not provide legal advice.
4. ExitProof does not calculate F&F entitlement.
5. An item becomes **Validated** only after an explicit approval through its verification link. Copy says "Validated" / "Validated via verification link", never that ExitProof verified who the HR person is.
6. **Reject** and **Request More Information** require an HR comment.

## #1 goal — the core journey (must work on Vercel with real, persistent data)

Employee signs up / logs in → Creates Exit → Selects an Exit Item → Submits Evidence → Gets HR Verification Link → HR Opens Link → HR Approves → Employee Dashboard Shows Validated → Overdue Item Can Be Escalated

Authentication must never block this journey.

## Architecture

```
Employee browser ──(Supabase session cookie)──┐
                                              ▼
HR browser (no login) ──(/verify/[token])──▶ Next.js App Router on Vercel
                                              │  Server Components + Server Actions
                         employee requests ───┤── user-scoped Supabase client (publishable key + session) → RLS enforced
                         HR /verify requests ─┘── secret-key client, only after verify-token check
                                              ▼
                              Supabase Postgres + Supabase Auth + Storage (private bucket)
```

### Stack decisions (made in Phase 0)
- Next.js **16.4.2** (16.4.0 had critical advisories; 16.4.3 was too fresh), React 19, Tailwind 4, `@supabase/supabase-js` 2.117.3, `@supabase/ssr` 0.12.7.
- `cacheComponents` / `partialPrefetching` turned **off** — with them on, every cookie/params read must sit inside `<Suspense>` or the build fails; not worth it for a 2-day build of per-user pages.
- Next 16 renamed middleware to **`src/proxy.ts`**.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server-only), `NEXT_PUBLIC_SITE_URL` (used to build HR links).

### Employee auth — Supabase email + password
Chosen so 3–5 external testers and reviewers can get in reliably, with no dependency on email delivery or SMTP limits.

- **`/login`** has two modes on one page: **Log In** (email, password) and **Create Account** (personal email, password, confirm password).
- Create Account → Server Action validates (email format, password ≥ 8 chars, password = confirm, re-checked on the server) → `supabase.auth.signUp({ email, password })`. With Supabase **"Confirm email" disabled**, signUp returns a session immediately — no verification email is sent.
- Log In → Server Action → `supabase.auth.signInWithPassword({ email, password })`. Errors shown as a generic "Email or password is incorrect."
- After either: redirect to `/`, which sends the user to their most recent case dashboard, or `/start` if they have none.
- **Log out**: Server Action → `supabase.auth.signOut()` → `/login`. Shown in the header when signed in.
- Sessions persist via `@supabase/ssr` cookies; `src/proxy.ts` refreshes them on every request and redirects signed-out users away from `/start` and `/cases/*` to `/login`, and signed-in users away from `/login` to `/`. Pages and actions still re-check the user themselves (the proxy is not the security boundary).
- Out of scope: forgot/reset password, social login, SSO, MFA, company auth, email verification.

### Demo reviewer account
- Created manually in Supabase Dashboard (Authentication → Users → Add user, "Auto Confirm User"), **never in source code**.
- Credentials live only outside the repo (shared privately with reviewers). The Phase 4 seed script reads the demo email from an env var (`DEMO_EMAIL`, in `.env.local` only) to attach the pre-made overdue demo case to that account.

### Data access
- Every `exit_cases` row has `owner_user_id = auth.users.id`, set on insert from the session (never from form input).
- **RLS on every table**: an employee can select/insert/update only rows reachable from a case where `owner_user_id = auth.uid()`. Employees use the user-scoped client, so the database enforces isolation even if app code has a bug. Server code additionally checks that `caseId`/`itemId` route params belong to the user (return 404 otherwise).
- **Storage RLS**: the `evidence` bucket is private; employees may upload/read only objects under `{auth.uid()}/...`.
- **Employees have no UPDATE/DELETE privilege on any table.** They may SELECT their own rows and INSERT cases and `not_submitted` items. Every status change goes through database functions (`supabase/migrations/20261024100000_initial_schema.sql`):
  - `submit_exit_item(item_id, note, token_hash, files)`: employee, ownership checked inside; atomically creates the submission, records evidence metadata (size/MIME read from Storage, not the client), sets `awaiting_validation`, logs the event.
  - `regenerate_verify_link(item_id, token_hash)`: employee; swaps the token hash on the current submission.
  - `hr_decide(token_hash, decision, comment)`: **executable only by `service_role`**; the only path that can set `validated`.
- HR has no session. `/verify/[token]` hashes the token, looks up the submission with the **secret-key client** (server-only), and HR actions call `hr_decide`, which re-checks the token, expiry, that the submission is still current and `awaiting_validation`, and the comment rule.
- Secret key is only ever used in server code and never in a `NEXT_PUBLIC_*` variable.

### Other decisions
- **Overdue is derived, not stored**: `status = 'awaiting_validation' AND now() > response_due_at`. No cron.
- **Dashboard freshness**: polling with `router.refresh()` every ~5–10 s and on window focus. No Realtime.
- **Escalation message**: deterministic template, copied by the employee. ExitProof sends no emails at all.
- **Uploads**: employee uploads directly to the private bucket with their session at `{user_id}/{item_id}/{uuid}.{ext}`; the submit action verifies each path belongs to the user and item before recording metadata. HR sees files via ~10-minute signed URLs generated server-side.
- No ORM — `supabase-js` + SQL migrations (run in the Supabase SQL Editor).

## Data model

**exit_cases** — id, owner_user_id (FK auth.users, not null), employee_name, company_name, hr_contact_name, hr_contact_email, last_working_day (nullable), response_days int default 7, created_at, updated_at.

**exit_items** — id, case_id, title, is_default, sort_order, status (`not_submitted | awaiting_validation | validated | needs_information | rejected`), current_submission_id (nullable), created_at, updated_at.

**submissions** — id, item_id, note, submitted_at, response_due_at (fixed at submit time = submitted_at + case.response_days), verify_token_hash (unique), verify_token_expires_at, decision (nullable), decided_at.

**evidence_files** — id, submission_id, storage_path, original_name, mime_type, size_bytes, created_at.

**verification_events** — id, item_id, submission_id, actor (`employee | hr`), action (`submitted | approved | rejected | info_requested | link_regenerated`), comment, created_at.

Constraints: comment required for `rejected` / `info_requested`; HR decisions use conditional updates (`WHERE status = 'awaiting_validation' AND current_submission_id = $sub`), making double-submits harmless. Employee RLS policies do not allow setting `validated` — only the server-side HR action (secret key) can.

"Overdue" is a display status computed from the row; it is never written.

**Resolved** = Validated. Rejected and Needs Information items can be resubmitted (new submission, new HR link; old link stops working).

## Routes

| Route | Screen | Access |
|---|---|---|
| `/` | Redirect: signed out → `/login`; signed in → most recent case, or `/start` if none | — |
| `/login` | Log In / Create Account | public (signed-in users redirected to `/`) |
| `/start` | **1. Start My Exit** | employee |
| `/cases/[caseId]` | **2. Exit Dashboard** | employee (owner) |
| `/cases/[caseId]/items/[itemId]` | **3. Submit Evidence** | employee (owner) |
| `/cases/[caseId]/items/[itemId]/escalate` | **5. Overdue / Escalation** | employee (owner) |
| `/verify/[token]` | **4. HR Verification** | token only, no login |

Mutations are Server Actions (sign up, log in, log out, create case, add item, submit, regenerate link, HR decision). No auth callback route is needed.

## Phases

**Status (2026-10-24):** Phases 0–3 complete locally; core acceptance journey passes end-to-end. Next: Phase 4, then Vercel deploy.

**Phase 0 — Foundation** ✅
Next.js + TypeScript + Tailwind, repo structure, five screen shells + login shell, Supabase config placeholders, runs locally.

**Phase 1 — Auth + create/view**
SQL migration (tables, RLS, storage bucket + policies), email/password sign-up/log-in/log-out, proxy route protection, Start My Exit creates case + items, dashboard lists items, `/` redirect logic. Deploy to Vercel early and verify sign-up works there.

**Phase 2 — Submit**
Evidence upload (type/size checks), note, submit → submission + hashed verify token + response target, HR link shown with copy button; regenerate link.

**Phase 3 — Verify (aha moment)**
`/verify/[token]` with signed file URLs; Approve / Request info / Reject with comment rule; events logged; dashboard polling.
**Gate: the core acceptance test passes on the Vercel URL.**

**Phase 4 — Complete the journey**
Resubmission, overdue derivation + labels, escalation page + copy, "All tracked exit items resolved" banner, item history, demo seed script (attaches overdue demo case to `DEMO_EMAIL`), unit tests for overdue / status transitions / escalation template.

**Phase 5 — Harden and polish**
Security checklist (including cross-account tampering test), responsive polish, empty/error/loading states, demo rehearsal on production, code freeze ~2 h before judging.

## Demo scenario

Fictional data. Employee window + HR incognito window.

1. Create Account with email + password → land on Start My Exit.
2. Create exit: Priya Sharma, Northwind Labs, HR contact Anita Rao (anita@example.com); 5 default items + "Access Card Return".
3. Laptop / Asset Return → note + `handover-receipt.jpg` → Submit → **Awaiting Validation**, submitted today, response target +7 days. Copy HR link.
4. HR window: open link, view evidence, **Approve** → employee dashboard shows **Validated** within seconds.
5. Expense: HR tries Request info without comment (blocked), then with comment → employee sees **Needs Information** + comment, resubmits, HR approves.
6. Access Card Return: HR **Rejects** with comment → employee sees it.
7. Log out → log back in → same case and statuses are there.
8. Overdue: log in as the demo reviewer account, which `seed:demo` gave a case whose F&F item was submitted 9 days ago → **Overdue · 2 days** → escalation page → copy message.
9. Approve that item via its HR link → **"All tracked exit items resolved."**

## Security & privacy

- Employee isolation via RLS on `owner_user_id` (tables and storage), plus server-side ownership checks on every route param.
- Passwords handled entirely by Supabase Auth (hashed there; never stored or logged by ExitProof). Minimum length 8, enforced in Supabase settings and in the sign-up action.
- With email confirmation off, sign-up does not prove email ownership. Acceptable for the Buildathon because ExitProof never emails the address or uses it to identify anyone other than the account holder.
- Verify tokens: 256-bit random, stored as SHA-256 hash only, scoped to one submission, expire after 30 days, read-only after HR decides, invalidated on resubmission/regeneration. Token in path, never query.
- Token pages: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `Cache-Control: no-store`. Never log tokens.
- **Verifier identity (accepted MVP limitation):** Anyone with the secure verification link can perform the verifier action. Production would add verified corporate-email/domain or organization authentication. HR remains the intended verifier; the verify page warns that anyone with the link can validate, and the employee is told to share it only with their HR contact. This includes the employee themselves, since they hold the link.
- **Wording:** a decision proves possession of the link, not who clicked it. UI and product copy say **"Validated"** or **"Validated via verification link"** and never claim that ExitProof verified the HR person's identity (no "verified by HR", "confirmed by <name>", or "cryptographically verified").
- Evidence: private bucket, uuid paths under `{user_id}/`, allowlist PDF/PNG/JPG/WEBP, ≤10 MB, ≤5 files per submission, no SVG/HTML. HR gets short-lived signed URLs only after token validation.
- Sensitive content hint on upload ("Upload only what HR needs to verify this item"). No retention/deletion policy in MVP — documented limitation.
- Demo credentials never committed; `.env*` is git-ignored except `.env.example`.

## Known auth risks to watch

- **Auth rate limits**: Supabase limits sign-ups/sign-ins per IP. Testers on the same venue Wi-Fi share an IP; raise limits in Auth → Rate Limits if testing hits them.
- **"Confirm email" left on**: signUp would return no session and testers would be stuck. Verify the setting is off on the project before handing out the URL.
- **No password reset**: a tester who forgets their password creates a new account (or an admin resets it in the Supabase Dashboard).

## Acceptance criteria — MVP complete when all pass on production

**Core acceptance test:**
1. Tester creates an employee account with email and password.
2. Tester logs in.
3. Creates an ExitProof case.
4. Submits Laptop Return evidence.
5. Copies the HR verification link.
6. Opens it in Incognito/another browser.
7. HR approves.
8. Employee dashboard shows Laptop Return as **Validated**.
9. Tester logs out, logs back in, and sees the same persisted case.

**Full MVP criteria:**
1. Sign up with email + password + confirm works on the Vercel URL with no email step; mismatched/short passwords are rejected; log in and log out work; no password reset, social login, or magic link anywhere.
2. Two different employee accounts cannot see or modify each other's cases, items, or files (verified by URL tampering and by querying with the other user's session).
3. The demo reviewer account can log in and see its seeded case; no credentials appear in the repo.
4. Employee can create a case with the default items (any untickable) plus a custom item.
5. Dashboard shows every item's status, submitted date, response target and overdue flag; usable at 375 px width.
6. Employee can add a note and upload allowed files; disallowed type/size is rejected with a message.
7. Submit → **Awaiting Validation**, `response_due_at = submitted_at + response_days`, copyable HR link.
8. HR link works in another browser with no login; shows employee, item, note, viewable files.
9. HR can Approve / Request info / Reject; Reject and Request info are refused without a comment (UI and server).
10. Employee dashboard reflects HR action within ~10 s without manual reload; state survives refresh, browser restart, and log out/in.
11. Only HR Approve can produce **Validated**.
12. Needs Information / Rejected show the HR comment and can be resubmitted; old link becomes inert.
13. Awaiting Validation past target shows **Overdue** with days overdue.
14. Escalation page generates a copyable message (item, dates, days overdue, HR link) with no legal or entitlement claims.
15. All items Validated → **"All tracked exit items resolved."**
16. Item history shows submissions, decisions, comments and timestamps.
17. Invalid/expired/used HR tokens cannot change anything; bucket is private.
18. Full demo scenario runs end-to-end on production twice without errors.

## Out of scope

HR dashboard, company admin, IT/Finance/Manager portals, payroll, F&F calculation, PF, legal advice, HRIS integration, SSO, social login, MFA, magic links, password reset, email verification, AI chatbot, automated escalation emails, analytics, payments, settings pages, job search, resume features.
