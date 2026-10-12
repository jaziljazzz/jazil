-- All smart-view counts for the Leads screen in one query (row level security still applies).
create or replace function public.lead_view_counts(
  p_agent uuid default null, p_source public.lead_source default null,
  p_from timestamptz default null, p_to timestamptz default null, p_q text default null, p_eod timestamptz default null
) returns jsonb
language sql stable security invoker set search_path = public as $$
  with l as (
    select stage, next_followup_at, first_called_at, is_stale, sla_breached from public.leads
    where (p_agent is null or owner_id = p_agent)
      and (p_source is null or source = p_source)
      and (p_from is null or created_at >= p_from)
      and (p_to is null or created_at < p_to)
      and (coalesce(p_q, '') = '' or name ilike '%' || p_q || '%' or email ilike '%' || p_q || '%'
           or (length(regexp_replace(p_q, '\D', '', 'g')) >= 3 and phone like '%' || regexp_replace(p_q, '\D', '', 'g') || '%'))
  )
  select jsonb_build_object(
    'open', count(*) filter (where stage not in ('won','lost')),
    'overdue', count(*) filter (where stage not in ('won','lost') and next_followup_at < now()),
    'today', count(*) filter (where stage not in ('won','lost') and next_followup_at >= now() and next_followup_at < coalesce(p_eod, now() + interval '1 day')),
    'untouched', count(*) filter (where stage = 'new' and first_called_at is null),
    'nofollowup', count(*) filter (where stage not in ('won','lost','new') and next_followup_at is null),
    'stale', count(*) filter (where is_stale and stage not in ('won','lost')),
    'sla', count(*) filter (where sla_breached),
    'new', count(*) filter (where stage = 'new'),
    'contacted', count(*) filter (where stage = 'contacted'),
    'shortlisting', count(*) filter (where stage = 'shortlisting'),
    'meeting', count(*) filter (where stage = 'meeting'),
    'negotiation', count(*) filter (where stage = 'negotiation'),
    'won', count(*) filter (where stage = 'won'),
    'lost', count(*) filter (where stage = 'lost'),
    'all', count(*)
  ) from l
$$;
