-- Phase 2: push notifications, integrations (Meta Lead Ads, WhatsApp Cloud API), WhatsApp quick templates,
-- server hooks, and verified calls (dialed from the CRM, with time spent in the dialer).
create extension if not exists pg_net;

-- ───────── Push subscriptions (one per device) ─────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── Integrations (founder only; the server reads them with the service role) ─────────
create table public.integrations (
  id int primary key default 1 check (id = 1),
  meta_page_id text,
  meta_page_token text,
  meta_app_secret text,
  meta_verify_token text not null default encode(gen_random_bytes(12), 'hex'),
  wa_enabled boolean not null default false,
  wa_token text,
  wa_phone_number_id text,
  wa_template_morning text default 'aventus_morning_summary',
  wa_template_evening text default 'aventus_team_summary',
  wa_lang text not null default 'en',
  updated_at timestamptz not null default now()
);
insert into public.integrations (id) values (1);
create trigger integrations_touch before update on public.integrations for each row execute function public.touch_updated_at();
alter table public.integrations enable row level security;
create policy integrations_founder on public.integrations for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- ───────── WhatsApp quick message templates (everyone reads, founder edits via settings policy) ─────────
alter table public.settings add column if not exists wa_templates jsonb not null default '[
  {"title": "Introduction", "body": "Hi {name}, this is {agent} from {company}. Thank you for your interest in Dubai property. When is a good time to talk?"},
  {"title": "Brochure", "body": "Hi {name}, as discussed here is the brochure: <paste link>. Happy to answer any questions."},
  {"title": "Office location", "body": "Hi {name}, our office location: <paste Google Maps link>. See you soon!"},
  {"title": "Follow up", "body": "Hi {name}, following up on our conversation. Are you still looking? I have some new options that match your budget."}
]'::jsonb;

-- ───────── Server hooks: the database calls the app (push delivery, WhatsApp summaries) ─────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.app_config (
  id int primary key default 1 check (id = 1),
  app_url text,
  hook_secret text not null default encode(gen_random_bytes(24), 'hex')
);
insert into private.app_config (id) values (1);

create or replace function public.ping_app(p_path text, p_body jsonb) returns void
language plpgsql security definer set search_path = public, private as $$
declare c private.app_config;
begin
  select * into c from private.app_config where id = 1;
  if c.app_url is null or c.app_url = '' then return; end if;
  perform net.http_post(
    url := rtrim(c.app_url, '/') || p_path,
    body := p_body,
    headers := jsonb_build_object('content-type', 'application/json', 'x-hook-secret', c.hook_secret),
    timeout_milliseconds := 5000
  );
end $$;
revoke execute on function public.ping_app from public, anon, authenticated;

create or replace function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ping_app('/api/push', jsonb_build_object('id', new.id));
  return new;
end $$;
create trigger notifications_push after insert on public.notifications for each row execute function public.on_notification_push();

-- WhatsApp summaries go out right after the in-app ones.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('aventus-wa-morning', '1 5 * * *', $c$select public.ping_app('/api/cron/whatsapp', '{"kind":"morning"}'::jsonb)$c$);
    perform cron.schedule('aventus-wa-evening', '1 15 * * *', $c$select public.ping_app('/api/cron/whatsapp', '{"kind":"evening"}'::jsonb)$c$);
  end if;
end $$;

-- ───────── Verified calls ─────────
drop function if exists public.log_call(uuid, public.call_outcome, text, timestamptz, public.lead_stage, jsonb);
create or replace function public.log_call(p_lead uuid, p_outcome public.call_outcome, p_note text default null,
                                          p_next timestamptz default null, p_stage public.lead_stage default null,
                                          p_data jsonb default '{}'::jsonb, p_dial jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  if not public.can_access_lead(p_lead) then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = p_lead for update;
  if p_outcome = 'connected' and coalesce(trim(p_note), '') = '' then
    raise exception 'A short note is required for a connected call';
  end if;

  insert into public.activities(lead_id, user_id, type, call_outcome, note, followup_due_at, on_time, next_followup_at, meta)
  values (p_lead, auth.uid(), 'call', p_outcome, nullif(trim(p_note), ''), l.next_followup_at,
          case when l.next_followup_at is null then null else now() <= l.next_followup_at end,
          case when p_outcome = 'wrong_number' then null else p_next end,
          -- Dialed from the CRM: the app measured time spent in the phone dialer (capped at 2 hours).
          case when p_dial is not null and (p_dial->>'seconds') is not null
               then jsonb_build_object('dialed', true, 'dial_seconds', least(greatest((p_dial->>'seconds')::int, 0), 7200), 'dialed_at', p_dial->>'dialed_at')
               else jsonb_build_object('dialed', false) end);

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

drop function if exists public.agent_metrics(timestamptz, timestamptz);
create or replace function public.agent_metrics(p_from timestamptz, p_to timestamptz) returns table (
  agent_id uuid, agent_name text, on_leave boolean, leads_assigned bigint, contacted bigint, calls bigint, calls_connected bigint,
  followups_due bigint, followups_done bigint, overdue bigint, untouched bigint,
  st_new bigint, st_contacted bigint, st_shortlisting bigint, st_meeting bigint, st_negotiation bigint, st_won bigint, st_lost bigint,
  meetings_scheduled bigint, meetings_done bigint, units_sold bigint, sale_value numeric, commission_earned numeric,
  commission_received numeric, avg_first_response_minutes numeric,
  calls_dialed bigint, call_seconds bigint
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
       where l.owner_id = p.id and l.first_called_at is not null and l.first_called_at >= l.assigned_at
         and l.assigned_at >= p_from and l.assigned_at < p_to),
    (select count(*) from activities a where a.user_id = p.id and a.type = 'call' and (a.meta->>'dialed')::boolean and a.created_at >= p_from and a.created_at < p_to),
    (select coalesce(sum((a.meta->>'dial_seconds')::int), 0) from activities a where a.user_id = p.id and a.type = 'call' and a.meta ? 'dial_seconds' and a.created_at >= p_from and a.created_at < p_to)
  from profiles p
  where p.active and (p.role = 'agent' or p.id = auth.uid())
    and (public.is_founder() or p.id = auth.uid())
  order by p.round_robin_order, p.name
$$;
