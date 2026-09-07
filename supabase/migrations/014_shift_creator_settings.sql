-- Shift Creator configurable settings
-- Adds workspace-level settings for shift duration, OT alerts, and auto-logging

alter table public.workspaces
  add column if not exists default_shift_duration integer not null default 9 check (default_shift_duration between 1 and 16),
  add column if not exists ot_alert_threshold integer not null default 30 check (ot_alert_threshold between 0 and 180),
  add column if not exists auto_log_ot boolean not null default false;

comment on column public.workspaces.default_shift_duration is 'Default duration in hours when only shift_start is set (e.g., 9 for 08:00—17:00)';
comment on column public.workspaces.ot_alert_threshold is 'Minutes past shift_end before alerting staff about overtime (e.g., 30 for alert at 17:30)';
comment on column public.workspaces.auto_log_ot is 'Automatically log overtime if staff work more than 60 minutes past shift_end';
