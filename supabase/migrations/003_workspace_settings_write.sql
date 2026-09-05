-- Allow active workspace admins to update shared workspace configuration.
drop policy if exists workspaces_admin_update on public.workspaces;
create policy workspaces_admin_update on public.workspaces for update
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));
