-- Average first response ignores leads first called before their latest assignment (e.g. reassigned later).
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
       where l.owner_id = p.id and l.first_called_at is not null and l.first_called_at >= l.assigned_at
         and l.assigned_at >= p_from and l.assigned_at < p_to)
  from profiles p
  where p.active and (p.role = 'agent' or p.id = auth.uid())
    and (public.is_founder() or p.id = auth.uid())
  order by p.round_robin_order, p.name
$$;
