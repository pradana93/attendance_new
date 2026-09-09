-- 028: smtp_settings for Super Admin Gmail SMTP tab
create table if not exists public.smtp_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  host text not null default 'smtp.gmail.com',
  port integer not null default 587,
  user_name text not null default '',
  pass_encrypted text not null default '',
  sender text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.smtp_settings enable row level security;

drop policy if exists smtp_superadmin_read on public.smtp_settings;
create policy smtp_superadmin_read on public.smtp_settings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and workspace_id = public.smtp_settings.workspace_id and role = 'superadmin'));

drop policy if exists smtp_superadmin_write on public.smtp_settings;
create policy smtp_superadmin_write on public.smtp_settings for all
  using (exists (select 1 from public.profiles where id = auth.uid() and workspace_id = public.smtp_settings.workspace_id and role = 'superadmin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and workspace_id = public.smtp_settings.workspace_id and role = 'superadmin'));
