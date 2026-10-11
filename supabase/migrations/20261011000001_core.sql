-- Aventus Realtors CRM — core schema (Phase 1)
-- Every business rule from the blueprint lives here so it cannot be bypassed from the browser:
-- round robin, phone dedupe, mandatory follow ups, stage requirements, deals and the time rules.

create extension if not exists pgcrypto;

-- ───────────────────────────── Types ─────────────────────────────
create type public.user_role as enum ('founder', 'agent');
create type public.lead_source as enum ('bought', 'meta', 'instagram');
create type public.lead_stage as enum ('new', 'contacted', 'shortlisting', 'meeting', 'negotiation', 'won', 'lost');
create type public.call_outcome as enum ('connected', 'not_answered', 'busy', 'switched_off', 'wrong_number');
create type public.activity_type as enum ('call', 'note', 'stage_change', 'meeting', 'reassignment', 'whatsapp', 'followup', 'system', 'duplicate', 'deal');
create type public.meeting_type as enum ('site_visit', 'sales_office', 'video_call', 'office');
create type public.meeting_status as enum ('scheduled', 'done', 'no_show');
create type public.unit_feedback as enum ('pending', 'liked', 'maybe', 'rejected');
create type public.commission_status as enum ('pending', 'received');

create or replace function public.stage_rank(s public.lead_stage) returns int
language sql immutable as $$
  select case s when 'new' then 1 when 'contacted' then 2 when 'shortlisting' then 3
    when 'meeting' then 4 when 'negotiation' then 5 when 'won' then 6 when 'lost' then 7 end
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ───────────────────────────── Tables ─────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text,
  email text,
  role public.user_role not null default 'agent',
  active boolean not null default true,
  on_leave boolean not null default false,
  round_robin_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Aventus Realtors',
  timezone text not null default 'Asia/Dubai',
  sla_minutes int not null default 60,
  reassign_hours int not null default 24,
  max_attempts int not null default 6,
  attempt_window_days int not null default 7,
  stale_days int not null default 7,
  recycle_days int not null default 30,
  future_buyer_days int not null default 60,
  lost_reasons text[] not null default array['Not interested','Budget mismatch','Bought elsewhere','Unreachable','Future buyer','Not genuine'],
  reject_reasons text[] not null default array['Price','Location','Layout','View','Handover'],
  cadence_days int[] not null default array[1,3,7,15,30],
  rr_last_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

