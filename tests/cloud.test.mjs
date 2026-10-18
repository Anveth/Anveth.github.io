import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, createCloudStore, friendlyError } from '../cloud.js';

const owner = 'user-a';
const publicConfig = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' };
const jwt = role => `header.${btoa(JSON.stringify({ role }))}.signature`;

test('configuration permits public credentials only and no backend when empty', () => {
    assert.equal(validateConfig({ url: '', publishableKey: '' }), false);
    assert.equal(validateConfig(publicConfig), true);
    assert.equal(validateConfig({ ...publicConfig, publishableKey: jwt('anon') }), true);
    for (const key of ['sb_secret_danger', jwt('service_role'), 'invalid']) {
        assert.throws(() => validateConfig({ ...publicConfig, publishableKey: key }));
    }
    assert.throws(() => validateConfig({ ...publicConfig, url: 'http://example.com' }));
    assert.throws(() => validateConfig({ ...publicConfig, url: 'https://user:pass@example.com' }));
});

test('adapter fixes owner, tracks confirmed revisions, and maps private image paths', async () => {
    const calls = [];
    const replies = [
        { data: { revision: 3, games: [{ id: 'game', coverPath: `${owner}/cover.webp`, notes: [] }] } },
        { data: 4 }, { error: { message: 'LIBRARY_CONFLICT' } }, { data: 5 }
    ];
    const store = createCloudStore({ rpc: async (name, payload) => { calls.push({ name, payload }); return replies.shift(); } }, owner, value => value);
    const games = await store.load();
    assert.equal(games[0].imageKey, 'cover');
    await store.save(games);
    assert.equal(calls[1].payload.p_owner, owner);
    assert.equal(calls[1].payload.p_revision, 3);
    assert.equal(calls[1].payload.p_games[0].coverPath, `${owner}/cover.webp`);
    assert.equal(Object.hasOwn(calls[1].payload.p_games[0], 'imageKey'), false);
    await assert.rejects(store.save(games), /another device/);
    await store.save(games);
    assert.equal(calls[3].payload.p_revision, 4); // Failure must not advance revision.
});

test('foreign cover paths and path traversal are rejected', async () => {
    const store = createCloudStore({ rpc: async () => ({ data: { revision: 0, games: [{ coverPath: 'user-b/cover.webp' }] } }) }, owner, value => value);
    await assert.rejects(store.load(), /path/);
    await assert.rejects(store.save([{ imageKey: '../other' }]), /identifier/);
});

test('cloud covers are uploaded without upsert in the owner folder', async () => {
    const calls = [];
    const blob = new Blob(['cover'], { type: 'image/webp' });
    const store = createCloudStore({ storage: { from: bucket => ({
        upload: async (path, data, options) => { calls.push({ bucket, path, data, options }); return { data: {} }; },
        download: async path => { calls.push({ bucket, path }); return { data: blob }; }
    }) } }, owner, value => value);
    await store.cover('put', 'unique-cover', blob);
    assert.equal(await store.cover('get', 'unique-cover'), blob);
    assert.equal(calls[0].bucket, 'game-covers');
    assert.equal(calls[0].path, `${owner}/unique-cover.webp`);
    assert.equal(calls[0].options.upsert, false);
});

test('network/session errors do not imply a successful save', () => {
    assert.match(friendlyError({ message: 'Failed to fetch' }), /not saved/);
    assert.match(friendlyError({ code: 'PGRST301' }), /session has expired/);
    assert.match(friendlyError({ code: 'PGRST202' }), /schema.sql/);
});

test('deleting a cover is limited to its owner folder and reports storage failures', async () => {
    const calls = [];
    const store = createCloudStore({ storage: { from: bucket => ({ remove: async paths => {
        calls.push({ bucket, paths });
        return paths[0].includes('failing') ? { error: { message: 'Failed to fetch' } } : { data: [] };
    } }) } }, owner, value => value);
    await store.cover('delete', 'old-cover');
    assert.deepEqual(calls[0], { bucket: 'game-covers', paths: [`${owner}/old-cover.webp`] });
    await assert.rejects(store.cover('delete', '../other'), /identifier/);
    await assert.rejects(store.cover('delete', 'failing'), /not saved/);
    assert.equal(calls.length, 2);
});
