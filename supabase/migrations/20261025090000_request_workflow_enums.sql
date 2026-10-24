-- ExitProof — request workflow, part A: enum values only.
--
-- Run this file ON ITS OWN, before 20261025090100_request_workflow.sql.
-- Postgres cannot use a newly added enum value inside the transaction that
-- added it, and part B's constraints and functions use these values. Running A
-- and B as two separate executions (two SQL Editor runs, or two migration
-- files applied by the Supabase CLI / Branching) commits A first.
--
-- Safe to re-run: every statement is idempotent.

-- Which workflow an exit item follows (fixed when the item is created):
--   validation — the employee submits evidence and HR validates it (Phase 3 flow).
--   request    — the employee asks HR for something and HR sends a document back.
do $$
begin
  create type public.item_workflow as enum ('validation', 'request');
exception
  when duplicate_object then null;
end
$$;

-- Request-workflow item statuses. 'Overdue' is still derived, never stored.
alter type public.item_status add value if not exists 'requested';     -- Requested from HR
alter type public.item_status add value if not exists 'hr_responded';  -- Document Available
alter type public.item_status add value if not exists 'completed';     -- employee confirmed receipt

-- HR's single action on a request round: send the requested document(s).
alter type public.hr_decision add value if not exists 'responded';

alter type public.event_action add value if not exists 'responded';          -- actor: hr
alter type public.event_action add value if not exists 'receipt_confirmed';  -- actor: employee
