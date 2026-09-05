-- ShiftGate feature domains
-- All records are workspace-scoped and protected by membership/role RLS.

create table if not exists public.piket_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  area text not null,
  points integer not null default 0,
  requires_proof boolean not null default false,
  active boolean not null default true,
  icon text not null default 'clip',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.piket_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.piket_tasks(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 6),
  user_id uuid not null references public.profiles(id) on delete cascade,
  unique (workspace_id, task_id, weekday)
);

create table if not exists public.piket_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.piket_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  completed_at timestamptz not null default now(),
  proof_url text,
  points integer not null default 0,
  unique (workspace_id, task_id, user_id, work_date)
);

create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_date date not null,
  start_time time not null,
  end_time time not null,
  reason text not null,
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  leave_date date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz
);

create table if not exists public.point_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_date date not null default current_date,
  delta integer not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  cost integer not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  icon text not null default 'package',
  category text not null default 'Essentials',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.reward_items(id),
  redeemed_date date not null default current_date,
  cost integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  body text not null,
  author_id uuid not null references public.profiles(id),
  published_date date not null default current_date,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('bug', 'idea', 'general', 'praise')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  title text not null,
  description text not null,
  screenshot_url text,
  status text not null default 'new' check (status in ('new', 'review', 'planned', 'progress', 'shipped', 'wont_fix')),
  admin_note text,
  decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handover_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_date date not null,
  shift_id text not null,
  from_user_id uuid not null references public.profiles(id),
  note text not null,
  issue text,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_date date not null,
  task_id uuid not null references public.piket_tasks(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.swap_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_date date not null,
  task_id uuid not null references public.piket_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unique (workspace_id, work_date, task_id)
);

create index if not exists piket_tasks_workspace_idx on public.piket_tasks(workspace_id);
create index if not exists piket_logs_workspace_date_idx on public.piket_logs(workspace_id, work_date);
create index if not exists overtime_workspace_date_idx on public.overtime_requests(workspace_id, request_date);
create index if not exists leaves_workspace_date_idx on public.leave_requests(workspace_id, leave_date);
create index if not exists points_workspace_user_idx on public.point_events(workspace_id, user_id);
create index if not exists notifications_user_idx on public.notifications(workspace_id, user_id, created_at);
create index if not exists feedback_workspace_status_idx on public.feedback(workspace_id, status);

-- Shared workspace read policy for ordinary members.
do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'piket_tasks', 'piket_assignments', 'piket_logs', 'overtime_requests',
    'leave_requests', 'point_events', 'reward_items', 'reward_redemptions',
    'announcements', 'notifications', 'feedback', 'handover_notes',
    'swap_requests', 'swap_overrides'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I_workspace_read on public.%I', table_name, table_name);
    execute format('create policy %I_workspace_read on public.%I for select using (workspace_id = public.current_workspace_id())', table_name, table_name);
  end loop;
end
$policies$;

-- Writes are restricted by domain in the client-facing policies; destructive/admin
-- mutations should use authenticated RPCs or Edge Functions in later migrations.
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update
  using (workspace_id = public.current_workspace_id() and (user_id is null or user_id = auth.uid()))
  with check (workspace_id = public.current_workspace_id() and (user_id is null or user_id = auth.uid()));

drop policy if exists feedback_self_insert on public.feedback;
create policy feedback_self_insert on public.feedback for insert
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

drop policy if exists overtime_self_insert on public.overtime_requests;
create policy overtime_self_insert on public.overtime_requests for insert
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

drop policy if exists leave_self_insert on public.leave_requests;
create policy leave_self_insert on public.leave_requests for insert
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

drop policy if exists piket_log_self_insert on public.piket_logs;
create policy piket_log_self_insert on public.piket_logs for insert
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

-- Admins can manage workspace configuration and approvals.
do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'piket_tasks', 'piket_assignments', 'overtime_requests', 'leave_requests',
    'reward_items', 'announcements', 'feedback', 'handover_notes',
    'swap_requests', 'swap_overrides'
  ] loop
    execute format('drop policy if exists %I_admin_write on public.%I', table_name, table_name);
    execute format('create policy %I_admin_write on public.%I for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))', table_name, table_name);
  end loop;
end
$policies$;

drop policy if exists reward_redemptions_self_insert on public.reward_redemptions;
create policy reward_redemptions_self_insert on public.reward_redemptions for insert
  with check (workspace_id = public.current_workspace_id() and user_id = auth.uid());

drop policy if exists point_events_admin_insert on public.point_events;
create policy point_events_admin_insert on public.point_events for insert
  with check (public.is_workspace_admin(workspace_id));
