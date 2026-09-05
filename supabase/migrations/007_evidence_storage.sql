-- Evidence files are public-by-URL but only authenticated users may upload.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do update set public = true;

drop policy if exists evidence_authenticated_upload on storage.objects;
create policy evidence_authenticated_upload on storage.objects for insert to authenticated
with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = public.current_workspace_id()::text and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists evidence_owner_delete on storage.objects;
create policy evidence_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'evidence' and (storage.foldername(name))[2] = auth.uid()::text);
