-- Self-service cleanup for pending requests.
drop policy if exists overtime_self_delete on public.overtime_requests;
create policy overtime_self_delete on public.overtime_requests for delete
  using (workspace_id = public.current_workspace_id() and user_id = auth.uid() and status = 'pending');

drop policy if exists leave_self_read on public.leave_requests;
create policy leave_self_read on public.leave_requests for select
  using (workspace_id = public.current_workspace_id() and user_id = auth.uid());
