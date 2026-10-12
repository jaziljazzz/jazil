-- Starred leads (per user), for the "Starred" view.
create table public.lead_stars (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lead_id)
);
alter table public.lead_stars enable row level security;
create policy stars_own on public.lead_stars for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_lead(lead_id));
