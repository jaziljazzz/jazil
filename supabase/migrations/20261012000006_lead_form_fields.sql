-- Extra fields for the full New Lead Form.
alter table public.leads add column if not exists preferred_language text;
alter table public.requirements add column if not exists property_type text;
grant update (preferred_language) on public.leads to authenticated;
