-- Final profile and attendance policies for remaining production actions.
alter table public.profiles add column if not exists face_enrolled boolean not null default false;

drop policy if exists profiles_self_preferences on public.profiles;
create policy profiles_self_preferences on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Staff may read and update only their own pending leave request status is not
-- permitted; admins retain approval authority through profiles_admin_write.
drop policy if exists leave_admin_write on public.leave_requests;
create policy leave_admin_write on public.leave_requests for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
