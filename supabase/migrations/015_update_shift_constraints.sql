-- Update Shift Creator settings constraints
-- Increases limits for shift duration and OT alert threshold

alter table public.workspaces
  drop constraint if exists workspaces_default_shift_duration_check,
  drop constraint if exists workspaces_ot_alert_threshold_check;

alter table public.workspaces
  add constraint workspaces_default_shift_duration_check check (default_shift_duration between 1 and 24),
  add constraint workspaces_ot_alert_threshold_check check (ot_alert_threshold between 0 and 480);
