import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEMO_SCREENSHOTS, galleryMarkup } from '../gallery-demo.js';

test('guest sees the original 18 optimized screenshots without upload or delete controls', () => {
    assert.equal(DEMO_SCREENSHOTS.length, 18);
    const html = galleryMarkup(DEMO_SCREENSHOTS);
    assert.equal((html.match(/class="gallery-item"/g) || []).length, 18);
    assert.match(html, /The Witcher 3: Wild Hunt/);
    assert.match(html, /Cyberpunk 2077/);
    assert.match(html, /srcset="[^"]+640w/);
    assert.doesNotMatch(html, /data-delete-screenshot=|class="gallery-upload"/);
    assert.match(html, /data-deletable="false"/);
});

test('empty account gets exactly two clickable upload slots and no demo photos', () => {
    const html = galleryMarkup([], { editable: true });
    assert.equal((html.match(/class="gallery-upload"/g) || []).length, 2);
    assert.match(html, /Add your favourite screenshots/);
    assert.doesNotMatch(html, /class="gallery-item"|demo-/);
});

test('each own screenshot has an individual delete button outside its enlargement link', () => {
    const photos = [{ id: 'photo-1', caption: 'Game <title>', url: 'https://storage.example/1.webp' }, { id: 'photo-2', caption: 'Evening', url: 'https://storage.example/2.webp' }];
    const html = galleryMarkup(photos, { editable: true });
    assert.equal((html.match(/class="screenshot-remove"/g) || []).length, 2);
    assert.match(html, /<\/a><button class="screenshot-remove" data-delete-screenshot="photo-1"/);
    assert.match(html, /aria-label="Delete screenshot: Game &lt;title&gt;"/);
    assert.match(html, /data-delete-screenshot="photo-2"/);
    assert.doesNotMatch(html, /class="gallery-upload"|<title>/);
    const first = galleryMarkup(photos.slice(0, 1), { editable: true });
    assert.equal((first.match(/class="gallery-upload"/g) || []).length, 1);
});

test('guest/account scopes stay separate and renewal no longer depends on a Refresh button', async () => {
    const source = await readFile(new URL('../personal-gallery.js', import.meta.url), 'utf8');
    assert.match(source, /if \(!remote\) \{ photos = \[\.\.\.DEMO_SCREENSHOTS\]; ready = true; render\(\); message\(\); return; \}/);
    assert.match(source, /if \(!remote \|\| !ready \|\| busy \|\| !photos\.some/);
    assert.match(source, /el\('addScreenshot'\)\.hidden = !remote/);
    assert.doesNotMatch(source, /el\('refreshGallery'\)|createLocalGalleryStore/);
    assert.match(source, /refreshCurrent\(\)/);
});

test('carousel uses slide wrapper positions and does not begin dragging on delete buttons', async () => {
    const source = await readFile(new URL('../gallery.js', import.meta.url), 'utf8');
    assert.match(source, /const frame = item => item.closest\('\.gallery-frame'\) \|\| item/);
    assert.match(source, /left\(items\[1\]\) - left\(items\[0\]\)/);
    assert.match(source, /event.target.closest\('\[data-delete-screenshot\]'\)/);
    assert.match(source, /link.dataset.deletable !== 'true'/);
});
