-- Alter point_events to add manual point validation columns if not exists
alter table public.point_events 
  add column if not exists reason text,
  add column if not exists source text not null default 'auto' check (source in ('auto', 'manual')),
  add column if not exists admin_id uuid references public.profiles(id),
  add column if not exists category text not null default 'bonus' check (category in ('attendance', 'piket', 'initiative', 'quality', 'bonus', 'discipline', 'reward'));
