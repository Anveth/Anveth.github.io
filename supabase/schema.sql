-- GameLogs: run once in the Supabase SQL Editor. No administrator keys in the app.
begin;

-- Dashboard's optional automatic-RLS event trigger is administrative, not a public RPC.
do $$ begin
    if to_regprocedure('public.rls_auto_enable()') is not null then
        revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    end if;
end $$;

create table if not exists public.gamelogs_libraries (
    user_id uuid primary key references auth.users(id) on delete cascade,
    revision integer not null default 0 check (revision >= 0)
);

create table if not exists public.gamelogs_games (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null check (length(id) between 1 and 100),
    title text not null check (length(btrim(title)) between 1 and 80),
    platform text not null default '' check (length(platform) <= 30),
    release_year integer check (release_year between 1958 and 2100),
    status text not null check (status in ('backlog', 'playing', 'completed')),
    rating integer check (rating between 1 and 10),
    image text not null default '' check (length(image) <= 4096),
    cover_path text not null default '' check (cover_path = '' or cover_path like user_id::text || '/%'),
    position integer not null default 0,
    primary key (user_id, id)
);

create table if not exists public.gamelogs_entries (
    user_id uuid not null references auth.users(id) on delete cascade,
    game_id text not null,
    id text not null check (length(id) between 1 and 100),
    body text not null check (length(btrim(body)) between 1 and 5000),
    session_date date not null,
    minutes integer check (minutes between 1 and 1440),
    created_at timestamptz not null default now(),
    primary key (user_id, game_id, id),
    foreign key (user_id, game_id) references public.gamelogs_games(user_id, id) on delete cascade
);

alter table public.gamelogs_libraries enable row level security;
alter table public.gamelogs_games enable row level security;
alter table public.gamelogs_entries enable row level security;

drop policy if exists own_library on public.gamelogs_libraries;
create policy own_library on public.gamelogs_libraries for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_games on public.gamelogs_games;
create policy own_games on public.gamelogs_games for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_entries on public.gamelogs_entries;
create policy own_entries on public.gamelogs_entries for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.gamelogs_libraries, public.gamelogs_games, public.gamelogs_entries from anon;
grant select, insert, update, delete on public.gamelogs_libraries, public.gamelogs_games, public.gamelogs_entries to authenticated;

create or replace function public.gamelogs_load_library(p_owner uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare result jsonb;
begin
    if auth.uid() is null or p_owner is distinct from auth.uid() then
        raise exception 'ACCOUNT_CHANGED' using errcode = '42501';
    end if;
    -- One MVCC snapshot for version, games and entries.
    select jsonb_build_object(
        'revision', coalesce((select revision from gamelogs_libraries where user_id = p_owner), 0),
        'games', coalesce((select jsonb_agg(jsonb_build_object(
            'id', g.id, 'title', g.title, 'platform', g.platform, 'year', g.release_year,
            'status', g.status, 'rating', g.rating, 'image', g.image, 'coverPath', g.cover_path,
            'notes', coalesce((select jsonb_agg(jsonb_build_object(
                'id', e.id, 'text', e.body, 'date', e.session_date, 'minutes', e.minutes,
                'createdAt', e.created_at
            ) order by e.session_date desc, e.created_at desc)
                from gamelogs_entries e where e.user_id = p_owner and e.game_id = g.id), '[]'::jsonb)
        ) order by g.position) from gamelogs_games g where g.user_id = p_owner), '[]'::jsonb)
    ) into result;
    return result;
end;
$$;

create or replace function public.gamelogs_save_library(p_owner uuid, p_games jsonb, p_revision integer)
returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_revision integer;
begin
    if auth.uid() is null or p_owner is distinct from auth.uid() then
        raise exception 'ACCOUNT_CHANGED' using errcode = '42501';
    end if;
    if jsonb_typeof(p_games) is distinct from 'array' then raise exception 'INVALID_LIBRARY'; end if;
    if jsonb_array_length(p_games) > 2000 or octet_length(p_games::text) > 10000000 then raise exception 'LIBRARY_TOO_LARGE'; end if;
    if exists (select 1 from jsonb_array_elements(p_games) g
        where jsonb_typeof(g->'notes') is distinct from 'array') then raise exception 'INVALID_NOTES'; end if;

    insert into gamelogs_libraries(user_id) values (p_owner) on conflict do nothing;
    select revision into current_revision from gamelogs_libraries where user_id = p_owner for update;
    if p_revision is distinct from current_revision then raise exception 'LIBRARY_CONFLICT' using errcode = '40001'; end if;

    -- Everything below is a single transaction. Failed validation rolls back all changes.
    delete from gamelogs_entries where user_id = p_owner;
    delete from gamelogs_games where user_id = p_owner;
    insert into gamelogs_games(user_id, id, title, platform, release_year, status, rating, image, cover_path, position)
    select p_owner, g->>'id', g->>'title', coalesce(g->>'platform', ''), nullif(g->>'year', '')::integer,
        g->>'status', nullif(g->>'rating', '')::integer, coalesce(g->>'image', ''),
        coalesce(g->>'coverPath', ''), (ordinality - 1)::integer
    from jsonb_array_elements(p_games) with ordinality as games(g, ordinality);

    insert into gamelogs_entries(user_id, game_id, id, body, session_date, minutes, created_at)
    select p_owner, g->>'id', n->>'id', n->>'text', (n->>'date')::date,
        nullif(n->>'minutes', '')::integer, coalesce((n->>'createdAt')::timestamptz, now())
    from jsonb_array_elements(p_games) g cross join lateral jsonb_array_elements(g->'notes') n;

    update gamelogs_libraries set revision = revision + 1 where user_id = p_owner returning revision into current_revision;
    return current_revision;
end;
$$;

revoke all on function public.gamelogs_load_library(uuid) from public, anon;
revoke all on function public.gamelogs_save_library(uuid, jsonb, integer) from public, anon;
grant execute on function public.gamelogs_load_library(uuid) to authenticated;
grant execute on function public.gamelogs_save_library(uuid, jsonb, integer) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('game-covers', 'game-covers', false, 10485760, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gamelogs_read_covers on storage.objects;
create policy gamelogs_read_covers on storage.objects for select to authenticated
    using (bucket_id = 'game-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists gamelogs_insert_covers on storage.objects;
create policy gamelogs_insert_covers on storage.objects for insert to authenticated
    with check (bucket_id = 'game-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists gamelogs_delete_covers on storage.objects;
create policy gamelogs_delete_covers on storage.objects for delete to authenticated
    using (bucket_id = 'game-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
