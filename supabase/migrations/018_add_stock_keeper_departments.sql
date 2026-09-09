-- Add Stock Keeper departments to warehouse
-- Adds three new departments: Stock Keeper Leader, Stock Keeper, Picker

alter table public.profiles
  drop constraint if exists profiles_department_check;
alter table public.profiles
  add constraint profiles_department_check 
  check (department in ('Manager','Supervisor','Leader','Checker Inbound','Checker Outbound','Checker Packing','Packing','Helper','Stock Keeper Leader','Stock Keeper','Picker'));
-- Update workspace_settings profile creation to support new departments
-- (The create_profile_for_workspace_admin RPC will now accept any of these departments);
