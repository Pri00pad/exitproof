-- ExitProof — initial schema
-- Tables, enums, constraints, RLS, evidence storage bucket + policies, and the
-- database functions that own every status transition.
--
-- Security model (see docs/PLAN.md):
--   * Employees (role `authenticated`) can only reach rows under an exit case
--     where owner_user_id = auth.uid(). Enforced by RLS, not by the app.
--   * Employees have NO update/delete privileges on any table. Item status only
--     changes through:
--       - public.submit_exit_item / public.regenerate_verify_link (employee,
--         ownership checked inside), and
--       - public.hr_decide (service_role ONLY — called by the server-side HR
--         action after it hashes the /verify token). This is the only code path
--         that can set an item to 'validated'.
--   * HR has no account. HR never talks to Supabase directly. A decision proves
--     possession of the verification link, not the identity of a specific HR
--     person (accepted MVP limitation — see docs/PLAN.md).
--   * Anonymous role (`anon`) gets no table access at all.
--
-- Run once, on a fresh project, in the Supabase SQL Editor. The whole script is
-- one transaction: if any statement fails, nothing is applied.

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.item_status as enum (
  'not_submitted',
  'awaiting_validation',
  'validated',
  'needs_information',
  'rejected'
);
-- 'Overdue' is intentionally NOT a status: it is derived in the app from
-- status = 'awaiting_validation' AND now() > submissions.response_due_at.

create type public.hr_decision as enum ('approved', 'rejected', 'info_requested');

create type public.event_actor as enum ('employee', 'hr');

