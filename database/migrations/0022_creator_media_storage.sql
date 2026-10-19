-- Creator Hub Creator Network — 0022 creator media storage.
-- Creates one PUBLIC media bucket for public feed images/videos and restricts
-- uploads to authenticated users' own UID-prefixed folder. This bucket must be
-- used for PUBLIC posts only; do not upload private/follower-only media here.
-- Review the bucket/policies before applying to a production Supabase project.
begin;

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Supabase Storage tables are unavailable; configure Storage through the Supabase Dashboard before applying 0022.';
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('creator-content','creator-content',true,104857600,ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[])
on conflict (id) do nothing;

-- Idempotent replacement of only this project's specifically named policies.
drop policy if exists chcn_creator_content_upload_own on storage.objects;
create policy chcn_creator_content_upload_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'creator-content' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chcn_creator_content_update_own on storage.objects;
create policy chcn_creator_content_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'creator-content' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'creator-content' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chcn_creator_content_delete_own on storage.objects;
create policy chcn_creator_content_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'creator-content' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
commit;
