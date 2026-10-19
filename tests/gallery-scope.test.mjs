import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { DEMO_SCREENSHOTS, galleryMarkup } from '../gallery-demo.js';

const source = (await readFile(new URL('../personal-gallery.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace('export function setupPersonalGallery', 'function setupPersonalGallery');
function setup(stores) {
    const elements = new Map();
    const element = () => ({ innerHTML: '', hidden: false, disabled: false, textContent: '', classList: { toggle() {} },
        addEventListener() {}, setAttribute() {}, close() {}, focus() {},
        querySelectorAll: () => [], querySelector: () => element() });
    const el = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
    const controller = runInNewContext(`${source}; setupPersonalGallery();`, {
        document: { getElementById: el, createElement: element, body: { append() {} } },
        window: { addEventListener() {} }, setInterval() {}, Date, URL,
        DEMO_SCREENSHOTS, galleryMarkup,
        setupGallery: () => ({ refresh() {}, close() {} }),
        createCloudGalleryStore: (client, userId) => stores[userId]
    });
    return { controller, el };
}
const photo = { id: 'own-photo', caption: 'My screenshot', url: 'https://storage.example/own.webp' };

test('guest → empty account → filled account → guest renders only the correct scope', async () => {
    const { controller, el } = setup({ empty: { list: async () => [] }, filled: { list: async () => [photo] } });
    await controller.setScope(null, null);
    assert.equal((el('galleryTrack').innerHTML.match(/class="gallery-item"/g) || []).length, 18);
    assert.equal(el('addScreenshot').hidden, true);
    await controller.setScope({}, 'empty');
    assert.equal((el('galleryTrack').innerHTML.match(/class="gallery-upload"/g) || []).length, 2);
    assert.doesNotMatch(el('galleryTrack').innerHTML, /demo-/);
    assert.equal(el('addScreenshot').hidden, false);
    await controller.setScope({}, 'filled');
    assert.match(el('galleryTrack').innerHTML, /data-delete-screenshot="own-photo"/);
    await controller.setScope(null, null);
    assert.doesNotMatch(el('galleryTrack').innerHTML, /own-photo|data-delete-screenshot=/);
    assert.equal((el('galleryTrack').innerHTML.match(/class="gallery-item"/g) || []).length, 18);
});

test('a late private-gallery response cannot replace another account or guest gallery', async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const { controller, el } = setup({ slow: { list: () => pending }, fast: { list: async () => [] } });
    const request = controller.setScope({}, 'slow');
    await controller.setScope({}, 'fast');
    await controller.setScope(null, null);
    finish([photo]);
    await request;
    assert.doesNotMatch(el('galleryTrack').innerHTML, /own-photo/);
    assert.equal((el('galleryTrack').innerHTML.match(/class="gallery-item"/g) || []).length, 18);
    assert.equal(el('addScreenshot').hidden, true);
});
