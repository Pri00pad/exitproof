-- ExitProof — request workflow, part B: schema, functions, HR document storage.
-- Requires 20261025090000_request_workflow_enums.sql to have been run (and
-- committed) first.
--
-- Two workflows now share one data model:
--   validation  not_submitted → awaiting_validation → validated | needs_information | rejected
--               (unchanged; needs_information / rejected can be resubmitted)
--   request     not_submitted → requested → hr_responded → completed
--               (hr_responded can be re-requested: a NEW submission, token and
--               response target; the previous link stays closed. completed is final.)
--
-- A request round is a public.submissions row like any other: the employee's
-- request note, the hashed verification token, the response target, and HR's
-- action (decision = 'responded', decided_at, optional hr_comment). The files HR
-- sends are public.evidence_files rows with uploaded_by = 'hr', stored in the
-- private 'hr-documents' bucket. Each file row records its own bucket.
--
-- Security model is unchanged:
--   * employees still have no UPDATE/DELETE on any table; every status change
--     is a SECURITY DEFINER function that checks ownership inside.
--   * public.hr_respond is service_role only (called by the server-side
--     /verify action after it hashes the token), like public.hr_decide.
--   * HR documents are written only through server-issued signed upload URLs
--     into a folder the server derives from the token's own submission;
--     employees can read (never write) the documents for items they own.
--
-- Existing rows: every item becomes workflow_type = 'validation', every file
-- uploaded_by = 'employee' / storage_bucket = 'evidence'. No statuses, tokens or
-- submissions change, so outstanding verification links keep working.

begin;

-- ---------------------------------------------------------------------------
-- Columns and constraints
-- ---------------------------------------------------------------------------

-- Default stays 'validation': custom items and any insert that omits the
-- column follow the validation workflow. Employees have no UPDATE grant, so the
-- workflow of an item can never change after it is created.
alter table public.exit_items
  add column workflow_type public.item_workflow not null default 'validation';

alter table public.exit_items
  add constraint exit_items_status_matches_workflow
  check (
    case workflow_type
      when 'validation' then status in ('not_submitted', 'awaiting_validation', 'validated',
                                        'needs_information', 'rejected')
      when 'request'    then status in ('not_submitted', 'requested', 'hr_responded', 'completed')
      else false
    end
  );

-- Files can now live in either private bucket; signing/download code uses the
-- row's own storage_bucket + storage_path. The defaults only backfill existing
-- rows and are dropped below, so every new file row must state both.
alter table public.evidence_files
  add column storage_bucket text not null default 'evidence',
  add column uploaded_by    public.event_actor not null default 'employee';

alter table public.evidence_files
  alter column storage_bucket drop default,
  alter column uploaded_by    drop default;

alter table public.evidence_files
  add constraint evidence_files_storage_bucket_check
    check (storage_bucket in ('evidence', 'hr-documents')),
  -- Employee evidence lives only in 'evidence'; HR documents only in 'hr-documents'.
  add constraint evidence_files_bucket_matches_uploader
    check ((uploaded_by = 'employee' and storage_bucket = 'evidence')
           or (uploaded_by = 'hr' and storage_bucket = 'hr-documents'));

-- 'responded' joins 'approved' as an HR action that needs no comment
-- (a request response must carry at least one document instead — see hr_respond).
alter table public.submissions drop constraint submissions_comment_required;
alter table public.submissions
  add constraint submissions_comment_required
  check (decision is null
         or decision in ('approved', 'responded')
         or char_length(btrim(coalesce(hr_comment, ''))) > 0);

alter table public.verification_events drop constraint verification_events_actor_matches_action;
alter table public.verification_events
  add constraint verification_events_actor_matches_action
  check ((actor = 'hr') = (action in ('approved', 'rejected', 'info_requested', 'responded')));

-- ---------------------------------------------------------------------------
-- Status-transition functions
-- ---------------------------------------------------------------------------

