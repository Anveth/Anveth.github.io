import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateConfig, createCloudStore, friendlyError } from '../../src/services/cloud';
import { validateNewPassword } from '../../src/services/auth';
import { normalizeGame } from '../../src/services/storage';

const publicConfig = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' };
const jwt = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`;
const clientMock = (value: unknown) => value as SupabaseClient;

test('only public Supabase credentials are accepted', () => {
    assert.equal(validateConfig({ url: '', publishableKey: '' }), false);
    assert.equal(validateConfig(publicConfig), true);
    assert.equal(validateConfig({ ...publicConfig, publishableKey: jwt('anon') }), true);
    for (const publishableKey of ['sb_secret_test', jwt('service_role'), 'invalid']) {
        assert.throws(() => validateConfig({ ...publicConfig, publishableKey }));
    }
    assert.throws(() => validateConfig({ ...publicConfig, url: 'http://example.com' }));
    assert.throws(() => validateConfig({ ...publicConfig, url: 'https://user:pass@example.com' }));
});

test('password rules preserve the existing nine-character minimum without requiring symbols', () => {
    assert.notEqual(validateNewPassword('12345678'), '');
    assert.equal(validateNewPassword('123456789'), '');
    assert.notEqual(validateNewPassword('a'.repeat(129)), '');
});

test('owner and revision stay fixed across loads, successful saves and conflicts', async () => {
    const calls: Array<{ name: string; payload: Record<string, unknown> }> = [];
    const game = { id: 'game', title: 'Game', status: 'playing', notes: [], coverPath: 'owner/cover.webp' };
    const replies = [
        { data: { revision: 3, games: [game] }, error: null },
        { data: 4, error: null },
        { data: null, error: { message: 'LIBRARY_CONFLICT' } },
        { data: 5, error: null }
    ];
    const store = createCloudStore(
        clientMock({
            rpc: async (name: string, payload: Record<string, unknown>) => {
                calls.push({ name, payload });
                return replies.shift();
            }
        }),
        'owner'
    );
    const games = await store.load();
    assert.equal(games[0].imageKey, 'cover');
    await store.save(games);
    assert.equal(calls[1].payload.p_owner, 'owner');
    assert.equal(calls[1].payload.p_revision, 3);
    const payload = calls[1].payload.p_games as Array<Record<string, unknown>>;
    assert.equal(payload[0].coverPath, 'owner/cover.webp');
    assert.equal(Object.hasOwn(payload[0], 'imageKey'), false);
    await assert.rejects(store.save(games), /another device/);
    await store.save(games);
    assert.equal(calls[3].payload.p_revision, 4);
});

test('foreign cover paths and traversal cannot be read or written', async () => {
    const store = createCloudStore(
        clientMock({
            rpc: async () => ({
                data: {
                    revision: 0,
                    games: [{ id: 'game', title: 'Game', status: 'playing', coverPath: 'other/cover.webp' }]
                },
                error: null
            })
        }),
        'owner'
    );
    await assert.rejects(store.load(), /path/);
    const game = normalizeGame({ id: 'game', title: 'Game', status: 'playing', imageKey: '../other' });
    await assert.rejects(store.save([game]), /identifier/);
    await assert.rejects(store.cover('delete', '../other'), /identifier/);
});

test('private uploads never upsert an existing file and deletion is scoped to its owner', async () => {
    const paths: string[] = [];
    const store = createCloudStore(
        clientMock({
            storage: {
                from: (bucket: string) => {
                    assert.equal(bucket, 'game-covers');
                    return {
                        upload: async (path: string, _blob: Blob, options: { upsert: boolean }) => {
                            assert.equal(options.upsert, false);
                            paths.push(path);
                            return { data: {}, error: null };
                        },
                        remove: async (items: string[]) => {
                            paths.push(...items);
                            return { data: [], error: null };
                        }
                    };
                }
            }
        }),
        'owner'
    );
    await store.cover('put', 'unique', new Blob(['x'], { type: 'image/webp' }));
    await store.cover('delete', 'unique');
    assert.deepEqual(paths, ['owner/unique.webp', 'owner/unique.webp']);
});

test('connection and session failures never imply a successful save', () => {
    assert.match(friendlyError({ message: 'Failed to fetch' }), /not saved/);
    assert.match(friendlyError({ code: 'PGRST301' }), /session has expired/);
});