create type public.event_action as enum (
  'submitted',
  'approved',
  'rejected',
  'info_requested',
  'link_regenerated'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.exit_cases (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  employee_name     text not null check (char_length(btrim(employee_name)) between 1 and 200),
  company_name      text not null check (char_length(btrim(company_name)) between 1 and 200),
  hr_contact_name   text not null check (char_length(btrim(hr_contact_name)) between 1 and 200),
  hr_contact_email  text check (
                      hr_contact_email is null
                      or (char_length(hr_contact_email) <= 320
                          and hr_contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
                    ),
  last_working_day  date,
  -- ExitProof's default response target (product setting, not a legal deadline).
  response_days     integer not null default 7 check (response_days between 1 and 60),
  created_at        timestamptz not null default now()
);

create table public.exit_items (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references public.exit_cases (id) on delete cascade,
  title                  text not null check (char_length(btrim(title)) between 1 and 120),
  is_default             boolean not null default false,
  sort_order             integer not null default 0,
  status                 public.item_status not null default 'not_submitted',
  current_submission_id  uuid,  -- FK added after public.submissions exists
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- An item has a current submission exactly when it has ever been submitted.
  constraint exit_items_submission_matches_status
    check ((status = 'not_submitted') = (current_submission_id is null))
);

create table public.submissions (
  id                       uuid primary key default gen_random_uuid(),
  item_id                  uuid not null references public.exit_items (id) on delete cascade,
  note                     text not null default '' check (char_length(note) <= 5000),
  submitted_at             timestamptz not null default now(),
  -- Fixed at submit time = submitted_at + exit_cases.response_days.
  response_due_at          timestamptz not null,
  -- SHA-256 (hex) of the HR verification token. The raw token is never stored.
  verify_token_hash        text not null unique check (verify_token_hash ~ '^[0-9a-f]{64}$'),
  verify_token_expires_at  timestamptz not null,
  decision                 public.hr_decision,
  decided_at               timestamptz,
  hr_comment               text check (hr_comment is null or char_length(hr_comment) <= 2000),
  constraint submissions_decision_has_timestamp
    check ((decision is null) = (decided_at is null)),
  constraint submissions_comment_required
    check (decision is null
           or decision = 'approved'
           or char_length(btrim(coalesce(hr_comment, ''))) > 0)
);

alter table public.exit_items
  add constraint exit_items_current_submission_fk
  foreign key (current_submission_id) references public.submissions (id) on delete set null;

create table public.evidence_files (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions (id) on delete cascade,
  -- Object name in the 'evidence' bucket: {user_id}/{item_id}/{uuid}.{ext}
  storage_path   text not null unique,
  original_name  text not null check (char_length(original_name) between 1 and 255),
  mime_type      text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at     timestamptz not null default now()
);

create table public.verification_events (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.exit_items (id) on delete cascade,
  submission_id  uuid references public.submissions (id) on delete cascade,
  actor          public.event_actor not null,
  action         public.event_action not null,
  comment        text check (comment is null or char_length(comment) <= 2000),
  created_at     timestamptz not null default now(),
  constraint verification_events_actor_matches_action
    check ((actor = 'hr') = (action in ('approved', 'rejected', 'info_requested'))),
  constraint verification_events_comment_required
    check (action not in ('rejected', 'info_requested')
           or char_length(btrim(coalesce(comment, ''))) > 0)
);

create index exit_cases_owner_idx          on public.exit_cases (owner_user_id, created_at desc);
create index exit_items_case_idx           on public.exit_items (case_id, sort_order);
create index submissions_item_idx          on public.submissions (item_id, submitted_at desc);
create index evidence_files_submission_idx on public.evidence_files (submission_id);
create index verification_events_item_idx  on public.verification_events (item_id, created_at);

-- ---------------------------------------------------------------------------
-- Ownership helpers (private schema: not exposed through the Data API)
-- SECURITY DEFINER so policies don't recurse through each table's RLS.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.owns_case(p_case_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.exit_cases c
    where c.id = p_case_id and c.owner_user_id = (select auth.uid())
  );
$$;

-- Takes text so storage policies can pass a path segment without a cast error.
create function private.owns_item(p_item_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.exit_items i
    join public.exit_cases c on c.id = i.case_id
    where i.id::text = p_item_id and c.owner_user_id = (select auth.uid())
  );
$$;

create function private.owns_submission(p_submission_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions s
    join public.exit_items i on i.id = s.item_id
    join public.exit_cases c on c.id = i.case_id
    where s.id = p_submission_id and c.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_case(uuid)       from public, anon;
revoke all on function private.owns_item(text)       from public, anon;
revoke all on function private.owns_submission(uuid) from public, anon;
grant execute on function private.owns_case(uuid)       to authenticated;
grant execute on function private.owns_item(text)       to authenticated;
grant execute on function private.owns_submission(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges + Row Level Security
-- Explicit grants: employees may SELECT their rows, and INSERT cases/items.
-- Everything else is done by the functions below.
-- ---------------------------------------------------------------------------

revoke all on table public.exit_cases, public.exit_items, public.submissions,
                    public.evidence_files, public.verification_events
  from anon, authenticated;

grant select, insert on table public.exit_cases to authenticated;
grant select, insert on table public.exit_items to authenticated;
grant select on table public.submissions, public.evidence_files, public.verification_events
  to authenticated;

grant all on table public.exit_cases, public.exit_items, public.submissions,
                   public.evidence_files, public.verification_events
  to service_role;

alter table public.exit_cases          enable row level security;
alter table public.exit_items          enable row level security;
alter table public.submissions         enable row level security;
alter table public.evidence_files      enable row level security;
alter table public.verification_events enable row level security;

-- exit_cases
create policy "exit_cases: owner can read"
  on public.exit_cases for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "exit_cases: owner can create"
  on public.exit_cases for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

-- exit_items
create policy "exit_items: owner can read"
  on public.exit_items for select to authenticated
  using (private.owns_case(case_id));

create policy "exit_items: owner can add unsubmitted items"
  on public.exit_items for insert to authenticated
  with check (
    private.owns_case(case_id)
    and status = 'not_submitted'
    and current_submission_id is null
  );

-- submissions / evidence_files / verification_events: read-only for the owner
create policy "submissions: owner can read"
  on public.submissions for select to authenticated
  using (private.owns_item(item_id::text));

create policy "evidence_files: owner can read"
  on public.evidence_files for select to authenticated
  using (private.owns_submission(submission_id));

create policy "verification_events: owner can read"
  on public.verification_events for select to authenticated
  using (private.owns_item(item_id::text));

-- ---------------------------------------------------------------------------
-- Status-transition functions
-- ---------------------------------------------------------------------------

-- Employee submits (or resubmits) an item for HR validation.
-- p_files: [{"path": "{uid}/{item_id}/{uuid}.ext", "name": "receipt.jpg"}, ...]
-- The server generates the raw verify token, passes only its SHA-256 hex hash.
-- File size and MIME type are taken from Storage's own metadata, not the client.
create function public.submit_exit_item(
  p_item_id     uuid,
  p_note        text,
  p_token_hash  text,
  p_files       jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_item       public.exit_items;
  v_days       integer;
  v_note       text := coalesce(btrim(p_note), '');
  v_file_count integer;
  v_sub_id     uuid;
  v_file       jsonb;
  v_path       text;
  v_name       text;
  v_meta       jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'invalid_files' using errcode = '22023';
  end if;

  select i.* into v_item
  from public.exit_items i
  join public.exit_cases c on c.id = i.case_id
  where i.id = p_item_id and c.owner_user_id = v_uid
  for update of i;

  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_item.status not in ('not_submitted', 'needs_information', 'rejected') then
    raise exception 'item_not_submittable' using errcode = '22023';
  end if;

  v_file_count := jsonb_array_length(p_files);
  if v_file_count > 5 then
    raise exception 'too_many_files' using errcode = '22023';
  end if;
  if v_note = '' and v_file_count = 0 then
    raise exception 'evidence_required' using errcode = '22023';
  end if;

  select c.response_days into v_days from public.exit_cases c where c.id = v_item.case_id;

  insert into public.submissions (item_id, note, response_due_at, verify_token_hash, verify_token_expires_at)
  values (v_item.id, v_note, now() + make_interval(days => v_days), p_token_hash, now() + interval '30 days')
  returning id into v_sub_id;

  for v_file in select * from jsonb_array_elements(p_files)
  loop
    v_path := v_file ->> 'path';
    v_name := left(coalesce(nullif(btrim(v_file ->> 'name'), ''), 'evidence'), 255);

    -- Exactly {uid}/{item_id}/{file}: no extra segments, no other user/item.
    if v_path is null or v_path !~ ('^' || v_uid::text || '/' || v_item.id::text || '/[^/]+$') then
      raise exception 'invalid_file_path' using errcode = '22023';
    end if;

    select o.metadata into v_meta
    from storage.objects o
    where o.bucket_id = 'evidence' and o.name = v_path and o.owner_id = v_uid::text;

    if not found then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;

    -- evidence_files constraints re-check MIME allowlist and the 10 MB limit.
    insert into public.evidence_files (submission_id, storage_path, original_name, mime_type, size_bytes)
    values (v_sub_id, v_path, v_name, v_meta ->> 'mimetype', (v_meta ->> 'size')::bigint);
  end loop;

  update public.exit_items
  set status = 'awaiting_validation', current_submission_id = v_sub_id, updated_at = now()
  where id = v_item.id;

  insert into public.verification_events (item_id, submission_id, actor, action)
  values (v_item.id, v_sub_id, 'employee', 'submitted');

  return v_sub_id;
end;
$$;

-- Employee replaces the HR link for an item still awaiting validation.
-- The old link stops working because its hash no longer exists.
create function public.regenerate_verify_link(p_item_id uuid, p_token_hash text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.exit_items;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  select i.* into v_item
  from public.exit_items i
  join public.exit_cases c on c.id = i.case_id
  where i.id = p_item_id and c.owner_user_id = v_uid
  for update of i;

  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_item.status <> 'awaiting_validation' then
    raise exception 'item_not_awaiting_validation' using errcode = '22023';
  end if;

  update public.submissions
  set verify_token_hash = p_token_hash, verify_token_expires_at = now() + interval '30 days'
  where id = v_item.current_submission_id and decision is null;

  insert into public.verification_events (item_id, submission_id, actor, action)
  values (v_item.id, v_item.current_submission_id, 'employee', 'link_regenerated');
end;
$$;

-- HR decision. SERVICE ROLE ONLY: called by the server-side /verify action after
-- it hashes the token from the URL. The only path that can set 'validated'.
create function public.hr_decide(
  p_token_hash  text,
  p_decision    public.hr_decision,
  p_comment     text default null
)
returns public.item_status
language plpgsql security definer set search_path = ''
as $$
declare
  v_comment    text := nullif(btrim(p_comment), '');
  v_sub        public.submissions;
  v_item       public.exit_items;
  v_new_status public.item_status;
begin
  if p_decision is null then
    raise exception 'decision_required' using errcode = '22023';
  end if;
  if p_decision in ('rejected', 'info_requested') and v_comment is null then
    raise exception 'comment_required' using errcode = '22023';
  end if;

  select s.* into v_sub
  from public.submissions s
  where s.verify_token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invalid_token' using errcode = 'P0002';
  end if;
  if v_sub.verify_token_expires_at < now() then
    raise exception 'token_expired' using errcode = '22023';
  end if;
  if v_sub.decision is not null then
    raise exception 'already_decided' using errcode = '22023';
  end if;

  select i.* into v_item from public.exit_items i where i.id = v_sub.item_id for update;

  if v_item.current_submission_id is distinct from v_sub.id
     or v_item.status <> 'awaiting_validation' then
    raise exception 'submission_not_current' using errcode = '22023';
  end if;

  v_new_status := case p_decision
    when 'approved' then 'validated'::public.item_status
    when 'rejected' then 'rejected'::public.item_status
    else 'needs_information'::public.item_status
  end;

  update public.submissions
  set decision = p_decision, decided_at = now(), hr_comment = v_comment
  where id = v_sub.id;

  update public.exit_items
  set status = v_new_status, updated_at = now()
  where id = v_item.id;

  insert into public.verification_events (item_id, submission_id, actor, action, comment)
  values (v_item.id, v_sub.id, 'hr', p_decision::text::public.event_action, v_comment);

  return v_new_status;
end;
$$;

revoke all on function public.submit_exit_item(uuid, text, text, jsonb) from public, anon;
revoke all on function public.regenerate_verify_link(uuid, text)        from public, anon;
revoke all on function public.hr_decide(text, public.hr_decision, text)  from public, anon, authenticated;

grant execute on function public.submit_exit_item(uuid, text, text, jsonb) to authenticated;
grant execute on function public.regenerate_verify_link(uuid, text)        to authenticated;
grant execute on function public.hr_decide(text, public.hr_decision, text)  to service_role;

-- ---------------------------------------------------------------------------
-- Evidence storage
-- Private bucket; Storage itself enforces the 10 MB limit and MIME allowlist.
-- Object names: {user_id}/{item_id}/{uuid}.{ext}
-- HR never gets a policy: the server creates short-lived signed URLs with the
-- secret key after validating the /verify token.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload only into {own uid}/{an item you own}/<file>, with an allowed extension.
-- No UPDATE policy: uploads must use upsert = false, files cannot be overwritten.
-- No DELETE policy: submitted evidence cannot be swapped after the fact.
create policy "exitproof evidence: owner can upload to own item folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.owns_item((storage.foldername(name))[2])
    and lower(storage.extension(name)) in ('pdf', 'png', 'jpg', 'jpeg', 'webp')
  );

-- Read uses the same ownership standard as upload.
create policy "exitproof evidence: owner can read own item files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.owns_item((storage.foldername(name))[2])
  );

commit;
