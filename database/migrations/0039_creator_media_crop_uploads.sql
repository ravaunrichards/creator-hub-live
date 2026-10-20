-- Creator Hub Live profile photo crop uploads. Apply manually after reviewing the target database.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-media', 'creator-media', true, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 12582912, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists chl_creator_media_public_read on storage.objects;
create policy chl_creator_media_public_read on storage.objects for select using (bucket_id = 'creator-media');

drop policy if exists chl_creator_media_owner_insert on storage.objects;
create policy chl_creator_media_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chl_creator_media_owner_update on storage.objects;
create policy chl_creator_media_owner_update on storage.objects for update to authenticated
using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chl_creator_media_owner_delete on storage.objects;
create policy chl_creator_media_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text);
