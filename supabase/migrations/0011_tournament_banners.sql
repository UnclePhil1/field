-- Public storage bucket for tournament banner uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tournament-banners', 'tournament-banners', true, 3145728,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Signed-in users can upload; the bucket is public so anyone can view.
drop policy if exists tb_insert on storage.objects;
create policy tb_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tournament-banners');

drop policy if exists tb_read on storage.objects;
create policy tb_read on storage.objects
  for select
  using (bucket_id = 'tournament-banners');
