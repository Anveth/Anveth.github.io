import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { IMAGE_ASSETS } from '../image-assets.js';
import { DEFAULT_GAMES } from '../games.js';
import { safeImage, normalizeGame, loadLibrary, validateCoverFile, prepareCover } from '../storage.js';

test('all shipped cover and gallery sources have decodable WebP assets and accurate dimensions', async () => {
    assert.equal(Object.keys(IMAGE_ASSETS).length, DEFAULT_GAMES.length + 18);
    let before = 0;
    let after = 0;
    for (const [source, asset] of Object.entries(IMAGE_ASSETS)) {
        before += (await stat(new URL(`../${source}`, import.meta.url))).size;
        after += (await stat(new URL(`../${asset.src}`, import.meta.url))).size;
        let previousWidth = 0;
        for (const size of asset.sizes) {
            const data = await readFile(new URL(`../${size.src}`, import.meta.url));
            const actual = await sharp(data).metadata();
            assert.equal(actual.format, 'webp');
            assert.equal(actual.width, size.width);
            assert.equal(actual.height, size.height);
            assert.equal(data.length, size.bytes);
            assert.ok(size.width > previousWidth);
            previousWidth = size.width;
        }
    }
    assert.ok(after < before * .3, 'Largest assets must be at least 70% smaller in total.');
});

test('retired Walking Dead demo disappears, but customizations and diary entries are preserved', () => {
    globalThis.window = { location: { href: 'https://example.test/index.html' } };
    const retired = { id: 'walking-dead', title: 'The Walking Dead', platform: 'PC', year: 2012, status: 'completed', rating: 8, image: 'images/twd.jpg' };
    let raw = null;
    globalThis.localStorage = { getItem: () => raw };
    try {
        assert.ok(!loadLibrary().some(game => game.id === 'walking-dead'));
        raw = JSON.stringify([retired]);
        assert.equal(loadLibrary().length, 0);
        raw = JSON.stringify([{ ...retired, notes: [{ id: 'entry', text: 'Mój wpis', date: '2026-10-16' }] }]);
        assert.equal(loadLibrary()[0].notes[0].text, 'Mój wpis');
        raw = JSON.stringify([{ ...retired, rating: 10 }]);
        assert.equal(loadLibrary()[0].rating, 10);
    } finally { delete globalThis.window; delete globalThis.localStorage; }
});

test('gallery uses responsive thumbnails and larger full-size files without new-tab targets', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const links = [...html.matchAll(/<a class="gallery-item"[^>]*><img[^>]*>/g)];
    assert.equal(links.length, 18);
    for (const [tag] of links) {
        assert.match(tag, /href="images\/optimized\/gallery\/.*\.webp"/);
        assert.match(tag, /srcset="[^"]+\d+w/);
        assert.match(tag, /width="\d+" height="\d+"/);
        assert.match(tag, /loading="lazy"/);
        assert.doesNotMatch(tag, /target="_blank"/);
    }
});

test('old built-in cover paths resolve to optimized images without replacing custom URLs', () => {
    globalThis.window = { location: { href: 'https://example.test/index.html' } };
    try {
        assert.equal(safeImage('images/GoWR.png'), IMAGE_ASSETS['images/GoWR.png'].src);
        assert.equal(safeImage('https://other.example/GoWR.png'), 'https://other.example/GoWR.png');
        assert.equal(safeImage('javascript:alert(1)'), '');
        assert.equal(normalizeGame({ id: 'cyberpunk', title: 'Cyberpunk', status: 'backlog', image: 'images/cyberpunk.jpg' }).image, IMAGE_ASSETS['images/cyberpunk-cover.jpg'].src);
    } finally { delete globalThis.window; }
});

test('invalid, oversized and empty uploads fail before decoding', async () => {
    assert.throws(() => validateCoverFile({ type: 'image/svg+xml', size: 20 }), /JPG/);
    assert.throws(() => validateCoverFile({ type: 'image/png', size: 0 }), /pusty/);
    await assert.rejects(prepareCover({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }), /przekracza 10 MB/);
    assert.doesNotThrow(() => validateCoverFile({ type: 'image/png', size: 10 * 1024 * 1024 }));
});

test('cover compression scales images, retries quality, and releases temporary URLs', async () => {
    const originalImage = globalThis.Image;
    const originalDocument = globalThis.document;
    const createUrl = URL.createObjectURL;
    const revokeUrl = URL.revokeObjectURL;
    let revoked = false;
    const qualities = [];
    const canvas = { getContext: () => ({ drawImage() {} }), toBlob(callback, type, quality) {
        qualities.push(quality);
        callback(new Blob([new Uint8Array(quality > .8 ? 400 * 1024 : 200 * 1024)], { type }));
    } };
    globalThis.Image = class { naturalWidth = 2400; naturalHeight = 3600; async decode() {} };
    globalThis.document = { createElement: () => canvas };
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => { revoked = true; };
    try {
        const result = await prepareCover({ type: 'image/png', size: 1000 });
        assert.equal(result.type, 'image/webp');
        assert.equal(result.size, 200 * 1024);
        assert.equal(canvas.width, 800);
        assert.equal(canvas.height, 1200);
        assert.deepEqual(qualities, [.84, .76]);
        assert.equal(revoked, true);
    } finally {
        globalThis.Image = originalImage;
        globalThis.document = originalDocument;
        URL.createObjectURL = createUrl;
        URL.revokeObjectURL = revokeUrl;
    }
});
