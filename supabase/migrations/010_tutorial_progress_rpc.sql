-- Persist onboarding progress without allowing self-service role/profile changes.
create or replace function public.save_tutorial_state(
  completed boolean,
  version integer,
  step integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set tutorial_completed = completed,
      tutorial_version = version,
      tutorial_step = greatest(step, 0),
      updated_at = now()
  where id = auth.uid();
$$;

revoke all on function public.save_tutorial_state(boolean, integer, integer) from public;
grant execute on function public.save_tutorial_state(boolean, integer, integer) to authenticated;