-- Employee starts a round. Same signature as before, so existing callers work.
--   validation: submit or resubmit evidence (note and/or 1–5 files)
--               from not_submitted | needs_information | rejected → awaiting_validation
--   request:    send a request note to HR (no files)
--               from not_submitted | hr_responded (re-request) → requested
-- Either way: a new submission, a new token hash, a new response target.
create or replace function public.submit_exit_item(
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
  v_new_status public.item_status;
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

  v_file_count := jsonb_array_length(p_files);

  if v_item.workflow_type = 'validation' then
    if v_item.status not in ('not_submitted', 'needs_information', 'rejected') then
      raise exception 'item_not_submittable' using errcode = '22023';
    end if;
    if v_file_count > 5 then
      raise exception 'too_many_files' using errcode = '22023';
    end if;
    if v_note = '' and v_file_count = 0 then
      raise exception 'evidence_required' using errcode = '22023';
    end if;
    v_new_status := 'awaiting_validation';
  else
    if v_item.status not in ('not_submitted', 'hr_responded') then
      raise exception 'item_not_submittable' using errcode = '22023';
    end if;
    if v_note = '' then
      raise exception 'request_note_required' using errcode = '22023';
    end if;
    -- The employee asks; HR provides. Employees attach nothing to a request.
    if v_file_count > 0 then
      raise exception 'request_files_not_allowed' using errcode = '22023';
    end if;
    v_new_status := 'requested';
  end if;

  select c.response_days into v_days from public.exit_cases c where c.id = v_item.case_id;

  insert into public.submissions (item_id, note, response_due_at, verify_token_hash, verify_token_expires_at)
  values (v_item.id, v_note, now() + make_interval(days => v_days), p_token_hash, now() + interval '30 days')
  returning id into v_sub_id;

  -- Only validation rounds reach this loop with files.
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
    insert into public.evidence_files
      (submission_id, storage_bucket, storage_path, original_name, mime_type, size_bytes, uploaded_by)
    values
      (v_sub_id, 'evidence', v_path, v_name, v_meta ->> 'mimetype', (v_meta ->> 'size')::bigint, 'employee');
  end loop;

  update public.exit_items
  set status = v_new_status, current_submission_id = v_sub_id, updated_at = now()
  where id = v_item.id;

  insert into public.verification_events (item_id, submission_id, actor, action)
  values (v_item.id, v_sub_id, 'employee', 'submitted');

  return v_sub_id;
end;
$$;

-- Employee replaces the HR link for a round still waiting on HR
-- (awaiting_validation or requested). The old link stops working because its
-- hash no longer exists. Error code kept from part 1 for existing callers.
create or replace function public.regenerate_verify_link(p_item_id uuid, p_token_hash text)
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
  if v_item.status not in ('awaiting_validation', 'requested') then
    raise exception 'item_not_awaiting_validation' using errcode = '22023';
  end if;

  update public.submissions
  set verify_token_hash = p_token_hash, verify_token_expires_at = now() + interval '30 days'
  where id = v_item.current_submission_id and decision is null;

  insert into public.verification_events (item_id, submission_id, actor, action)
  values (v_item.id, v_item.current_submission_id, 'employee', 'link_regenerated');
end;
$$;

-- HR decision on a VALIDATION round. SERVICE ROLE ONLY. Unchanged except for
-- the explicit workflow guard (request rounds can never hold
-- awaiting_validation, so this is defence in depth).
create or replace function public.hr_decide(
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
  if p_decision is null or p_decision not in ('approved', 'rejected', 'info_requested') then
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

  if v_item.workflow_type <> 'validation' then
    raise exception 'wrong_workflow' using errcode = '22023';
  end if;
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

-- HR response to a REQUEST round: send 1–5 documents (+ optional comment).
-- SERVICE ROLE ONLY: called by the server-side /verify action after it hashes
-- the token from the URL. The documents must already be in the private
-- 'hr-documents' bucket at {owner_uid}/{item_id}/{submission_id}/{file} — the
-- folder of THIS token's submission, so a token can never attach files to any
-- other submission, item or employee. Size and MIME type come from Storage.
create function public.hr_respond(
  p_token_hash  text,
  p_comment     text  default null,
  p_files       jsonb default '[]'::jsonb
)
returns public.item_status
language plpgsql security definer set search_path = ''
as $$
declare
  v_comment    text := nullif(btrim(p_comment), '');
  v_sub        public.submissions;
  v_item       public.exit_items;
  v_owner      uuid;
  v_file_count integer;
  v_file       jsonb;
  v_path       text;
  v_name       text;
  v_meta       jsonb;
begin
  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'comment_too_long' using errcode = '22023';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'invalid_files' using errcode = '22023';
  end if;
  v_file_count := jsonb_array_length(p_files);
  if v_file_count = 0 then
    raise exception 'document_required' using errcode = '22023';
  end if;
  if v_file_count > 5 then
    raise exception 'too_many_files' using errcode = '22023';
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
  select c.owner_user_id into v_owner from public.exit_cases c where c.id = v_item.case_id;

  if v_item.workflow_type <> 'request' then
    raise exception 'wrong_workflow' using errcode = '22023';
  end if;
  if v_item.current_submission_id is distinct from v_sub.id
     or v_item.status <> 'requested' then
    raise exception 'submission_not_current' using errcode = '22023';
  end if;

  for v_file in select * from jsonb_array_elements(p_files)
  loop
    v_path := v_file ->> 'path';
    v_name := left(coalesce(nullif(btrim(v_file ->> 'name'), ''), 'document'), 255);

    -- Exactly {owner}/{item}/{this submission}/{file}.
    if v_path is null
       or v_path !~ ('^' || v_owner::text || '/' || v_item.id::text || '/' || v_sub.id::text || '/[^/]+$') then
      raise exception 'invalid_file_path' using errcode = '22023';
    end if;

    -- Employees cannot write to this bucket (no policy), so an object here was
    -- uploaded through a server-issued signed upload URL.
    select o.metadata into v_meta
    from storage.objects o
    where o.bucket_id = 'hr-documents' and o.name = v_path;

    if not found then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;

    -- evidence_files constraints re-check MIME allowlist, 10 MB, bucket/uploader pairing.
    insert into public.evidence_files
      (submission_id, storage_bucket, storage_path, original_name, mime_type, size_bytes, uploaded_by)
    values
      (v_sub.id, 'hr-documents', v_path, v_name, v_meta ->> 'mimetype', (v_meta ->> 'size')::bigint, 'hr');
  end loop;

  update public.submissions
  set decision = 'responded', decided_at = now(), hr_comment = v_comment
  where id = v_sub.id;

  update public.exit_items
  set status = 'hr_responded', updated_at = now()
  where id = v_item.id;

  insert into public.verification_events (item_id, submission_id, actor, action, comment)
  values (v_item.id, v_sub.id, 'hr', 'responded', v_comment);

  return 'hr_responded'::public.item_status;
end;
$$;

-- Employee confirms they received what HR sent. hr_responded → completed (final).
create function public.confirm_received(p_item_id uuid)
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

  select i.* into v_item
  from public.exit_items i
  join public.exit_cases c on c.id = i.case_id
  where i.id = p_item_id and c.owner_user_id = v_uid
  for update of i;

  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if v_item.workflow_type <> 'request' then
    raise exception 'wrong_workflow' using errcode = '22023';
  end if;
  if v_item.status <> 'hr_responded' then
    raise exception 'item_not_awaiting_confirmation' using errcode = '22023';
  end if;

  update public.exit_items
  set status = 'completed', updated_at = now()
  where id = v_item.id;

  insert into public.verification_events (item_id, submission_id, actor, action)
  values (v_item.id, v_item.current_submission_id, 'employee', 'receipt_confirmed');
end;
$$;

-- Privileges: re-stated for the replaced functions; new functions get the same
-- treatment (Supabase's default privileges would otherwise grant anon).
revoke all on function public.submit_exit_item(uuid, text, text, jsonb) from public, anon;
revoke all on function public.regenerate_verify_link(uuid, text)        from public, anon;
revoke all on function public.confirm_received(uuid)                    from public, anon;
revoke all on function public.hr_decide(text, public.hr_decision, text)  from public, anon, authenticated;
revoke all on function public.hr_respond(text, text, jsonb)              from public, anon, authenticated;

grant execute on function public.submit_exit_item(uuid, text, text, jsonb) to authenticated;
grant execute on function public.regenerate_verify_link(uuid, text)        to authenticated;
grant execute on function public.confirm_received(uuid)                    to authenticated;
grant execute on function public.hr_decide(text, public.hr_decision, text)  to service_role;
grant execute on function public.hr_respond(text, text, jsonb)              to service_role;

-- ---------------------------------------------------------------------------
-- HR document storage
-- Private bucket, same limits as 'evidence'. Object names:
--   {owner_user_id}/{item_id}/{submission_id}/{uuid}.{ext}
-- Writes: none for anon/authenticated. The server creates signed upload URLs
-- with the secret key for paths it derives from a validated token.
-- Reads: the owning employee only (HR never reads these back).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-documents', 'hr-documents', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "exitproof hr-documents: owner can read own item documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'hr-documents'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.owns_item((storage.foldername(name))[2])
  );

commit;
