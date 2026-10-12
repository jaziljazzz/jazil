-- Connectors: Meta (Facebook Login) connection details.
alter table public.integrations
  add column if not exists meta_app_id text,
  add column if not exists meta_login_config_id text,
  add column if not exists meta_page_name text,
  add column if not exists meta_user_name text,
  add column if not exists meta_connected_at timestamptz,
  add column if not exists meta_pages_pending jsonb,
  add column if not exists meta_last_sync_at timestamptz;
