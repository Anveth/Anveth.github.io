-- Additive setup for private screenshots. Safe to run again; no library data is changed.
begin;
create table if not exists public.gamelogs_screenshots (
    user_id uuid not null references auth.users(id) on delete cascade,
    id uuid not null,
    caption text not null default '' check (length(caption) <= 100),
    created_at timestamptz not null default now(),
    primary key (user_id, id)
);
create index if not exists gamelogs_screenshots_owner_date
    on public.gamelogs_screenshots(user_id, created_at desc, id);
alter table public.gamelogs_screenshots enable row level security;
drop policy if exists own_screenshots on public.gamelogs_screenshots;
create policy own_screenshots on public.gamelogs_screenshots for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.gamelogs_screenshots from public, anon, authenticated;
grant select, insert, delete on public.gamelogs_screenshots to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('game-screenshots', 'game-screenshots', false, 1048576, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists gamelogs_read_screenshots on storage.objects;
create policy gamelogs_read_screenshots on storage.objects for select to authenticated
    using (bucket_id = 'game-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists gamelogs_upload_screenshots on storage.objects;
create policy gamelogs_upload_screenshots on storage.objects for insert to authenticated
    with check (bucket_id = 'game-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists gamelogs_delete_screenshots on storage.objects;
create policy gamelogs_delete_screenshots on storage.objects for delete to authenticated
    using (bucket_id = 'game-screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
