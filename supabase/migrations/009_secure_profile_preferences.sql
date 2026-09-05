-- Restrict self-service profile changes to the notification preference only.
drop policy if exists profiles_self_preferences on public.profiles;

create or replace function public.set_notification_preference(enabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set notification_approval = enabled, updated_at = now()
  where id = auth.uid();
$$;

revoke all on function public.set_notification_preference(boolean) from public;
grant execute on function public.set_notification_preference(boolean) to authenticated;