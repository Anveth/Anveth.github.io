import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { loadLibrary, loadGuestLibrary, normalizeGame, STATUSES } from '../storage.js';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const renderer = script.match(/function renderLibrary\(\) \{[\s\S]*?\n\}/)[0];
const identity = script.match(/async function changeIdentity\(user, client, connectionError\) \{[\s\S]*?\n\}/)[0];
const game = (id, status = 'backlog') => normalizeGame({ id, title: `Game ${id}`, status, notes: [] });
function render(library, isAccountLibrary = false, currentFilter = 'all') {
    const grid = { innerHTML: '' }, count = { textContent: '' }, bottom = { hidden: false };
    runInNewContext(`${renderer}; renderLibrary();`, {
        library, isAccountLibrary, currentFilter, STATUSES,
        byId: id => ({ gameGrid: grid, gameCount: count, libraryBottomActions: bottom }[id]),
        escapeHtml: value => String(value), gameCover: () => '<div>Cover</div>'
    });
    return { html: grid.innerHTML, count: count.textContent, bottomHidden: bottom.hidden };
}

test('guest gets 15 default games for absent or empty local storage without saving or overwriting data', () => {
    let raw = null, writes = 0;
    globalThis.localStorage = { getItem: () => raw, setItem: () => { writes++; } };
    try {
        assert.deepEqual(loadLibrary(), []);
        const demo = loadGuestLibrary();
        assert.equal(demo.length, 15);
        assert.equal((render(demo).html.match(/class="game-card"/g) || []).length, 15);
        assert.doesNotMatch(render(demo).html, /Add your first game/);
        raw = '[]';
        assert.equal(loadGuestLibrary().length, 15);
        assert.deepEqual(loadLibrary(), []);
        raw = JSON.stringify([game('own')]);
        assert.equal(loadGuestLibrary().length, 1);
        assert.equal(loadGuestLibrary()[0].id, 'own');
        assert.equal(writes, 0);
    } finally { delete globalThis.localStorage; }
});

test('first-game tile appears only for a genuinely empty account, not guest or an empty filter', () => {
    assert.match(render([], true).html, /Add your first game/);
    assert.doesNotMatch(render([], false).html, /Add your first game/);
    assert.doesNotMatch(render([game('own')], true, 'playing').html, /Add your first game/);
    assert.equal((render([game('own')], true).html.match(/class="game-card"/g) || []).length, 1);
});

test('bottom library actions are shown from 16 visible games and follow the active filter', () => {
    for (const total of [0, 1, 15, 16, 17]) {
        const library = Array.from({ length: total }, (_, index) => game(String(index), index < 15 ? 'playing' : 'backlog'));
        assert.equal(render(library, true).bottomHidden, total < 16, `total=${total}`);
        assert.equal(render(library, true, 'playing').bottomHidden, true);
    }
});

test('every status has the same editable rating, year-only metadata and no redundant Journal link', () => {
    for (const status of Object.keys(STATUSES)) {
        const html = render([{ ...game('own', status), platform: 'PS5', year: 2022, rating: 8 }], true).html;
        assert.match(html, /class="game-meta">2022<\/p>/);
        assert.match(html, /data-rating-id="own"[^>]*value="8"/);
        assert.match(html, /aria-label="Status for Game own"/);
        assert.doesNotMatch(html, /PS5|diary-link|>Status</);
    }
});

test('the actual status and rating change handler preserves one rating through all statuses', async () => {
    const start = script.indexOf("byId('gameGrid').addEventListener('change',");
    const end = script.indexOf("document.querySelectorAll('[data-close-dialog]')", start);
    let handleChange;
    const context = {
        library: [{ ...game('own'), rating: 8 }],
        byId: () => ({ addEventListener: (event, handler) => { handleChange = handler; }, querySelectorAll: () => [] }),
        commitLibrary: async next => { context.library = next; },
        renderLibrary() {}, renderRecentNotes() {}, notify: message => { throw new Error(message); }
    };
    runInNewContext(script.slice(start, end), context);
    const change = (dataset, value) => handleChange({ target: { dataset, value, checkValidity: () => true } });
    await change({ ratingId: 'own' }, '7');
    for (const status of Object.keys(STATUSES)) {
        await change({ statusId: 'own' }, status);
        assert.equal(context.library[0].rating, 7);
        assert.equal(context.library[0].status, status);
    }
    await change({ ratingId: 'own' }, '');
    assert.equal(context.library[0].rating, null);
});

test('guest → empty account → own account → guest never seeds an account with demo games', async () => {
    const demo = Array.from({ length: 15 }, (_, index) => game(`demo-${index}`));
    const context = {
        scopeEpoch: 0, isAccountLibrary: false, identityPending: false, cloudStore: null, library: [], readError: '', normalizeGame,
        personalGallery: { setScope: async () => {} },
        document: { querySelector: () => ({}), querySelectorAll: () => [] },
        byId: () => null, revokePreview() {}, coverUrls: new Map(), renderLibrary() {}, renderRecentNotes() {},
        createCloudStore: (client, id) => ({ load: async () => id === 'empty' ? [] : [game('personal')] }),
        loadGuestLibrary: () => demo, hydrateCovers: async () => {}, notify() {}, location: { search: '' }, URLSearchParams
    };
    const change = runInNewContext(`${identity}; changeIdentity;`, context);
    await change(null, null);
    assert.equal(context.library.length, 15);
    assert.equal(context.isAccountLibrary, false);
    await change({ id: 'empty' }, {});
    assert.equal(context.library.length, 0);
    assert.equal(context.isAccountLibrary, true);
    await change({ id: 'existing' }, {});
    assert.equal(context.library.length, 1);
    assert.equal(context.library[0].id, 'personal');
    await change(null, null);
    assert.equal(context.library.length, 15);
    assert.equal(context.isAccountLibrary, false);
    assert.doesNotMatch(script, /cloudStore \? await cloudStore\.load\(\) : loadLibrary\(\)/);
});
