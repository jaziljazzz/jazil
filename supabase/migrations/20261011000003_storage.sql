-- Private bucket for deal documents (booking form, SPA, commission invoice). Path: <deal_id>/<file>
insert into storage.buckets (id, name, public) values ('deal-docs', 'deal-docs', false)
on conflict (id) do nothing;

create or replace function public.can_access_deal(p_deal text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deals d
    where d.id::text = p_deal and (public.is_founder() or d.agent_id = auth.uid() or d.split_agent_id = auth.uid())
  )
$$;

create policy "deal docs read" on storage.objects for select to authenticated
  using (bucket_id = 'deal-docs' and public.can_access_deal((storage.foldername(name))[1]));
create policy "deal docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-docs' and public.can_access_deal((storage.foldername(name))[1]));
create policy "deal docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'deal-docs' and public.is_founder());
