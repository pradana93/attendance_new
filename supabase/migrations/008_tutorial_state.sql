-- Per-user, versioned onboarding state for cross-device tutorial resume.
alter table public.profiles add column if not exists tutorial_completed boolean not null default false;
alter table public.profiles add column if not exists tutorial_version integer not null default 1;
alter table public.profiles add column if not exists tutorial_step integer not null default 0;