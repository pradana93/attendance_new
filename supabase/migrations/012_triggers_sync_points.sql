-- Create a trigger trigger_sync_user_points on public.point_events
-- to automatically maintain cumulative point balances in public.profiles.points.

create or replace function public.fn_sync_point_events_to_profile()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.profiles 
    set points = coalesce(points, 0) + new.delta,
        updated_at = now() 
    where id = new.user_id;
  elsif (TG_OP = 'DELETE') then
    update public.profiles 
    set points = greatest(0, coalesce(points, 0) - old.delta),
        updated_at = now() 
    where id = old.user_id;
  elsif (TG_OP = 'UPDATE') then
    update public.profiles 
    set points = greatest(0, coalesce(points, 0) - old.delta + new.delta),
        updated_at = now() 
    where id = new.user_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_point_events_points on public.point_events;
create trigger trg_sync_point_events_points
after insert or update or delete on public.point_events
for each row execute function public.fn_sync_point_events_to_profile();

-- Also run an initial full sync to make sure any current discrepant balances are aligned!
update public.profiles p
set points = greatest(0, coalesce(sub.total_points, 0))
from (
  select user_id, sum(delta) as total_points
  from public.point_events
  group by user_id
) sub
where p.id = sub.user_id;
