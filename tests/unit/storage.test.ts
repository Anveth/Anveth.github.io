import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    LIBRARY_KEY,
    loadGuestLibrary,
    loadLibrary,
    saveLibrary,
    normalizeGame,
    imageAsset,
    safeImage,
    originalImage,
    validDate,
    removeGame,
    removeEntry,
    parseBackup,
    validateCoverFile
} from '../../src/services/storage';
import { DEMO_SCREENSHOTS } from '../../gallery-demo.js';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
    }
});
Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
        location: { href: 'https://anveth.github.io/pick-a-game/' }
    }
});
const rawGame = {
    id: 'my-game',
    title: 'My game',
    platform: 'PC',
    year: 2020,
    status: 'backlog',
    rating: 8,
    image: 'images/Dishonored.jpg',
    notes: [
        { id: 'note', text: 'A memory', date: '2026-10-21', minutes: 60, createdAt: '2026-10-21T10:00:00Z' }
    ]
};
beforeEach(() => values.clear());

test('guest demo is separate from an empty account/import source and is not persisted', () => {
    assert.equal(loadLibrary().length, 0);
    assert.equal(loadGuestLibrary().length, 15);
    assert.equal(values.size, 0);
    values.set(LIBRARY_KEY, '[]');
    assert.equal(loadGuestLibrary().length, 15);
    assert.equal(loadLibrary().length, 0);
});

test('existing local key, ratings and journal metadata survive normalization', () => {
    assert.equal(LIBRARY_KEY, 'gamelogs:library');
    const game = normalizeGame(rawGame);
    saveLibrary([game]);
    assert.deepEqual(loadLibrary(), [game]);
    for (const status of ['backlog', 'playing', 'completed']) {
        assert.equal(normalizeGame({ ...game, status }).rating, 8);
    }
    assert.deepEqual(game.notes, rawGame.notes);
    assert.equal(game.platform, 'PC'); // Preserved for old backups, not shown as release metadata.
});

test('invalid local saves fail without replacing stored data with demo games', () => {
    values.set(LIBRARY_KEY, '{broken');
    assert.throws(loadGuestLibrary);
    assert.equal(values.get(LIBRARY_KEY), '{broken');
});

test('entry removal cannot delete a game or another entry', () => {
    const game = normalizeGame(rawGame);
    const next = removeEntry([game], game.id, 'note');
    assert.equal(next.length, 1);
    assert.equal(next[0].notes.length, 0);
    assert.equal(game.notes.length, 1);
    assert.throws(() => removeEntry([game], game.id, 'missing'));
    assert.deepEqual(removeGame([game], game.id), []);
});

test('asset aliases resolve to optimized covers; external and unsafe URLs are handled separately', () => {
    const asset = imageAsset('images/Dishonored.jpg');
    assert.ok(asset);
    assert.equal(imageAsset('https://anveth.github.io/images/Dishonored.jpg'), asset);
    assert.equal(safeImage('images/Dishonored.jpg'), asset.src);
    assert.equal(originalImage(asset.src), 'images/Dishonored.jpg');
    assert.equal(originalImage('images/Dishonored.jpg'), 'images/Dishonored.jpg');
    assert.equal(originalImage('https://anveth.github.io/images/Dishonored.jpg'), 'images/Dishonored.jpg');
    assert.equal(originalImage('https://example.com/cover.jpg'), 'https://example.com/cover.jpg');
    assert.equal(originalImage('javascript:alert(1)'), '');
    assert.equal(safeImage('https://example.com/cover.jpg'), 'https://example.com/cover.jpg');
    assert.equal(safeImage('javascript:alert(1)'), '');
    assert.equal(safeImage('data:image/svg+xml,x'), '');
    assert.ok(asset.sizes.some((size) => size.width === 96));
    assert.ok(asset.sizes.every((size) => size.width <= 640));
});

test('gallery previews exclude full-resolution files and contain the original 18 demo images', () => {
    assert.equal(DEMO_SCREENSHOTS.length, 18);
    for (const photo of DEMO_SCREENSHOTS) {
        assert.ok(photo.thumbnail);
        assert.ok(
            photo.srcset
                .split(', ')
                .every((value: string) => Number(value.split(' ').at(-1)?.slice(0, -1)) <= 1280)
        );
        assert.ok(photo.url.endsWith('.webp'));
    }
});

test('version 1 backups preserve notes and reject duplicates or unknown versions', async () => {
    const file = (data: unknown) =>
        new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });
    const restored = await parseBackup(file({ version: 1, games: [rawGame] }));
    assert.deepEqual(restored[0].game.notes, rawGame.notes);
    assert.equal(restored[0].game.imageKey, '');
    await assert.rejects(parseBackup(file({ version: 1, games: [rawGame, rawGame] })), /duplicate/);
    await assert.rejects(parseBackup(file({ version: 2, games: [] })), /backup/);
});

test('dates, statuses and uploaded image limits are validated', () => {
    assert.equal(validDate('2024-02-29'), true);
    assert.equal(validDate('2025-02-29'), false);
    assert.throws(() => normalizeGame({ ...rawGame, status: 'unknown' }));
    assert.throws(() => validateCoverFile({ type: 'image/svg+xml', size: 100 }));
    assert.throws(() => validateCoverFile({ type: 'image/png', size: 11 * 1024 * 1024 }));
    assert.doesNotThrow(() => validateCoverFile({ type: 'image/webp', size: 100 }));
});
