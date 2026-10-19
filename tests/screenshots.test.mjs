import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCloudGalleryStore, validateScreenshot } from '../screenshots.js';
import { loadLibrary, saveLibrary } from '../storage.js';

const owner = '10000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const id = '30000000-0000-4000-8000-000000000003';
const record = { id, caption: 'A favourite moment' };
const blob = new Blob(['shot'], { type: 'image/webp' });
function mock({ rows = [], insertError = null, storageError = null } = {}) {
    const calls = [];
    const query = {
        eq(...args) { calls.push(['eq', ...args]); return this; },
        select(...args) { calls.push(['select', ...args]); return this; },
        order() { return this; },
        async range() { return { data: rows }; },
        insert(data) { calls.push(['insert', data]); return this; },
        delete() { calls.push(['delete']); return this; },
        then(resolve) { resolve({ data: [] }); },
        async single() { return insertError ? { error: { message: insertError } } : { data: { id } }; }
    };
    const client = {
        from(table) { calls.push(['table', table]); return query; },
        storage: { from(bucket) { calls.push(['bucket', bucket]); return {
            async upload(...args) { calls.push(['upload', ...args]); return { data: {} }; },
            async remove(paths) { calls.push(['remove', paths]); return storageError ? { error: { message: storageError } } : { data: [] }; },
            async createSignedUrls(paths, expires) { calls.push(['sign', paths, expires]); return { data: paths.map(path => ({ signedUrl: `https://storage.example/${path}?token=temporary` })) }; }
        }; } }
    };
    return { calls, client };
}

test('new local library starts empty without changing previously saved games', () => {
    let raw = null;
    globalThis.localStorage = { getItem: () => raw, setItem: (key, value) => { raw = value; } };
    try {
        assert.deepEqual(loadLibrary(), []);
        saveLibrary([{ id: 'own', title: 'My game', status: 'playing', notes: [] }]);
        assert.equal(loadLibrary()[0].title, 'My game');
    } finally { delete globalThis.localStorage; }
});

test('gallery validates IDs, image types and compressed size before upload', async () => {
    assert.throws(() => validateScreenshot({ ...record, id: '../foreign' }, blob));
    assert.throws(() => validateScreenshot({ ...record, caption: 'x'.repeat(101) }, blob));
    assert.throws(() => validateScreenshot(record, new Blob(['x'], { type: 'image/svg+xml' })));
    assert.throws(() => validateScreenshot(record, new Blob([new Uint8Array(1048577)], { type: 'image/webp' })));
    const { client, calls } = mock();
    await assert.rejects(createCloudGalleryStore(client, owner).remove('../foreign'));
    assert.equal(calls.length, 0);
});

test('cloud upload fixes ownership, uses private paths and does not overwrite', async () => {
    const { client, calls } = mock();
    await createCloudGalleryStore(client, owner).add({ ...record, user_id: other }, blob);
    const upload = calls.find(call => call[0] === 'upload');
    assert.equal(upload[1], `${owner}/${id}.webp`);
    assert.equal(upload[3].upsert, false);
    assert.deepEqual(calls.find(call => call[0] === 'insert')[1], { user_id: owner, ...record });
    assert.ok(calls.some(call => call[0] === 'bucket' && call[1] === 'game-screenshots'));
});

test('failed screenshot metadata save cleans up its own upload and reports failure', async () => {
    const { client, calls } = mock({ insertError: 'Failed to fetch' });
    await assert.rejects(createCloudGalleryStore(client, owner).add(record, blob), /not saved/);
    assert.deepEqual(calls.find(call => call[0] === 'remove')[1], [`${owner}/${id}.webp`]);
});

test('cloud gallery lists only its owner and signs private URLs for one hour', async () => {
    const { client, calls } = mock({ rows: [{ ...record, user_id: owner }] });
    const photos = await createCloudGalleryStore(client, owner).list();
    assert.equal(photos.length, 1);
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === owner));
    assert.deepEqual(calls.find(call => call[0] === 'sign').slice(1), [[`${owner}/${id}.webp`], 3600]);
    const foreign = mock({ rows: [{ ...record, user_id: other }] });
    await assert.rejects(createCloudGalleryStore(foreign.client, owner).list(), /owner/);
});

test('deletion fixes owner and reports orphaned-file cleanup separately from metadata deletion', async () => {
    const { client, calls } = mock({ storageError: 'Failed to fetch' });
    assert.match(await createCloudGalleryStore(client, owner).remove(id), /removed from your gallery/);
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === owner));
    assert.deepEqual(calls.find(call => call[0] === 'remove')[1], [`${owner}/${id}.webp`]);
});

test('gallery clears old photos on account changes and rejects stale asynchronous UI results', async () => {
    const source = await readFile(new URL('../personal-gallery.js', import.meta.url), 'utf8');
    assert.match(source, /const epoch = \+\+scope/);
    assert.match(source, /if \(epoch !== scope\) return/);
    assert.match(source, /urls\.clear\(\); photos = \[\]/);
    assert.match(source, /createCloudGalleryStore\(client, userId\) : null/);
    assert.match(source, /maxDimension: 1920, maxBytes: 1048576/);
});
