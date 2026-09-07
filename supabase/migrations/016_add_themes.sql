-- Add new themes: contrast and amber
-- Updates the workspace_settings theme constraint to support 4 themes

alter table public.workspace_settings
  drop constraint if exists workspace_settings_theme_check;

alter table public.workspace_settings
  add constraint workspace_settings_theme_check 
  check (theme in ('light', 'dark', 'contrast', 'amber'));
