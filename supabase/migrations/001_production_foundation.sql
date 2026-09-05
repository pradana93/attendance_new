-- ShiftGate production foundation
-- Run this migration in Supabase SQL Editor before using the production setup wizard.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  site_name text not null,
  logo_url text,
  hue smallint not null default 38 check (hue between 0 and 360),
  latitude double precision not null,
  longitude double precision not null,
  geofence_radius integer not null default 100 check (geofence_radius between 10 and 5000),
  late_time time not null default '08:15',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'staff' check (role in ('superadmin', 'admin', 'staff')),
  employee_id text not null,
  department text not null default '',
  avatar_url text,
  active boolean not null default true,
  points integer not null default 0,
  notification_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, employee_id),
  unique (workspace_id, email)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  late boolean not null default false,
  early boolean not null default false,
  in_score smallint,
  out_score smallint,
  distance_m integer,
  method text check (method in ('face', 'qr', 'manual')),
  self_report boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, attendance_date)
);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'id')),
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  points_expiry_months integer not null default 12,
  overtime_rate numeric(12,2) not null default 25000,
  updated_at timestamptz not null default now()
);

create index if not exists attendance_workspace_date_idx on public.attendance (workspace_id, attendance_date);
create index if not exists profiles_workspace_idx on public.profiles (workspace_id);

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.profiles where id = auth.uid() and active = true limit 1
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and workspace_id = target_workspace
      and active = true
      and role in ('superadmin', 'admin')
  )
$$;

create or replace function public.bootstrap_workspace(
  workspace_name text,
  workspace_company text,
  workspace_site_name text,
  administrator_name text,
  administrator_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'An authenticated user is required';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'This user already has a workspace profile';
  end if;

  insert into public.workspaces (name, company, site_name, latitude, longitude, created_by)
  values (workspace_name, workspace_company, workspace_site_name, 0, 0, auth.uid())
  returning id into new_workspace_id;

  insert into public.profiles (id, workspace_id, full_name, email, role, employee_id, department)
  values (auth.uid(), new_workspace_id, administrator_name, administrator_email, 'superadmin', 'ADMIN-001', 'Operations');

  insert into public.workspace_settings (workspace_id)
  values (new_workspace_id);

  return new_workspace_id;
end;
$$;

grant execute on function public.bootstrap_workspace(text, text, text, text, text) to authenticated;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.workspace_settings enable row level security;

drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_member_read on public.workspaces for select
  using (id = public.current_workspace_id());

drop policy if exists workspaces_creator_insert on public.workspaces;
create policy workspaces_creator_insert on public.workspaces for insert
  with check (created_by = auth.uid());

drop policy if exists profiles_workspace_read on public.profiles;
create policy profiles_workspace_read on public.profiles for select
  using (workspace_id = public.current_workspace_id());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert
  with check (
    id = auth.uid()
    and exists (
      select 1 from public.workspaces
      where public.workspaces.id = public.profiles.workspace_id
        and public.workspaces.created_by = auth.uid()
    )
  );

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists attendance_workspace_read on public.attendance;
create policy attendance_workspace_read on public.attendance for select
  using (workspace_id = public.current_workspace_id());

drop policy if exists attendance_self_insert on public.attendance;
create policy attendance_self_insert on public.attendance for insert
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

drop policy if exists attendance_self_update on public.attendance;
create policy attendance_self_update on public.attendance for update
  using (workspace_id = public.current_workspace_id() and user_id = auth.uid())
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

drop policy if exists attendance_admin_write on public.attendance;
create policy attendance_admin_write on public.attendance for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists settings_workspace_read on public.workspace_settings;
create policy settings_workspace_read on public.workspace_settings for select
  using (workspace_id = public.current_workspace_id());

drop policy if exists settings_admin_write on public.workspace_settings;
create policy settings_admin_write on public.workspace_settings for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