create table public.developers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_commission_pct numeric(5,2) not null default 2,
  contact_name text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text,
  cost numeric(12,2),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  total_rows int not null default 0,
  imported int not null default 0,
  duplicates int not null default 0,
  invalid int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  alt_phone text,
  email text,
  nationality text,
  is_nri boolean not null default false,
  source public.lead_source not null,
  batch_id uuid references public.lead_batches(id) on delete set null,
  campaign text,
  ad_name text,
  owner_id uuid references public.profiles(id) on delete set null,
  stage public.lead_stage not null default 'new',
  lost_reason text,
  lost_at timestamptz,
  selected_project text,
  selected_unit text,
  next_followup_at timestamptz,
  assigned_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  first_called_at timestamptz,
  attempt_count int not null default 0,
  sla_breached boolean not null default false,
  is_stale boolean not null default false,
  in_recycle_pool boolean not null default false,
  needs_founder_attention boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint open_lead_needs_followup check (
    stage in ('won','lost','new') or next_followup_at is not null
  )
);
create index leads_owner_idx on public.leads(owner_id);
create index leads_stage_idx on public.leads(stage);
create index leads_followup_idx on public.leads(next_followup_at);
create index leads_created_idx on public.leads(created_at);

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  area text,
  bedrooms text,
  ready_or_offplan text check (ready_or_offplan in ('ready','offplan','either')),
  handover_year int,
  payment_plan text,
  purpose text check (purpose in ('end_use','investment')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shortlisted_units (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  project text not null,
  developer_id uuid references public.developers(id) on delete set null,
  unit_type text,
  price numeric(14,2),
  feedback public.unit_feedback not null default 'pending',
  reject_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shortlisted_lead_idx on public.shortlisted_units(lead_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  type public.activity_type not null,
  call_outcome public.call_outcome,
  note text,
  from_stage public.lead_stage,
  to_stage public.lead_stage,
  followup_due_at timestamptz,   -- follow up that was due when this was logged
  on_time boolean,               -- logged on or before that due time
  next_followup_at timestamptz,  -- follow up set by this activity
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_lead_idx on public.activities(lead_id, created_at desc);
create index activities_user_idx on public.activities(user_id, created_at);
create index activities_type_idx on public.activities(type, created_at);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  type public.meeting_type not null,
  scheduled_at timestamptz not null,
  location text,
  status public.meeting_status not null default 'scheduled',
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_lead_idx on public.meetings(lead_id);
create index meetings_user_idx on public.meetings(user_id, scheduled_at);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  developer_id uuid references public.developers(id) on delete set null,
  project text not null,
  unit text,
  sale_value numeric(14,2) not null check (sale_value >= 0),
  commission_pct numeric(5,2) not null check (commission_pct >= 0),
  commission_amount numeric(14,2) generated always as (round(sale_value * commission_pct / 100, 2)) stored,
  agent_id uuid references public.profiles(id) on delete set null,
  split_agent_id uuid references public.profiles(id) on delete set null,
  split_pct numeric(5,2) not null default 0 check (split_pct between 0 and 100),
  booked_via text not null default 'Direct',
  booking_date date not null default current_date,
  expected_commission_date date,
  commission_status public.commission_status not null default 'pending',
  received_date date,
  received_amount numeric(14,2),
  cancelled boolean not null default false,
  cancelled_at timestamptz,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_agent_idx on public.deals(agent_id);
create index deals_booking_idx on public.deals(booking_date);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profiles','settings','developers','lead_batches','meta_campaigns','leads','requirements',
                           'shortlisted_units','activities','meetings','deals','notifications'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ───────────────────────────── Helpers ─────────────────────────────
create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'founder' and active)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.can_access_lead(p_lead uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_founder() or exists (select 1 from public.leads where id = p_lead and owner_id = auth.uid())
$$;

-- Normalise to +<digits>. Local UAE numbers (05x / 5x) get +971.
create or replace function public.normalize_phone(p text) returns text
language plpgsql immutable as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '[^0-9+]', '', 'g');
  if d like '00%' then d := '+' || substr(d, 3); end if;
  if d like '+%' then d := '+' || regexp_replace(substr(d, 2), '[^0-9]', '', 'g');
  else
    d := regexp_replace(d, '[^0-9]', '', 'g');
    if d like '05%' and length(d) = 10 then d := '+971' || substr(d, 2);
    elsif d like '5%' and length(d) = 9 then d := '+971' || d;
    elsif d like '971%' then d := '+' || d;
    else d := '+' || d;
    end if;
  end if;
  if length(d) < 9 or length(d) > 16 then return null; end if;
  return d;
end $$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text default null,
                                         p_lead uuid default null, p_deal uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, lead_id, deal_id)
  select p_user, p_kind, p_title, p_body, p_lead, p_deal where p_user is not null
$$;

create or replace function public.notify_founders(p_kind text, p_title text, p_body text default null,
                                                  p_lead uuid default null, p_deal uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, lead_id, deal_id)
  select id, p_kind, p_title, p_body, p_lead, p_deal from public.profiles where role = 'founder' and active
$$;

-- New auth user → profile. The very first user becomes the founder. Later accounts are only active when
-- created by the founder (service role sets app_metadata.invited), so public sign ups get no access.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_first boolean; v_invited boolean := coalesce((new.raw_app_meta_data->>'invited')::boolean, false);
begin
  select v_invited and not exists (select 1 from public.profiles where role = 'founder') into v_first;
  insert into public.profiles (id, name, email, phone, role, active, round_robin_order)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
          new.email,
          coalesce(new.raw_user_meta_data->>'phone', new.phone),
          case when v_first then 'founder'::public.user_role else 'agent'::public.user_role end,
          v_invited,
          coalesce((select max(round_robin_order) + 1 from public.profiles), 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Supabase Auth may write app_metadata right after the insert, so activate on that update too.
create or replace function public.handle_user_invited() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((new.raw_app_meta_data->>'invited')::boolean, false)
     and not coalesce((old.raw_app_meta_data->>'invited')::boolean, false) then
    update public.profiles set active = true,
      role = case when not exists (select 1 from public.profiles where role = 'founder') then 'founder'::public.user_role else role end
    where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_invited after update of raw_app_meta_data on auth.users for each row execute function public.handle_user_invited();

create or replace function public.founder_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'founder')
$$;

-- Round robin: next active, not on leave agent after the last one who received a lead.
create or replace function public.next_round_robin_agent(p_exclude uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_last uuid; v_last_order int; v_next uuid;
begin
  select rr_last_user_id into v_last from public.settings where id = 1 for update;
  select round_robin_order into v_last_order from public.profiles where id = v_last;
  select id into v_next from public.profiles
   where role = 'agent' and active and not on_leave and id is distinct from p_exclude
   order by (case when v_last_order is null or round_robin_order > v_last_order
                    or (round_robin_order = v_last_order and id > v_last) then 0 else 1 end),
            round_robin_order, id
   limit 1;
  if v_next is null and p_exclude is null then
    -- No agents yet: company leads go to the founder so nothing is lost.
    select id into v_next from public.profiles where role = 'founder' and active order by created_at limit 1;
  end if;
  if v_next is not null then
    update public.settings set rr_last_user_id = v_next where id = 1;
  end if;
  return v_next;
end $$;

-- ───────────────────────────── Lead intake ─────────────────────────────
-- Single entry point for all three channels. Phone is the unique key.
create or replace function public._ingest_lead(
  p_actor uuid, p_name text, p_phone text, p_source public.lead_source,
  p_email text default null, p_batch uuid default null, p_campaign text default null,
  p_ad_name text default null, p_note text default null, p_nationality text default null,
  p_owner uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_existing public.leads;
  v_owner uuid;
  v_lead uuid;
  v_label text;
begin
  if v_phone is null then return jsonb_build_object('status', 'invalid', 'phone', p_phone); end if;
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('status', 'invalid', 'phone', p_phone, 'reason', 'name'); end if;

  v_label := case p_source when 'bought' then 'Bought list' when 'meta' then 'Meta ads' else 'Instagram' end;

  select * into v_existing from public.leads where phone = v_phone for update;
  if found then
    insert into public.activities(lead_id, user_id, type, note, meta)
    values (v_existing.id, p_actor, 'duplicate',
            format('Came in again via %s on %s', v_label, to_char(now() at time zone 'Asia/Dubai', 'DD Mon YYYY')),
            jsonb_build_object('source', p_source, 'campaign', p_campaign, 'batch_id', p_batch, 'note', p_note));
    if v_existing.stage = 'lost' then
      update public.leads set stage = 'new', lost_reason = null, lost_at = null, next_followup_at = null,
        in_recycle_pool = false, is_stale = false, sla_breached = false,
        assigned_at = now(), last_activity_at = now()
      where id = v_existing.id;
      insert into public.activities(lead_id, user_id, type, from_stage, to_stage, note)
      values (v_existing.id, p_actor, 'stage_change', 'lost', 'new', 'Reopened automatically: lead came in again');
    end if;
    perform public.notify(v_existing.owner_id, 'duplicate', format('%s came in again via %s', v_existing.name, v_label),
      case when v_existing.stage = 'lost' then 'Lead was Lost and has been reopened as New.' else null end, v_existing.id);
    return jsonb_build_object('status', 'duplicate', 'lead_id', v_existing.id, 'owner_id', v_existing.owner_id, 'phone', v_phone);
  end if;

  if p_source = 'instagram' then
    v_owner := coalesce(p_owner, p_actor);
  else
    v_owner := coalesce(p_owner, public.next_round_robin_agent());
  end if;

  insert into public.leads(name, phone, email, nationality, source, batch_id, campaign, ad_name, owner_id, created_by)
  values (trim(p_name), v_phone, nullif(trim(p_email), ''), nullif(trim(p_nationality), ''), p_source, p_batch,
          nullif(trim(p_campaign), ''), nullif(trim(p_ad_name), ''), v_owner, p_actor)
  returning id into v_lead;

  insert into public.activities(lead_id, user_id, type, note, meta)
  values (v_lead, p_actor, 'system',
          format('Lead created via %s%s', v_label, case when p_source = 'instagram' then '' else ' · Round robin' end),
          jsonb_build_object('source', p_source, 'campaign', p_campaign, 'ad_name', p_ad_name, 'owner_id', v_owner));
  if coalesce(trim(p_note), '') <> '' then
    insert into public.activities(lead_id, user_id, type, note) values (v_lead, p_actor, 'note', trim(p_note));
  end if;

  if v_owner is distinct from p_actor then
    perform public.notify(v_owner, 'new_lead', format('New lead: %s', trim(p_name)), format('Assigned via %s. Call within the SLA.', v_label), v_lead);
  end if;
  return jsonb_build_object('status', 'created', 'lead_id', v_lead, 'owner_id', v_owner, 'phone', v_phone);
end $$;

-- Manual add (agents: Instagram/walk-in, owned by themselves; founder: any source).
create or replace function public.add_lead(
  p_name text, p_phone text, p_source public.lead_source default 'instagram', p_email text default null,
  p_note text default null, p_nationality text default null, p_campaign text default null, p_owner uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() then raise exception 'Not allowed'; end if;
  if not public.is_founder() and (p_source <> 'instagram' or (p_owner is not null and p_owner <> auth.uid())) then
    raise exception 'Agents can only add their own Instagram / walk-in leads';
  end if;
  return public._ingest_lead(auth.uid(), p_name, p_phone, p_source, p_email, null, p_campaign, null, p_note, p_nationality, p_owner);
end $$;

-- Live duplicate check while typing (returns only minimal info, never another agent's lead details).
create or replace function public.check_phone(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.leads; v_norm text := public.normalize_phone(p_phone);
begin
  if not public.is_active_user() then raise exception 'Not allowed'; end if;
  if v_norm is null then return jsonb_build_object('valid', false); end if;
  select * into v from public.leads where phone = v_norm;
  if not found then return jsonb_build_object('valid', true, 'exists', false, 'phone', v_norm); end if;
  return jsonb_build_object('valid', true, 'exists', true, 'phone', v_norm,
    'mine', v.owner_id = auth.uid() or public.is_founder(),
    'lead_id', case when v.owner_id = auth.uid() or public.is_founder() then v.id end,
    'owner_name', (select name from public.profiles where id = v.owner_id),
    'stage', v.stage);
end $$;

-- Excel import: rows = [{name, phone, email, note, nationality}]
-- Large files are sent in chunks: the first call creates the batch, later calls pass p_batch to append.
create or replace function public.import_batch(p_name text, p_vendor text, p_cost numeric, p_rows jsonb, p_batch uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid; r jsonb; v_res jsonb;
  v_imported int := 0; v_dup int := 0; v_invalid int := 0;
  v_dups jsonb := '[]'::jsonb; v_invalids jsonb := '[]'::jsonb;
  v_split jsonb := '{}'::jsonb; v_owner text;
begin
  if not public.is_founder() then raise exception 'Only the founder can upload leads'; end if;
  if p_batch is null then
    insert into public.lead_batches(name, vendor, cost, uploaded_by, total_rows)
    values (p_name, p_vendor, p_cost, auth.uid(), 0) returning id into v_batch;
  else
    v_batch := p_batch;
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_res := public._ingest_lead(auth.uid(), r->>'name', r->>'phone', 'bought', r->>'email', v_batch, null, null,
                                 r->>'note', r->>'nationality');
    if v_res->>'status' = 'created' then
      v_imported := v_imported + 1;
      v_owner := v_res->>'owner_id';
      v_split := jsonb_set(v_split, array[v_owner], to_jsonb(coalesce((v_split->>v_owner)::int, 0) + 1));
    elsif v_res->>'status' = 'duplicate' then
      v_dup := v_dup + 1; v_dups := v_dups || jsonb_build_object('name', r->>'name', 'phone', r->>'phone');
    else
      v_invalid := v_invalid + 1; v_invalids := v_invalids || jsonb_build_object('name', r->>'name', 'phone', r->>'phone');
    end if;
  end loop;

  update public.lead_batches set total_rows = total_rows + jsonb_array_length(p_rows), imported = imported + v_imported,
    duplicates = duplicates + v_dup, invalid = invalid + v_invalid where id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'imported', v_imported, 'duplicates', v_dup, 'invalid', v_invalid,
                            'duplicate_rows', v_dups, 'invalid_rows', v_invalids, 'split', v_split);
end $$;

-- Meta Lead Ads webhook entry point (called with the service role key from the Next.js API route).
create or replace function public.ingest_meta_lead(p_name text, p_phone text, p_email text, p_campaign text, p_ad_name text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Not allowed'; end if;
  insert into public.meta_campaigns(name) values (coalesce(nullif(trim(p_campaign), ''), 'Unknown campaign')) on conflict (name) do nothing;
  return public._ingest_lead(null, p_name, p_phone, 'meta', p_email, null, coalesce(nullif(trim(p_campaign), ''), 'Unknown campaign'), p_ad_name, p_note);
end $$;

-- ───────────────────────────── Follow up engine ─────────────────────────────
create or replace function public._assert_followup(p_at timestamptz) returns void
language plpgsql as $$
begin
  if p_at is null then raise exception 'A next follow up date and time is required'; end if;
  if p_at < now() - interval '5 minutes' then raise exception 'Next follow up must be in the future'; end if;
end $$;

-- Internal stage change with all entry requirements. p_data carries stage specific fields.
create or replace function public._change_stage(p_lead uuid, p_to public.lead_stage, p_note text,
                                               p_next timestamptz, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.leads;
  v_meeting_at timestamptz;
  v_next timestamptz := p_next;
begin
  select * into l from public.leads where id = p_lead for update;
  if l.stage = p_to then return; end if;
  if p_to = 'won' then raise exception 'Use the deal form to mark a lead Won'; end if;
  if l.stage = 'won' then raise exception 'This lead is Won. Cancel the deal to reopen it'; end if;

  if l.stage <> 'lost' and public.stage_rank(p_to) < public.stage_rank(l.stage) and coalesce(trim(p_note), '') = '' then
    raise exception 'Moving a lead backwards needs a note';
  end if;

  if p_to = 'contacted' then
    if not exists (select 1 from public.requirements r where r.lead_id = p_lead
                   and (r.budget_max is not null or r.budget_min is not null or r.area is not null or r.bedrooms is not null)) then
      raise exception 'Fill the requirement card (budget, area or bedrooms) before moving to Contacted';
    end if;
    perform public._assert_followup(v_next);
  elsif p_to = 'shortlisting' then
    if not exists (select 1 from public.shortlisted_units where lead_id = p_lead) then
      raise exception 'Add at least one shortlisted unit before moving to Shortlisting';
    end if;
    perform public._assert_followup(v_next);
  elsif p_to = 'meeting' then
    v_meeting_at := (p_data->>'meeting_at')::timestamptz;
    if p_data->>'meeting_type' is null or v_meeting_at is null then
      raise exception 'Meeting type, date and time are required';
    end if;
    insert into public.meetings(lead_id, user_id, type, scheduled_at, location)
    values (p_lead, auth.uid(), (p_data->>'meeting_type')::public.meeting_type, v_meeting_at, p_data->>'location');
    v_next := coalesce(v_next, v_meeting_at);
  elsif p_to = 'negotiation' then
    if coalesce(trim(p_data->>'selected_project'), trim(l.selected_project), '') = ''
       or coalesce(trim(p_data->>'selected_unit'), trim(l.selected_unit), '') = '' then
      raise exception 'Selected project and unit are required for Negotiation';
    end if;
    perform public._assert_followup(v_next);
  elsif p_to = 'lost' then
    if coalesce(trim(p_data->>'lost_reason'), '') = '' then raise exception 'A lost reason is required'; end if;
  elsif p_to = 'new' then
    v_next := null;
  end if;

  update public.leads set
    stage = p_to,
    lost_reason = case when p_to = 'lost' then p_data->>'lost_reason' else null end,
    lost_at = case when p_to = 'lost' then now() else null end,
    selected_project = coalesce(nullif(trim(p_data->>'selected_project'), ''), selected_project),
    selected_unit = coalesce(nullif(trim(p_data->>'selected_unit'), ''), selected_unit),
    next_followup_at = case when p_to = 'lost' then null else v_next end,
    last_activity_at = now(),
    is_stale = false, in_recycle_pool = case when p_to = 'lost' then in_recycle_pool else false end
  where id = p_lead;

  insert into public.activities(lead_id, user_id, type, from_stage, to_stage, note, next_followup_at, meta)
  values (p_lead, auth.uid(), 'stage_change', l.stage, p_to, nullif(trim(p_note), ''),
          case when p_to = 'lost' then null else v_next end,
          coalesce(p_data, '{}'::jsonb) - 'meeting_at' ||
            case when v_meeting_at is not null then jsonb_build_object('meeting_at', v_meeting_at) else '{}'::jsonb end);
end $$;

create or replace function public.change_stage(p_lead uuid, p_to public.lead_stage, p_note text default null,
                                              p_next timestamptz default null, p_data jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  perform public._change_stage(p_lead, p_to, p_note, p_next, coalesce(p_data, '{}'::jsonb));
end $$;

-- Log a call. Connected requires a note; Wrong number closes the lead as Not genuine;
-- every other outcome on an open lead requires the next follow up.
create or replace function public.log_call(p_lead uuid, p_outcome public.call_outcome, p_note text default null,
                                          p_next timestamptz default null, p_stage public.lead_stage default null,
                                          p_data jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = p_lead for update;
  if p_outcome = 'connected' and coalesce(trim(p_note), '') = '' then
    raise exception 'A short note is required for a connected call';
  end if;

  insert into public.activities(lead_id, user_id, type, call_outcome, note, followup_due_at, on_time, next_followup_at)
  values (p_lead, auth.uid(), 'call', p_outcome, nullif(trim(p_note), ''), l.next_followup_at,
          case when l.next_followup_at is null then null else now() <= l.next_followup_at end,
          case when p_outcome = 'wrong_number' then null else p_next end);

  update public.leads set
    attempt_count = attempt_count + 1,
    first_called_at = coalesce(first_called_at, now()),
    last_activity_at = now(), is_stale = false, sla_breached = false, in_recycle_pool = false
  where id = p_lead;

  if p_outcome = 'wrong_number' then
    if l.stage not in ('won', 'lost') then
      perform public._change_stage(p_lead, 'lost', 'Wrong number', null, jsonb_build_object('lost_reason', 'Not genuine'));
    end if;
    return;
  end if;

  if p_stage is not null and p_stage <> l.stage then
    perform public._change_stage(p_lead, p_stage, p_note, p_next, coalesce(p_data, '{}'::jsonb));
  elsif l.stage not in ('won', 'lost') then
    perform public._assert_followup(p_next);
    update public.leads set next_followup_at = p_next where id = p_lead;
  end if;
end $$;

-- Reschedule (swipe left) — still needs a reason when overdue so nothing slips silently.
create or replace function public.set_followup(p_lead uuid, p_next timestamptz, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  perform public._assert_followup(p_next);
  select * into l from public.leads where id = p_lead for update;
  if l.stage in ('won','lost') then raise exception 'Closed leads have no follow up'; end if;
  update public.leads set next_followup_at = p_next where id = p_lead;
  insert into public.activities(lead_id, user_id, type, note, followup_due_at, next_followup_at)
  values (p_lead, auth.uid(), 'followup', coalesce(nullif(trim(p_note), ''), 'Follow up rescheduled'), l.next_followup_at, p_next);
end $$;

create or replace function public.add_note(p_lead uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Note is empty'; end if;
  insert into public.activities(lead_id, user_id, type, note) values (p_lead, auth.uid(), 'note', trim(p_note));
  update public.leads set last_activity_at = now(), is_stale = false where id = p_lead;
end $$;

create or replace function public.log_whatsapp(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  insert into public.activities(lead_id, user_id, type, note) values (p_lead, auth.uid(), 'whatsapp', 'Opened WhatsApp chat');
  update public.leads set last_activity_at = now(), is_stale = false where id = p_lead;
end $$;

create or replace function public.update_meeting(p_meeting uuid, p_status public.meeting_status, p_feedback text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  select lead_id into v_lead from public.meetings where id = p_meeting;
  if v_lead is null or not public.can_access_lead(v_lead) then raise exception 'Not allowed'; end if;
  update public.meetings set status = p_status, feedback = coalesce(nullif(trim(p_feedback), ''), feedback) where id = p_meeting;
  insert into public.activities(lead_id, user_id, type, note, meta)
  values (v_lead, auth.uid(), 'meeting', format('Meeting marked %s%s', replace(p_status::text, '_', ' '),
          case when coalesce(trim(p_feedback), '') <> '' then ': ' || trim(p_feedback) else '' end),
          jsonb_build_object('meeting_id', p_meeting, 'status', p_status));
  update public.leads set last_activity_at = now(), is_stale = false where id = v_lead;
end $$;

create or replace function public.schedule_meeting(p_lead uuid, p_type public.meeting_type, p_at timestamptz, p_location text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; l public.leads;
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = p_lead for update;
  insert into public.meetings(lead_id, user_id, type, scheduled_at, location) values (p_lead, auth.uid(), p_type, p_at, p_location) returning id into v_id;
  insert into public.activities(lead_id, user_id, type, note, meta)
  values (p_lead, auth.uid(), 'meeting', format('Meeting scheduled: %s', replace(p_type::text, '_', ' ')),
          jsonb_build_object('meeting_id', v_id, 'meeting_at', p_at, 'location', p_location));
  update public.leads set last_activity_at = now(), is_stale = false,
    next_followup_at = case when stage in ('won','lost') then next_followup_at
                            when next_followup_at is null or next_followup_at > p_at then p_at else next_followup_at end
  where id = p_lead;
  return v_id;
end $$;

-- ───────────────────────────── Founder actions ─────────────────────────────
create or replace function public.reassign_lead(p_lead uuid, p_owner uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads; v_from text; v_to text;
begin
  if not public.is_founder() then raise exception 'Only the founder can reassign leads'; end if;
  select * into l from public.leads where id = p_lead for update;
  if l.owner_id = p_owner then return; end if;
  select name into v_from from public.profiles where id = l.owner_id;
  select name into v_to from public.profiles where id = p_owner;
  update public.leads set owner_id = p_owner, assigned_at = now(), in_recycle_pool = false, is_stale = false,
    sla_breached = false, needs_founder_attention = false, last_activity_at = now(),
    next_followup_at = case when stage in ('won','lost','new') then next_followup_at else greatest(coalesce(next_followup_at, now()), now()) end
  where id = p_lead;
  insert into public.activities(lead_id, user_id, type, note, meta)
  values (p_lead, auth.uid(), 'reassignment', format('Reassigned from %s to %s%s', coalesce(v_from, 'nobody'), coalesce(v_to, 'nobody'),
          case when coalesce(trim(p_note), '') <> '' then ' · ' || trim(p_note) else '' end),
          jsonb_build_object('from', l.owner_id, 'to', p_owner));
  perform public.notify(p_owner, 'reassigned', format('Lead assigned to you: %s', l.name), null, p_lead);
  perform public.notify(l.owner_id, 'reassigned', format('%s was reassigned to %s', l.name, coalesce(v_to, 'another agent')), null, p_lead);
end $$;

-- Recycle pool: send a batch of leads back through round robin.
create or replace function public.recycle_round_robin(p_leads uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v uuid; v_owner uuid; v_count int := 0; v_current uuid;
begin
  if not public.is_founder() then raise exception 'Only the founder can reassign leads'; end if;
  foreach v in array p_leads loop
    select owner_id into v_current from public.leads where id = v;
    v_owner := public.next_round_robin_agent(v_current);
    if v_owner is not null then
      perform public.reassign_lead(v, v_owner, 'Recycle pool · round robin');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

create or replace function public.delete_lead(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_founder() then raise exception 'Only the founder can delete leads'; end if;
  delete from public.leads where id = p_lead;
end $$;

-- ───────────────────────────── Deals and commission ─────────────────────────────
create or replace function public.mark_won(p_lead uuid, p_deal jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare l public.leads; v_deal uuid; v_pct numeric; v_dev uuid := nullif(p_deal->>'developer_id', '')::uuid;
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = p_lead for update;
  if l.stage = 'won' then raise exception 'This lead is already Won'; end if;
  if coalesce(trim(p_deal->>'project'), '') = '' then raise exception 'Project is required'; end if;
  if (p_deal->>'sale_value') is null then raise exception 'Sale value is required'; end if;
  v_pct := coalesce(nullif(p_deal->>'commission_pct', '')::numeric, (select default_commission_pct from public.developers where id = v_dev));
  if v_pct is null then raise exception 'Commission %% is required'; end if;

  insert into public.deals(lead_id, developer_id, project, unit, sale_value, commission_pct, agent_id, split_agent_id, split_pct,
                           booked_via, booking_date, expected_commission_date, documents)
  values (p_lead, v_dev, trim(p_deal->>'project'), nullif(trim(p_deal->>'unit'), ''), (p_deal->>'sale_value')::numeric, v_pct,
          case when public.is_founder() then coalesce(nullif(p_deal->>'agent_id', '')::uuid, l.owner_id) else l.owner_id end,
          nullif(p_deal->>'split_agent_id', '')::uuid, coalesce(nullif(p_deal->>'split_pct', '')::numeric, 0),
          coalesce(nullif(trim(p_deal->>'booked_via'), ''), 'Direct'),
          coalesce(nullif(p_deal->>'booking_date', '')::date, current_date),
          nullif(p_deal->>'expected_commission_date', '')::date,
          coalesce(p_deal->'documents', '[]'::jsonb))
  returning id into v_deal;

  update public.leads set stage = 'won', next_followup_at = null, last_activity_at = now(), is_stale = false, in_recycle_pool = false,
    selected_project = trim(p_deal->>'project'), selected_unit = coalesce(nullif(trim(p_deal->>'unit'), ''), selected_unit)
  where id = p_lead;
  insert into public.activities(lead_id, user_id, type, from_stage, to_stage, note, meta)
  values (p_lead, auth.uid(), 'stage_change', l.stage, 'won', format('Deal booked: %s %s', trim(p_deal->>'project'), coalesce(p_deal->>'unit', '')),
          jsonb_build_object('deal_id', v_deal));
  perform public.notify_founders('deal_won', format('Deal won: %s', l.name),
    format('%s · AED %s', trim(p_deal->>'project'), to_char((p_deal->>'sale_value')::numeric, 'FM999,999,999,999')), p_lead, v_deal);
  return v_deal;
end $$;

create or replace function public.update_deal(p_deal uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  select * into d from public.deals where id = p_deal;
  if not found or not (public.is_founder() or d.agent_id = auth.uid()) then raise exception 'Not allowed'; end if;
  if d.commission_status = 'received' and not public.is_founder() then raise exception 'Commission already received; ask the founder'; end if;
  update public.deals set
    developer_id = coalesce(nullif(p_data->>'developer_id', '')::uuid, developer_id),
    project = coalesce(nullif(trim(p_data->>'project'), ''), project),
    unit = coalesce(nullif(trim(p_data->>'unit'), ''), unit),
    sale_value = coalesce(nullif(p_data->>'sale_value', '')::numeric, sale_value),
    commission_pct = coalesce(nullif(p_data->>'commission_pct', '')::numeric, commission_pct),
    split_agent_id = case when p_data ? 'split_agent_id' then nullif(p_data->>'split_agent_id', '')::uuid else split_agent_id end,
    split_pct = coalesce(nullif(p_data->>'split_pct', '')::numeric, split_pct),
    booked_via = coalesce(nullif(trim(p_data->>'booked_via'), ''), booked_via),
    booking_date = coalesce(nullif(p_data->>'booking_date', '')::date, booking_date),
    expected_commission_date = coalesce(nullif(p_data->>'expected_commission_date', '')::date, expected_commission_date),
    documents = coalesce(p_data->'documents', documents)
  where id = p_deal;
end $$;

create or replace function public.mark_commission_received(p_deal uuid, p_date date, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  if not public.is_founder() then raise exception 'Only the founder can mark commission Received'; end if;
  select * into d from public.deals where id = p_deal for update;
  if d.cancelled then raise exception 'Deal is cancelled'; end if;
  update public.deals set commission_status = 'received', received_date = coalesce(p_date, current_date),
    received_amount = coalesce(p_amount, d.commission_amount) where id = p_deal;
  insert into public.activities(lead_id, user_id, type, note, meta)
  values (d.lead_id, auth.uid(), 'deal', format('Commission received: AED %s', to_char(coalesce(p_amount, d.commission_amount), 'FM999,999,999,990.00')),
          jsonb_build_object('deal_id', p_deal));
  perform public.notify(d.agent_id, 'commission_received', 'Commission received', format('%s %s', d.project, coalesce(d.unit, '')), d.lead_id, p_deal);
end $$;

create or replace function public.cancel_deal(p_deal uuid, p_return_stage public.lead_stage, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d public.deals;
begin
  if not public.is_founder() then raise exception 'Only the founder can cancel a deal'; end if;
  if p_return_stage not in ('negotiation', 'lost') then raise exception 'Lead returns to Negotiation or Lost'; end if;
  select * into d from public.deals where id = p_deal for update;
  if d.cancelled then return; end if;
  update public.deals set cancelled = true, cancelled_at = now() where id = p_deal;
  update public.leads set stage = p_return_stage,
    lost_reason = case when p_return_stage = 'lost' then 'Bought elsewhere' else null end,
    lost_at = case when p_return_stage = 'lost' then now() else null end,
    next_followup_at = case when p_return_stage = 'lost' then null else now() + interval '1 day' end,
    last_activity_at = now()
  where id = d.lead_id;
  insert into public.activities(lead_id, user_id, type, from_stage, to_stage, note, meta)
  values (d.lead_id, auth.uid(), 'stage_change', 'won', p_return_stage,
          'Booking cancelled' || case when coalesce(trim(p_note), '') <> '' then ': ' || trim(p_note) else '' end,
          jsonb_build_object('deal_id', p_deal));
  perform public.notify(d.agent_id, 'deal_cancelled', 'Booking cancelled', d.project, d.lead_id, p_deal);
end $$;

-- ───────────────────────────── Time rules (every 15 minutes) ─────────────────────────────
create or replace function public.run_time_rules() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.settings; r record; v_new uuid;
  c_sla int := 0; c_reassign int := 0; c_unreach int := 0; c_stale int := 0; c_recycle int := 0; c_future int := 0; c_comm int := 0;
begin
  select * into s from public.settings where id = 1;

  -- 1. First call SLA
  for r in select id, owner_id, name from public.leads
           where stage = 'new' and first_called_at is null and not sla_breached
             and assigned_at < now() - make_interval(mins => s.sla_minutes) loop
    update public.leads set sla_breached = true where id = r.id;
    perform public.notify(r.owner_id, 'sla', format('First call SLA missed: %s', r.name), 'Call this lead now.', r.id);
    c_sla := c_sla + 1;
  end loop;

  -- 2. Untouched company leads → next agent. Instagram leads are flagged to the founder instead.
  for r in select id, owner_id, name, source from public.leads
           where stage = 'new' and first_called_at is null and not needs_founder_attention
             and assigned_at < now() - make_interval(hours => s.reassign_hours) loop
    if r.source = 'instagram' then
      update public.leads set needs_founder_attention = true where id = r.id;
      perform public.notify_founders('untouched_self', format('Instagram lead untouched %sh: %s', s.reassign_hours, r.name), null, r.id);
    else
      v_new := public.next_round_robin_agent(r.owner_id);
      if v_new is null then
        update public.leads set needs_founder_attention = true where id = r.id;
        perform public.notify_founders('untouched', format('Untouched lead, no other agent available: %s', r.name), null, r.id);
      else
        update public.leads set owner_id = v_new, assigned_at = now(), sla_breached = false where id = r.id;
        insert into public.activities(lead_id, type, note, meta)
        values (r.id, 'reassignment', format('Auto reassigned: untouched for %s hours', s.reassign_hours), jsonb_build_object('from', r.owner_id, 'to', v_new));
        perform public.notify(r.owner_id, 'reassigned', format('%s was reassigned (not called in %sh)', r.name, s.reassign_hours), null, r.id);
        perform public.notify(v_new, 'new_lead', format('New lead: %s', r.name), 'Reassigned to you by round robin.', r.id);
        perform public.notify_founders('reassigned', format('Auto reassigned untouched lead: %s', r.name), null, r.id);
        c_reassign := c_reassign + 1;
      end if;
    end if;
  end loop;

  -- 3. Unanswered attempts → Lost (Unreachable)
  for r in select l.id, l.owner_id, l.name, l.stage from public.leads l
           where l.stage not in ('won','lost')
             and (select count(*) from public.activities a where a.lead_id = l.id and a.type = 'call'
                    and a.call_outcome in ('not_answered','busy','switched_off')
                    and a.created_at > now() - make_interval(days => s.attempt_window_days)) >= s.max_attempts
             and not exists (select 1 from public.activities a where a.lead_id = l.id and a.type = 'call'
                    and a.call_outcome = 'connected' and a.created_at > now() - make_interval(days => s.attempt_window_days)) loop
    update public.leads set stage = 'lost', lost_reason = 'Unreachable', lost_at = now(), next_followup_at = null where id = r.id;
    insert into public.activities(lead_id, type, from_stage, to_stage, note)
    values (r.id, 'stage_change', r.stage, 'lost', format('Automation: %s unanswered attempts in %s days', s.max_attempts, s.attempt_window_days));
    perform public.notify(r.owner_id, 'unreachable', format('%s moved to Lost (Unreachable)', r.name), null, r.id);
    c_unreach := c_unreach + 1;
  end loop;

  -- 4. Stale
  for r in select id, owner_id, name from public.leads
           where stage not in ('won','lost') and not is_stale and last_activity_at < now() - make_interval(days => s.stale_days) loop
    update public.leads set is_stale = true where id = r.id;
    perform public.notify(r.owner_id, 'stale', format('Stale lead: %s', r.name), format('No activity for %s days.', s.stale_days), r.id);
    c_stale := c_stale + 1;
  end loop;
  if c_stale > 0 then
    perform public.notify_founders('stale', format('%s lead(s) became stale', c_stale), 'See Leads → Stale.');
  end if;

  -- 5. Recycle pool
  update public.leads set in_recycle_pool = true
   where stage not in ('won','lost') and not in_recycle_pool and last_activity_at < now() - make_interval(days => s.recycle_days);
  get diagnostics c_recycle = row_count;
  if c_recycle > 0 then
    perform public.notify_founders('recycle', format('%s lead(s) moved to the recycle pool', c_recycle), 'Reassign them from Recycle.');
  end if;

  -- 6. Future buyer reopens as Contacted, follow up due today
  for r in select id, owner_id, name from public.leads
           where stage = 'lost' and lost_reason = 'Future buyer' and lost_at < now() - make_interval(days => s.future_buyer_days) loop
    update public.leads set stage = 'contacted', lost_reason = null, lost_at = null, next_followup_at = now(),
      last_activity_at = now(), is_stale = false, in_recycle_pool = false where id = r.id;
    insert into public.activities(lead_id, type, from_stage, to_stage, note, next_followup_at)
    values (r.id, 'stage_change', 'lost', 'contacted', format('Automation: Future buyer period (%s days) ended', s.future_buyer_days), now());
    perform public.notify(r.owner_id, 'future_buyer', format('Future buyer reopened: %s', r.name), 'Follow up is due today.', r.id);
    c_future := c_future + 1;
  end loop;

  -- 7. Commission overdue (alert once per deal per day)
  for r in select d.id, d.project, d.lead_id from public.deals d
           where not d.cancelled and d.commission_status = 'pending' and d.expected_commission_date < current_date
             and not exists (select 1 from public.notifications n where n.deal_id = d.id and n.kind = 'commission_overdue'
                             and n.created_at > now() - interval '1 day') loop
    perform public.notify_founders('commission_overdue', format('Commission overdue: %s', r.project), null, r.lead_id, r.id);
    c_comm := c_comm + 1;
  end loop;

  return jsonb_build_object('sla', c_sla, 'reassigned', c_reassign, 'unreachable', c_unreach, 'stale', c_stale,
                            'recycled', c_recycle, 'future_buyer', c_future, 'commission_overdue', c_comm);
end $$;

-- Morning summary for each agent (9 AM Dubai) and evening team summary for the founder (7 PM Dubai)
create or replace function public.morning_summary() returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_end timestamptz := (date_trunc('day', now() at time zone 'Asia/Dubai') + interval '1 day') at time zone 'Asia/Dubai';
begin
  for r in select p.id,
      (select count(*) from public.leads l where l.owner_id = p.id and l.stage not in ('won','lost') and l.next_followup_at < now()) overdue,
      (select count(*) from public.leads l where l.owner_id = p.id and l.stage not in ('won','lost') and l.next_followup_at >= now() and l.next_followup_at < v_end) due,
      (select count(*) from public.leads l where l.owner_id = p.id and l.stage = 'new' and l.first_called_at is null) untouched
    from public.profiles p where p.active and p.role = 'agent' and not p.on_leave loop
    perform public.notify(r.id, 'summary', 'Good morning — your day',
      format('%s overdue · %s due today · %s untouched', r.overdue, r.due, r.untouched));
  end loop;
end $$;

create or replace function public.evening_summary() returns void
language plpgsql security definer set search_path = public as $$
declare v_body text; v_start timestamptz := date_trunc('day', now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai';
begin
  select string_agg(format('%s: %s calls, %s contacted, %s overdue', p.name,
      (select count(*) from public.activities a where a.user_id = p.id and a.type = 'call' and a.created_at >= v_start),
      (select count(distinct a.lead_id) from public.activities a where a.user_id = p.id and a.type = 'call' and a.created_at >= v_start),
      (select count(*) from public.leads l where l.owner_id = p.id and l.stage not in ('won','lost') and l.next_followup_at < now())),
    E'\n' order by p.name)
  into v_body from public.profiles p where p.active and p.role = 'agent';
  perform public.notify_founders('summary', 'Team summary for today', coalesce(v_body, 'No agents yet.'));
end $$;

-- ───────────────────────────── Dashboard ─────────────────────────────
create or replace function public.agent_metrics(p_from timestamptz, p_to timestamptz) returns table (
  agent_id uuid, agent_name text, on_leave boolean, leads_assigned bigint, contacted bigint, calls bigint, calls_connected bigint,
  followups_due bigint, followups_done bigint, overdue bigint, untouched bigint,
  st_new bigint, st_contacted bigint, st_shortlisting bigint, st_meeting bigint, st_negotiation bigint, st_won bigint, st_lost bigint,
  meetings_scheduled bigint, meetings_done bigint, units_sold bigint, sale_value numeric, commission_earned numeric,
  commission_received numeric, avg_first_response_minutes numeric
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.on_leave,
    (select count(*) from leads l where l.owner_id = p.id and l.assigned_at >= p_from and l.assigned_at < p_to),
    (select count(distinct a.lead_id) from activities a where a.user_id = p.id and a.type = 'call' and a.created_at >= p_from and a.created_at < p_to),
    (select count(*) from activities a where a.user_id = p.id and a.type = 'call' and a.created_at >= p_from and a.created_at < p_to),
    (select count(*) from activities a where a.user_id = p.id and a.type = 'call' and a.call_outcome = 'connected' and a.created_at >= p_from and a.created_at < p_to),
    (select count(*) from activities a where a.user_id = p.id and a.next_followup_at >= p_from and a.next_followup_at < p_to),
    (select count(*) from activities a where a.user_id = p.id and a.type = 'call' and a.on_time and a.followup_due_at >= p_from and a.followup_due_at < p_to),
    (select count(*) from leads l where l.owner_id = p.id and l.stage not in ('won','lost') and l.next_followup_at < now()),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'new' and l.first_called_at is null),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'new'),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'contacted'),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'shortlisting'),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'meeting'),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'negotiation'),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'won'),
    (select count(*) from leads l where l.owner_id = p.id and l.stage = 'lost'),
    (select count(*) from meetings m where m.user_id = p.id and m.scheduled_at >= p_from and m.scheduled_at < p_to),
    (select count(*) from meetings m where m.user_id = p.id and m.status = 'done' and m.scheduled_at >= p_from and m.scheduled_at < p_to),
    (select count(*) from deals d where (d.agent_id = p.id) and not d.cancelled and d.booking_date >= (p_from at time zone 'Asia/Dubai')::date and d.booking_date < (p_to at time zone 'Asia/Dubai')::date + 1),
    (select round(coalesce(sum(d.sale_value * case when d.agent_id = p.id then 1 - d.split_pct / 100 else d.split_pct / 100 end), 0), 2) from deals d
       where (d.agent_id = p.id or d.split_agent_id = p.id) and not d.cancelled and d.booking_date >= (p_from at time zone 'Asia/Dubai')::date and d.booking_date < (p_to at time zone 'Asia/Dubai')::date + 1),
    (select round(coalesce(sum(d.commission_amount * case when d.agent_id = p.id then 1 - d.split_pct / 100 else d.split_pct / 100 end), 0), 2) from deals d
       where (d.agent_id = p.id or d.split_agent_id = p.id) and not d.cancelled and d.booking_date >= (p_from at time zone 'Asia/Dubai')::date and d.booking_date < (p_to at time zone 'Asia/Dubai')::date + 1),
    (select round(coalesce(sum(coalesce(d.received_amount, d.commission_amount) * case when d.agent_id = p.id then 1 - d.split_pct / 100 else d.split_pct / 100 end), 0), 2) from deals d
       where (d.agent_id = p.id or d.split_agent_id = p.id) and not d.cancelled and d.commission_status = 'received'
         and d.received_date >= (p_from at time zone 'Asia/Dubai')::date and d.received_date < (p_to at time zone 'Asia/Dubai')::date + 1),
    (select round(avg(extract(epoch from (l.first_called_at - l.assigned_at)) / 60)::numeric, 0) from leads l
       where l.owner_id = p.id and l.first_called_at is not null and l.assigned_at >= p_from and l.assigned_at < p_to)
  from profiles p
  where p.active and (p.role = 'agent' or p.id = auth.uid())
    and (public.is_founder() or p.id = auth.uid())
  order by p.round_robin_order, p.name
$$;

create or replace function public.source_performance(p_from timestamptz, p_to timestamptz) returns table (
  source public.lead_source, label text, leads bigint, won bigint, commission numeric, cost numeric
)
language sql stable security definer set search_path = public as $$
  with base as (
    select l.source,
      case l.source when 'bought' then coalesce(b.name, 'Unbatched') when 'meta' then coalesce(l.campaign, 'Unknown campaign') else 'Instagram (Self)' end as label,
      l.id, l.stage, b.id as batch_id, b.cost as batch_cost, mc.cost as campaign_cost
    from leads l
    left join lead_batches b on b.id = l.batch_id
    left join meta_campaigns mc on mc.name = l.campaign and l.source = 'meta'
    where l.created_at >= p_from and l.created_at < p_to
  )
  select source, label, count(*), count(*) filter (where stage = 'won'),
    coalesce((select sum(d.commission_amount) from deals d where not d.cancelled and d.lead_id in (select id from base b2 where b2.label = base.label and b2.source = base.source)), 0),
    max(coalesce(batch_cost, campaign_cost))
  from base
  where public.is_founder()
  group by source, label
  order by count(*) desc
$$;

create or replace function public.commission_by_month(p_months int default 12) returns table (month date, earned numeric, received numeric, pending numeric)
language sql stable security definer set search_path = public as $$
  with months as (
    select generate_series(date_trunc('month', current_date) - make_interval(months => p_months - 1), date_trunc('month', current_date), interval '1 month')::date as m
  )
  select m,
    coalesce((select sum(commission_amount) from deals d where not d.cancelled and date_trunc('month', d.booking_date) = m
              and (public.is_founder() or d.agent_id = auth.uid())), 0),
    coalesce((select sum(coalesce(received_amount, commission_amount)) from deals d where not d.cancelled and d.commission_status = 'received'
              and date_trunc('month', d.received_date) = m and (public.is_founder() or d.agent_id = auth.uid())), 0),
    coalesce((select sum(commission_amount) from deals d where not d.cancelled and d.commission_status = 'pending'
              and date_trunc('month', d.booking_date) = m and (public.is_founder() or d.agent_id = auth.uid())), 0)
  from months order by m
$$;

create or replace function public.top_rejection_reasons() returns table (reason text, count bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(reject_reason, 'Unspecified'), count(*) from shortlisted_units su
  where feedback = 'rejected' and public.is_founder()
  group by 1 order by 2 desc limit 8
$$;

-- ───────────────────────────── Row level security ─────────────────────────────
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.developers enable row level security;
alter table public.lead_batches enable row level security;
alter table public.meta_campaigns enable row level security;
alter table public.leads enable row level security;
alter table public.requirements enable row level security;
alter table public.shortlisted_units enable row level security;
alter table public.activities enable row level security;
alter table public.meetings enable row level security;
alter table public.deals enable row level security;
alter table public.notifications enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (public.is_active_user() or id = auth.uid());
create policy profiles_founder_write on public.profiles for update to authenticated using (public.is_founder()) with check (public.is_founder());

create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_write on public.settings for update to authenticated using (public.is_founder()) with check (public.is_founder());

create policy developers_read on public.developers for select to authenticated using (public.is_active_user());
create policy developers_write on public.developers for all to authenticated using (public.is_founder()) with check (public.is_founder());

create policy batches_founder on public.lead_batches for all to authenticated using (public.is_founder()) with check (public.is_founder());
create policy campaigns_founder on public.meta_campaigns for all to authenticated using (public.is_founder()) with check (public.is_founder());

create policy leads_read on public.leads for select to authenticated using (public.is_founder() or owner_id = auth.uid());
create policy leads_update on public.leads for update to authenticated using (public.is_founder() or owner_id = auth.uid())
  with check (public.is_founder() or owner_id = auth.uid());
-- Only contact fields are directly editable; stage, owner and follow up go through the functions above.
revoke update on public.leads from authenticated, anon;
grant update (name, email, alt_phone, nationality, is_nri, selected_project, selected_unit) on public.leads to authenticated;
revoke insert, delete on public.leads from authenticated, anon;

create policy req_all on public.requirements for all to authenticated using (public.can_access_lead(lead_id)) with check (public.can_access_lead(lead_id));
create policy units_all on public.shortlisted_units for all to authenticated using (public.can_access_lead(lead_id)) with check (public.can_access_lead(lead_id));

create policy activities_read on public.activities for select to authenticated using (public.can_access_lead(lead_id));
revoke insert, update, delete on public.activities from authenticated, anon;

create policy meetings_read on public.meetings for select to authenticated using (public.can_access_lead(lead_id));
revoke insert, update, delete on public.meetings from authenticated, anon;

create policy deals_read on public.deals for select to authenticated
  using (public.is_founder() or agent_id = auth.uid() or split_agent_id = auth.uid());
revoke insert, update, delete on public.deals from authenticated, anon;

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete on public.notifications from authenticated, anon;

-- Internal helpers are not callable from the browser.
revoke execute on function public._ingest_lead, public._change_stage, public.next_round_robin_agent,
  public.notify, public.notify_founders, public.run_time_rules, public.morning_summary, public.evening_summary
  from public, anon, authenticated;
revoke execute on function public.ingest_meta_lead from public, anon, authenticated;
grant execute on function public.ingest_meta_lead to service_role;
grant execute on function public.run_time_rules, public.morning_summary, public.evening_summary to service_role;

-- Realtime for notifications bell
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
