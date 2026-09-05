-- Atomic server-side operations for points-bearing actions.
create or replace function public.complete_piket(
  p_task_id uuid,
  p_work_date date,
  p_proof_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id uuid;
  task_points integer;
begin
  select p.workspace_id into workspace_id from public.profiles p where p.id = auth.uid() and p.active = true;
  if workspace_id is null then raise exception 'Active workspace profile required'; end if;
  select points into task_points from public.piket_tasks where id = p_task_id and public.piket_tasks.workspace_id = workspace_id and active = true;
  if task_points is null then raise exception 'Task not found'; end if;
  insert into public.piket_logs (workspace_id, task_id, user_id, work_date, proof_url, points)
  values (workspace_id, p_task_id, auth.uid(), p_work_date, p_proof_url, task_points)
  on conflict (workspace_id, task_id, user_id, work_date) do nothing;
  if found then
    insert into public.point_events (workspace_id, user_id, event_date, delta, label)
    values (workspace_id, auth.uid(), p_work_date, task_points, 'Piket: ' || p_task_id::text);
    update public.profiles set points = points + task_points, updated_at = now() where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.complete_piket(uuid, date, text) to authenticated;

create or replace function public.redeem_reward(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_id uuid;
  current_points integer;
  item_cost integer;
  item_stock integer;
  item_name text;
begin
  select p.workspace_id, p.points into workspace_id, current_points from public.profiles p where p.id = auth.uid() and p.active = true;
  select cost, stock, name into item_cost, item_stock, item_name from public.reward_items where id = p_item_id and public.reward_items.workspace_id = workspace_id and active = true for update;
  if item_cost is null or item_stock <= 0 then raise exception 'Reward unavailable'; end if;
  if current_points < item_cost then raise exception 'Not enough points'; end if;
  update public.reward_items set stock = stock - 1, updated_at = now() where id = p_item_id;
  update public.profiles set points = points - item_cost, updated_at = now() where id = auth.uid();
  insert into public.reward_redemptions (workspace_id, user_id, item_id, cost) values (workspace_id, auth.uid(), p_item_id, item_cost);
  insert into public.point_events (workspace_id, user_id, delta, label) values (workspace_id, auth.uid(), -item_cost, 'Redeemed: ' || item_name);
end;
$$;

grant execute on function public.redeem_reward(uuid) to authenticated;
