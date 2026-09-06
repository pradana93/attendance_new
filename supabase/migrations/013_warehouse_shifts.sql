-- Warehouse Shift Creator feature
-- Adds per-user shift start/end times to baseline user attendance expectations

alter table public.profiles
  add column if not exists shift_start time,
  add column if not exists shift_end time;

comment on column public.profiles.shift_start is 'Daily shift start time (HH:MM). If null, defaults to workspace late_time. Used as baseline for Clock In validation.';
comment on column public.profiles.shift_end is 'Daily shift end time (HH:MM). If null, defaults to shift_start + 9 hours. Used as baseline for Clock Out validation.';

-- Ensure profiles table still has RLS coverage (already enabled, no change needed)
-- All existing policies remain in effect for shift columns (profiles_admin_write handles updates)
