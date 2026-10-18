import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine in memory. Only Supabase's auth/storage scaffolding is stubbed.
const db = new PGlite();
const alice = '10000000-0000-4000-8000-000000000001';
const bob = '20000000-0000-4000-8000-000000000002';
const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const fixture = {
    id: 'witcher', title: 'Wiedźmin 3', platform: 'PC', year: 2015,
    status: 'completed', rating: 9, image: '', coverPath: '',
    notes: [{ id: 'session-1', text: 'Pierwsza sesja', date: '2026-10-16', minutes: 45, createdAt: '2026-10-16T10:00:00.000Z' }]
};

before(async () => {
    await db.exec(`
        create role anon; create role authenticated;
        create schema auth; create schema storage;
        create table auth.users(id uuid primary key);
        create function auth.uid() returns uuid language sql stable as
            $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        create table storage.buckets(id text primary key, name text, public boolean,
            file_size_limit bigint, allowed_mime_types text[]);
        create table storage.objects(bucket_id text references storage.buckets(id), name text,
            primary key(bucket_id, name));
        alter table storage.objects enable row level security;
        create function storage.foldername(text) returns text[] language sql immutable as
            $$ select string_to_array($1, '/') $$;
        grant usage on schema auth, storage to authenticated, anon;
        grant select, insert, update, delete on storage.objects to authenticated;
        insert into auth.users(id) values ('${alice}'), ('${bob}');
    `);
    await db.exec(schema);
    await db.exec(schema); // Setup is safely repeatable.
});
after(() => db.close());

async function asUser(id, action) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('set role authenticated');
    try { return await action(); }
    finally { await db.exec('reset role'); }
}
async function load(owner) {
    return (await db.query('select public.gamelogs_load_library($1::uuid) as library', [owner])).rows[0].library;
}
async function save(owner, games, revision) {
    return (await db.query('select public.gamelogs_save_library($1::uuid, $2::jsonb, $3::integer) as revision', [owner, JSON.stringify(games), revision])).rows[0].revision;
}

test('new account is empty; games, rating and diary survive reload', async () => {
    await asUser(alice, async () => {
        assert.deepEqual(await load(alice), { revision: 0, games: [] });
        assert.equal(await save(alice, [fixture], 0), 1);
        const actual = await load(alice);
        assert.equal(actual.revision, 1);
        assert.equal(actual.games[0].title, fixture.title);
        assert.equal(actual.games[0].rating, 9);
        assert.equal(actual.games[0].notes[0].text, 'Pierwsza sesja');
        assert.equal(actual.games[0].notes[0].minutes, 45);
    });
});

test('another account cannot read, insert or reassign foreign records', async () => {
    await asUser(bob, async () => {
        assert.deepEqual(await load(bob), { revision: 0, games: [] });
        await assert.rejects(load(alice), /ACCOUNT_CHANGED/);
        await assert.rejects(save(alice, [], 1), /ACCOUNT_CHANGED/);
        for (const table of ['gamelogs_libraries', 'gamelogs_games', 'gamelogs_entries']) {
            assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
        }
        await assert.rejects(db.query('insert into public.gamelogs_libraries(user_id) values ($1)', [alice]), /row-level security/);
        assert.equal(await save(bob, [{ ...fixture, title: 'Biblioteka B', notes: [] }], 0), 1);
        await assert.rejects(db.query('update public.gamelogs_games set user_id=$1 where user_id=$2', [alice, bob]), /row-level security/);
        assert.equal((await load(bob)).games[0].title, 'Biblioteka B');
    });
    assert.equal((await asUser(alice, () => load(alice))).games[0].title, fixture.title);
});

test('stale revision and invalid payload roll back without deleting games or notes', async () => {
    await asUser(alice, async () => {
        await assert.rejects(save(alice, [], 0), /LIBRARY_CONFLICT/);
        await assert.rejects(save(alice, [{ ...fixture, rating: 99 }], 1), /check constraint/);
        await assert.rejects(save(alice, [{ ...fixture, notes: null }], 1), /INVALID_NOTES/);
        await assert.rejects(save(alice, [{ ...fixture, coverPath: `${bob}/foreign.webp` }], 1), /check constraint/);
        const actual = await load(alice);
        assert.equal(actual.revision, 1);
        assert.equal(actual.games[0].rating, 9);
        assert.equal(actual.games[0].notes[0].text, fixture.notes[0].text);
    });
});

test('anonymous requests have no access to private library functions or tables', async () => {
    await db.exec('set role anon');
    try {
        await assert.rejects(load(alice), /permission denied/);
        await assert.rejects(save(alice, [], 1), /permission denied/);
        await assert.rejects(db.query('select * from public.gamelogs_games'), /permission denied/);
    } finally { await db.exec('reset role'); }
});

test('covers bucket is private and its RLS isolates user folders', async () => {
    assert.equal((await db.query("select public from storage.buckets where id='game-covers'")).rows[0].public, false);
    await asUser(alice, async () => {
        await db.query("insert into storage.objects(bucket_id,name) values ('game-covers',$1)", [`${alice}/cover.webp`]);
        await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('game-covers',$1)", [`${bob}/cover.webp`]), /row-level security/);
        assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    });
    await asUser(bob, async () => {
        assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
        assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 0);
    });
});

test('entry deletion keeps its game; game deletion removes its journal without touching another account', async () => {
    await asUser(alice, async () => {
        let current = await load(alice);
        const secondEntry = { ...fixture.notes[0], id: 'session-2', text: 'Keep this entry' };
        let revision = await save(alice, [{ ...fixture, notes: [...fixture.notes, secondEntry] }], current.revision);
        revision = await save(alice, [{ ...fixture, notes: [secondEntry] }], revision);
        current = await load(alice);
        assert.equal(current.games.length, 1);
        assert.equal(current.games[0].id, fixture.id);
        assert.deepEqual(current.games[0].notes.map(note => note.id), ['session-2']);
        await assert.rejects(save(alice, [], revision - 1), /LIBRARY_CONFLICT/);
        assert.equal((await load(alice)).games.length, 1);
        await save(alice, [], revision);
        assert.deepEqual((await load(alice)).games, []);
        assert.equal((await db.query('select * from public.gamelogs_entries')).rows.length, 0);
    });
    assert.equal((await asUser(bob, () => load(bob))).games.length, 1);
});
