-- Add minimalist theme
alter table public.workspace_settings
  drop constraint if exists workspace_settings_theme_check;
alter table public.workspace_settings
  add constraint workspace_settings_theme_check 
  check (theme in ('light', 'dark', 'contrast', 'amber', 'minimalist'));
