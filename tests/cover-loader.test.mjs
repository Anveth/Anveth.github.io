import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preloadCover } from '../cover-loader.js';

test('cover becomes ready only after loading and decoding', async () => {
    let decoded = false;
    class LoadedImage {
        naturalWidth = 640;
        set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
        async decode() { decoded = true; }
    }
    assert.equal(await preloadCover('/test.webp', { ImageClass: LoadedImage }), true);
    assert.equal(decoded, true);
});

test('missing, broken and stalled covers cannot block picking indefinitely', async () => {
    class BrokenImage { set src(value) { queueMicrotask(() => this.onerror()); } }
    class StalledImage { set src(value) {} }
    class InvalidImage {
        naturalWidth = 0;
        set src(value) { queueMicrotask(() => this.onload()); }
        async decode() { throw new Error('Invalid image'); }
    }
    assert.equal(await preloadCover(''), false);
    assert.equal(await preloadCover('/broken.webp', { ImageClass: BrokenImage }), false);
    assert.equal(await preloadCover('/stalled.webp', { ImageClass: StalledImage, timeoutMs: 5 }), false);
    assert.equal(await preloadCover('/invalid.webp', { ImageClass: InvalidImage }), false);
});

test('preloading starts before the original roll delay and result reveal waits for it', async () => {
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    const picker = script.slice(script.indexOf('function setupDicePage()'), script.indexOf('\nsetupTheme();'));
    assert.ok(picker.indexOf('const coverReady') < picker.indexOf('setTimeout(async'));
    assert.ok(picker.indexOf('const coverLoaded = await coverReady') < picker.indexOf("byId('randomResult').hidden = false"));
    assert.match(picker, /\}, 550\);/);
    assert.match(picker, /gameCover\(game, 'result-cover', true, coverLoaded\)/);
});
