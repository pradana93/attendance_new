-- ShiftGate: migrate departments to new 8-role structure
-- Old: Inbound, Outbound, Inventory, Packing, QA, Forklift, Operations
-- New: Manager, Supervisor, Leader, Checker Inbound, Checker Outbound, Checker Packing, Packing, Helper

-- 1) Remap existing profiles (idempotent)
update public.profiles
set department = case
  when department = 'Inbound' then 'Checker Inbound'
  when department = 'Outbound' then 'Checker Outbound'
  when department = 'Inventory' then 'Checker Packing'
  when department = 'QA' then 'Leader'
  when department = 'Forklift' then 'Helper'
  when department = 'Operations' then 'Manager'
  when department = 'Packing' then 'Packing'
  else department
end
where department in ('Inbound','Outbound','Inventory','QA','Forklift','Operations');

-- 2) Update bootstrap default from Operations -> Manager
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
  values (auth.uid(), new_workspace_id, administrator_name, administrator_email, 'superadmin', 'ADMIN-001', 'Manager');

  insert into public.workspace_settings (workspace_id)
  values (new_workspace_id);

  return new_workspace_id;
end;
$$;

-- 3) Enforce allowlist going forward
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_department_check'
  ) then
    alter table public.profiles
      add constraint profiles_department_check
      check (department in ('Manager','Supervisor','Leader','Checker Inbound','Checker Outbound','Checker Packing','Packing','Helper'));
  end if;
end $$;
