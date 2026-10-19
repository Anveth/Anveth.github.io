import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STATUSES, removeGame, removeEntry, saveLibrary, loadLibrary } from '../storage.js';

const makeLibrary = () => [
    { id: 'first', title: 'First game', status: 'backlog', notes: [{ id: 'one', text: 'Keep my own language: mój wpis', date: '2026-10-18' }, { id: 'two', text: 'Second entry', date: '2026-10-18' }] },
    { id: 'second', title: 'Other game', status: 'playing', notes: [] }
];

test('deleting one entry keeps the game, other entries and original data intact', () => {
    const original = makeLibrary();
    const updated = removeEntry(original, 'first', 'two');
    assert.equal(updated.length, 2);
    assert.equal(updated[0].title, 'First game');
    assert.equal(updated[0].notes.length, 1);
    assert.equal(updated[0].notes[0].id, 'one');
    assert.equal(updated[1], original[1]);
    assert.equal(original[0].notes.length, 2);
    assert.equal(removeEntry(removeEntry(original, 'first', 'one'), 'first', 'two')[0].notes.length, 0);
    assert.throws(() => removeEntry(original, 'first', 'missing'), /no longer available/);
    assert.throws(() => removeEntry(original, 'missing', 'one'), /no longer available/);
});

test('deleting a game removes its journal, persists an empty library, and never alters another game', () => {
    const original = makeLibrary();
    const updated = removeGame(original, 'first');
    assert.deepEqual(updated, [original[1]]);
    assert.equal(original.length, 2);
    assert.throws(() => removeGame(original, 'missing'), /no longer/);
    let saved;
    globalThis.localStorage = { setItem: (key, value) => { saved = value; }, getItem: () => saved };
    try {
        saveLibrary(removeGame(updated, 'second'));
        assert.deepEqual(loadLibrary(), []); // Do not resurrect demo games after deleting the last game.
    } finally { delete globalThis.localStorage; }
});

test('the UI is English-only while stored status identifiers and user content stay compatible', async () => {
    assert.deepEqual(STATUSES, { backlog: 'Want to play', playing: 'Playing', completed: 'Completed' });
    for (const file of ['index.html', 'pick-a-game/index.html', 'account.js', 'gallery.js', 'script.js', 'storage.js', 'cloud.js']) {
        const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        // Game names may include non-ASCII characters, but no Polish interface copy should remain.
        assert.doesNotMatch(text, /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/, file);
        assert.doesNotMatch(text, /(?:>|')Backlog(?:<|')/, file);
        if (file.endsWith('.html')) {
            assert.match(text, /<html lang="en">/);
            assert.match(text, />Want to play</);
            assert.doesNotMatch(text, /hreflang=|languageToggle/);
        }
    }
    assert.equal(removeEntry(makeLibrary(), 'first', 'two')[0].notes[0].text, 'Keep my own language: mój wpis');
});

test('library actions are available above and below the games using the same add-game handler', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const top = html.match(/<div class="hero-actions">([\s\S]*?)<\/div>/)[1];
    const bottom = html.match(/<div class="library-actions"[^>]*>([\s\S]*?)<\/div>/)[1];
    assert.equal(top, bottom);
    assert.match(bottom, /data-open-dialog>Add a game<\/button>/);
    assert.match(bottom, /href="\/pick-a-game\/">Pick from Want to play<\/a>/);
    assert.ok(html.indexOf('id="gameGrid"') < html.indexOf('class="library-actions"'));
    assert.ok(html.indexOf('class="library-actions"') < html.indexOf('id="journal"'));
});
