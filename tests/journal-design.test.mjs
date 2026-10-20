import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const renderer = script.match(/function renderRecentNotes\(\) \{[\s\S]*?\n\}/)[0];
const loadMore = script.match(/function showMoreJournalEntries\(\) \{[\s\S]*?\n\}/)[0];
const setup = library => {
    const target = { innerHTML: '', querySelectorAll: () => Array.from({ length: (target.innerHTML.match(/class="journal-entry"/g) || []).length }, () => ({ focus() {} })) };
    const count = { textContent: '' };
    const more = { hidden: false, textContent: '' };
    const context = createContext({
        library,
        JOURNAL_PAGE_SIZE: 4,
        visibleJournalEntries: 4,
        byId: id => ({ recentNotes: target, journalCount: count, showMoreEntries: more }[id]),
        STATUSES: { playing: 'Playing', completed: 'Completed', backlog: 'Want to play' },
        escapeHtml: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])),
        formatDate: date => date,
        gameCover: (game, className) => `<div class="${className}">Cover</div>`
    });
    runInContext(`${renderer}; ${loadMore}; renderRecentNotes();`, context);
    return { target, count, more, next: () => runInContext('showMoreJournalEntries()', context) };
};
const render = library => setup(library).target.innerHTML;

test('journal entries include covers, retain ordering and escape titles and notes', () => {
    const html = render([{ id: 'demo', title: 'Game <title>', status: 'playing', notes: [
        { id: 'old', text: 'Earlier entry', date: '2026-10-17', createdAt: '2026-10-17', minutes: null },
        { id: 'new', text: '<script>alert(1)</script>', date: '2026-10-19', createdAt: '2026-10-19', minutes: 45 }
    ] }]);
    assert.equal((html.match(/class="journal-entry"/g) || []).length, 2);
    assert.ok(html.indexOf('2026-10-19') < html.indexOf('2026-10-17'));
    assert.match(html, /<time datetime="2026-10-19">/);
    assert.match(html, /45 min/);
    assert.match(html, /Game &lt;title&gt;/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>|class="journal-note"/);
    assert.match(html, /data-open-game="demo"/);
    assert.equal((html.match(/class="journal-cover"/g) || []).length, 2);
    assert.match(html, /class="journal-entry-header"/);
});

test('empty journal hides pagination and reports no entries', () => {
    const { target, count, more } = setup([]);
    assert.match(target.innerHTML, /class="journal-empty"><h3>Every game has a story\./);
    assert.equal(count.textContent, 'No entries yet');
    assert.equal(more.hidden, true);
});

test('all journal entries can be revealed four at a time without modifying saved notes', () => {
    const library = [{ id: 'demo', title: 'Game', status: 'completed', notes: [11, 12, 13, 14, 15, 16, 17, 18, 19].map(day => ({
        id: String(day), text: `Entry ${day}`, date: `2026-10-${day}`, createdAt: `2026-10-${day}`
    })) }];
    const original = JSON.stringify(library);
    const { target, count, more, next } = setup(library);
    assert.equal((target.innerHTML.match(/class="journal-entry"/g) || []).length, 4);
    assert.equal(count.textContent, '4 of 9 entries');
    assert.equal(more.textContent, 'Show more (4)');
    assert.equal(more.hidden, false);
    next();
    assert.equal(count.textContent, '8 of 9 entries');
    assert.equal(more.textContent, 'Show more (1)');
    next();
    assert.equal((target.innerHTML.match(/class="journal-entry"/g) || []).length, 9);
    assert.equal(count.textContent, '9 of 9 entries');
    assert.equal(more.hidden, true);
    assert.match(target.innerHTML, /Entry 11/);
    assert.equal(JSON.stringify(library), original);
});

test('journal heading sits above full-width card grid with a single column on phones', async () => {
    const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(css, /\.journal-section \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(css, /\.recent-notes \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.recent-notes \{ grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(html, /id="showMoreEntries"[^>]*aria-controls="recentNotes"/);
    assert.match(script, /byId\('showMoreEntries'\)\.addEventListener\('click', showMoreJournalEntries\)/);
    const entry = css.match(/\.journal-entry \{([^}]+)\}/)[1];
    assert.match(entry, /border-top: 1px solid var\(--line\)/);
    assert.doesNotMatch(entry, /background:|border-radius:/);
});
