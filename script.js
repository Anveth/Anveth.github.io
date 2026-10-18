import { setupGallery } from './gallery.js?v=20261018-2';
import { STATUSES, safeImage, normalizeGame, validDate, loadLibrary, saveLibrary, removeGame, removeEntry, coverStore as localCoverStore, validateCoverFile, prepareCover, blobToDataUrl, dataUrlToBlob } from './storage.js?v=20261018-2';
import { createCloudStore } from './cloud.js?v=20261018-2';
import { mountAccount } from './account.js?v=20261018-2';
import { SUPABASE_CONFIG } from './config.js?v=20261018-2';

let library = [];
let readError = '';
try { library = loadLibrary(); } catch (error) { readError = error.message; }
let currentFilter = 'all';
let selectedId = null;
let editingId = null;
let stagedCover = null;
let previewUrl = '';
let pendingImport = null;
let pendingDeletion = null;
let cloudStore = null;
let scopeEpoch = 0;
let writePending = false;
let identityPending = Boolean(SUPABASE_CONFIG.url || SUPABASE_CONFIG.publishableKey);
const coverUrls = new Map();
const byId = id => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const formatDate = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date + 'T12:00:00'));

function notify(message, error = false) {
    const element = byId('appMessage');
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.toggle('is-error', error);
    element.setAttribute('role', error ? 'alert' : 'status');
}

function showError(id, message = '') {
    const element = byId(id);
    element.textContent = message;
    element.hidden = !message;
}

function assertScope(epoch) {
    if (epoch !== scopeEpoch) throw new Error('Your account changed during this operation. Try again on the correct account.');
}

async function commitLibrary(next, expectedEpoch = scopeEpoch) {
    assertScope(expectedEpoch);
    if (readError) throw new Error(cloudStore ? 'Refresh your library in My account first. Changes were not saved.' : 'Restore a valid backup using Import first. Your current data has not been overwritten.');
    if (writePending || identityPending) throw new Error('Please wait for the current save or account loading to finish.');
    const epoch = scopeEpoch;
    const store = cloudStore;
    writePending = true;
    try {
        if (store) await store.save(next);
        else saveLibrary(next);
        if (scopeEpoch !== epoch) throw new Error('Your account changed while saving. Refresh your library.');
        library = next;
    } finally { writePending = false; }
}

async function coverStore(action, key, blob, epoch = scopeEpoch) {
    assertScope(epoch);
    if (identityPending) return Promise.reject(new Error('Please wait for your account library to load.'));
    const store = cloudStore;
    const result = await (store ? store.cover(action, key, blob) : localCoverStore(action, key, blob));
    assertScope(epoch);
    return result;
}

function setupTheme() {
    const toggle = byId('themeToggle');
    const icon = byId('themeIcon');
    if (!toggle || !icon) return;
    let initial = 'dark';
    try { initial = localStorage.getItem('gamelogs:theme') || localStorage.getItem('colorMode') || initial; } catch { /* Use the default appearance. */ }
    const apply = theme => {
        const light = theme === 'light';
        document.body.classList.toggle('theme-light', light);
        toggle.setAttribute('aria-pressed', String(light));
        toggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
        icon.src = light ? 'svg/moon.png' : 'svg/sun.png';
        try { localStorage.setItem('gamelogs:theme', theme); } catch { /* Theme still works without persistence. */ }
    };
    apply(initial);
    toggle.addEventListener('click', () => apply(document.body.classList.contains('theme-light') ? 'dark' : 'light'));
}

async function hydrateCovers() {
    const epoch = scopeEpoch;
    await Promise.all(library.filter(game => game.imageKey && !coverUrls.has(game.imageKey)).map(async game => {
        try {
            const blob = await coverStore('get', game.imageKey, undefined, epoch);
            if (blob && epoch === scopeEpoch && !coverUrls.has(game.imageKey)) coverUrls.set(game.imageKey, URL.createObjectURL(blob));
        } catch { if (epoch === scopeEpoch) notify('Unable to load the cover. Check your connection or select it again when editing the game.', true); }
    }));
}

function gameCover(game, className = 'game-cover', eager = false) {
    const image = coverUrls.get(game.imageKey) || safeImage(game.image);
    return `<div class="${className} cover-placeholder"><span aria-hidden="true">${escapeHtml(game.title.charAt(0).toUpperCase())}</span>${image ? `<img src="${escapeHtml(image)}" alt="Cover for ${escapeHtml(game.title)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="600" height="900">` : ''}</div>`;
}

// Keep a useful placeholder if a linked image is unavailable.
document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.cover-placeholder')) event.target.hidden = true;
}, true);

function renderLibrary() {
    const grid = byId('gameGrid');
    if (!grid) return;
    const games = currentFilter === 'all' ? library : library.filter(game => game.status === currentFilter);
    const count = games.length;
    const noun = count === 1 ? 'game' : 'games';
    byId('gameCount').textContent = `${count} ${noun}`;
    grid.innerHTML = games.length ? games.map((game, index) => `<article class="game-card">
        <button class="cover-button" type="button" data-open-game="${escapeHtml(game.id)}" aria-label="Open journal: ${escapeHtml(game.title)}">${gameCover(game, 'game-cover', index < 4)}</button>
        <div class="game-card-content">
            <button class="game-title" type="button" data-open-game="${escapeHtml(game.id)}">${escapeHtml(game.title)}</button>
            <p class="game-meta">${escapeHtml(game.platform || 'Unknown platform')}${game.year ? ` · ${game.year}` : ''}</p>
            <label class="select-label">Status<select class="status-select" data-status-id="${escapeHtml(game.id)}" aria-label="Status for ${escapeHtml(game.title)}">${Object.entries(STATUSES).map(([value, label]) => `<option value="${value}" ${game.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            ${game.status === 'completed' ? `<label class="rating-label">Rating<input class="rating-input" data-rating-id="${escapeHtml(game.id)}" aria-label="Rating for ${escapeHtml(game.title)}" type="number" min="1" max="10" step="1" inputmode="numeric" value="${game.rating ?? ''}" placeholder="—"><span>/ 10</span></label>` : `<p class="status-hint">${game.status === 'playing' ? 'In progress' : 'Ready when you are'}</p>`}
            <button class="text-button diary-link" type="button" data-open-game="${escapeHtml(game.id)}">Journal <span>${game.notes.length ? `(${game.notes.length})` : '↗'}</span></button>
        </div></article>`).join('') : '<p class="empty-state">No games in this list yet. Try another filter or add a game.</p>';
}

function noteMarkup(note) {
    return `<article class="session-note"><div class="session-heading"><p class="journal-meta">${formatDate(note.date)}${note.minutes ? ` · ${note.minutes} min` : ''}</p><button class="text-button danger-text" type="button" data-delete-entry="${escapeHtml(note.id)}" aria-label="Delete entry from ${formatDate(note.date)}">Delete entry</button></div><p class="note-text">${escapeHtml(note.text)}</p></article>`;
}

function openDeleteConfirmation(entryId = null) {
    const game = library.find(item => item.id === selectedId);
    if (!game || (entryId !== null && !game.notes.some(note => note.id === entryId))) return;
    pendingDeletion = { gameId: game.id, entryId, epoch: scopeEpoch };
    byId('deleteTitle').textContent = entryId === null ? `Delete “${game.title}”?` : 'Delete this entry?';
    byId('deleteDescription').textContent = entryId === null
        ? `This will remove the game and its journal (${game.notes.length} ${game.notes.length === 1 ? 'entry' : 'entries'}) from this library. This cannot be undone. Export your library first if you want a backup.`
        : `This will permanently remove this journal entry from “${game.title}”. The game and its other entries will stay in your library.`;
    byId('deleteEntryPreview').textContent = entryId === null ? '' : game.notes.find(note => note.id === entryId).text;
    byId('deleteEntryPreview').hidden = entryId === null;
    byId('confirmDelete').textContent = entryId === null ? 'Delete game' : 'Delete entry';
    showError('deleteError');
    byId('deleteDialog').showModal();
    byId('cancelDelete').focus();
}

function setupDeletion() {
    const dialog = byId('deleteDialog');
    const confirm = byId('confirmDelete');
    const cancel = byId('cancelDelete');
    byId('deleteGame').addEventListener('click', () => openDeleteConfirmation());
    byId('noteList').addEventListener('click', event => {
        const button = event.target.closest('[data-delete-entry]');
        if (button) openDeleteConfirmation(button.dataset.deleteEntry);
    });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => { if (confirm.disabled) event.preventDefault(); });
    dialog.addEventListener('close', () => { pendingDeletion = null; });
    confirm.addEventListener('click', async () => {
        if (!pendingDeletion || confirm.disabled) return;
        const { gameId, entryId, epoch } = pendingDeletion;
        const game = library.find(item => item.id === gameId);
        if (!game) return;
        const store = cloudStore;
        confirm.disabled = cancel.disabled = true;
        showError('deleteError');
        try {
            assertScope(epoch);
            const next = entryId === null ? removeGame(library, gameId) : removeEntry(library, gameId, entryId);
            await commitLibrary(next, epoch);
            dialog.close();
            if (entryId === null) {
                byId('detailDialog').close();
                selectedId = null;
            } else renderDetails();
            renderLibrary();
            renderRecentNotes();
            notify(entryId === null ? `Deleted “${game.title}” and its journal.` : 'Journal entry deleted. Your game is still in your library.');
            if (entryId === null) byId('libraryTitle').focus({ preventScroll: true });
            else byId('notesTitle').focus({ preventScroll: true });
            // Delete an uploaded cover only after the library save succeeds and no other game uses it.
            if (entryId === null && game.imageKey && !library.some(item => item.imageKey === game.imageKey)) {
                const url = coverUrls.get(game.imageKey);
                if (url) URL.revokeObjectURL(url);
                coverUrls.delete(game.imageKey);
                try {
                    if (store) await store.cover('delete', game.imageKey);
                    else await localCoverStore('delete', game.imageKey);
                } catch {
                    if (epoch === scopeEpoch) notify('The game was deleted, but its unused cover could not be removed from storage.', true);
                }
            }
        } catch (error) {
            if (epoch === scopeEpoch) showError('deleteError', error.message);
        } finally { confirm.disabled = cancel.disabled = false; }
    });
}

function renderRecentNotes() {
    const container = byId('recentNotes');
    if (!container) return;
    const recent = library.flatMap(game => game.notes.map(note => ({ game, note })))
        .sort((a, b) => b.note.date.localeCompare(a.note.date) || b.note.createdAt.localeCompare(a.note.createdAt)).slice(0, 3);
    container.innerHTML = recent.length ? recent.map(({ game, note }) => `<article class="journal-note"><button class="journal-game text-button" type="button" data-open-game="${escapeHtml(game.id)}">${escapeHtml(game.title)} <span>· ${STATUSES[game.status]}</span></button><p class="note-text">${escapeHtml(note.text)}</p><p class="journal-meta">${formatDate(note.date)}${note.minutes ? ` · ${note.minutes} min` : ''}</p></article>`).join('') : '<div class="journal-note"><p class="journal-game">Every game has a story.</p><p class="journal-meta">Select a cover or the Journal button below a game to write about your first session.</p></div>';
}

function renderDetails() {
    const game = library.find(item => item.id === selectedId);
    if (!game) return;
    byId('detailHeader').innerHTML = `${gameCover(game, 'detail-cover')}<div><h2 id="detailTitle">${escapeHtml(game.title)}</h2><p class="game-meta">${escapeHtml(game.platform || 'Unknown platform')}${game.year ? ` · ${game.year}` : ''}</p><p class="detail-status">${STATUSES[game.status]}${game.rating ? ` · Rating ${game.rating}/10` : ''}</p></div>`;
    byId('noteList').innerHTML = game.notes.length ? [...game.notes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map(noteMarkup).join('') : '<p class="journal-meta">No entries yet. Start with your first session.</p>';
}

function openDetails(id) {
    if (!library.some(game => game.id === id)) return;
    selectedId = id;
    byId('noteForm').reset();
    byId('noteDate').value = today();
    showError('noteFormError');
    renderDetails();
    if (!byId('detailDialog').open) byId('detailDialog').showModal();
}

function updatePreview(url = '') {
    const container = byId('coverPreview');
    container.replaceChildren();
    if (!url) { container.textContent = 'No cover'; return; }
    const image = new Image();
    image.alt = 'Game cover preview';
    image.src = url;
    image.onerror = () => { container.textContent = 'Unable to load image'; };
    container.append(image);
}

function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
}

function openGameForm(id = null) {
    editingId = id;
    const game = library.find(item => item.id === id);
    const form = byId('gameForm');
    form.reset();
    stagedCover = null;
    revokePreview();
    showError('gameFormError');
    byId('dialogTitle').textContent = game ? 'Edit game' : 'Add a game';
    if (game) {
        for (const field of ['title', 'platform', 'year', 'status', 'rating']) form.elements[field].value = game[field] ?? '';
        form.elements.image.value = game.image?.startsWith('http') ? game.image : '';
    }
    updatePreview(game ? coverUrls.get(game.imageKey) || safeImage(game.image) : '');
    byId('gameDialog').showModal();
}

function setupLibraryPage() {
    if (!byId('gameGrid')) return;
    renderLibrary();
    renderRecentNotes();
    if (readError) notify(`Unable to load the library: ${readError} Your data is unchanged. You can restore a backup using Import.`, true);
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
        currentFilter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(item => {
            item.classList.toggle('is-selected', item === button);
            item.setAttribute('aria-pressed', String(item === button));
        });
        renderLibrary();
    }));
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-open-game]');
        if (button) openDetails(button.dataset.openGame);
    });
    byId('gameGrid').addEventListener('change', async event => {
        const target = event.target;
        const id = target.dataset.statusId || target.dataset.ratingId;
        const game = library.find(item => item.id === id);
        if (!game) return;
        if (!target.checkValidity()) { target.reportValidity(); return; }
        const updates = target.dataset.statusId ? { status: target.value } : { rating: target.value === '' ? null : Number(target.value) };
        try {
            await commitLibrary(library.map(item => item.id === id ? { ...item, ...updates } : item));
            renderLibrary();
            renderRecentNotes();
            const next = [...byId('gameGrid').querySelectorAll('select, input')].find(element => element.dataset.statusId === id && target.dataset.statusId || element.dataset.ratingId === id && target.dataset.ratingId);
            next?.focus({ preventScroll: true });
        } catch (error) { renderLibrary(); notify(error.message, true); }
    });
    document.querySelectorAll('[data-open-dialog]').forEach(button => button.addEventListener('click', () => openGameForm()));
    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => byId('gameDialog').close()));
    document.querySelector('[data-close-detail]').addEventListener('click', () => byId('detailDialog').close());
    byId('editGame').addEventListener('click', () => { byId('detailDialog').close(); openGameForm(selectedId); });
    byId('gameDialog').addEventListener('close', revokePreview);
    byId('clearCover').addEventListener('click', () => {
        stagedCover = '';
        byId('gameForm').elements.image.value = '';
        byId('coverFile').value = '';
        revokePreview();
        updatePreview();
    });
    byId('gameForm').elements.image.addEventListener('input', event => {
        stagedCover = null;
        byId('coverFile').value = '';
        revokePreview();
        updatePreview(safeImage(event.target.value.trim()));
    });
    byId('coverFile').addEventListener('change', event => {
        const file = event.target.files[0];
        if (!file) return;
        showError('gameFormError');
        try { validateCoverFile(file); }
        catch (error) {
            showError('gameFormError', error.message);
            event.target.value = '';
            stagedCover = null;
            revokePreview();
            const existing = library.find(game => game.id === editingId);
            updatePreview(existing ? coverUrls.get(existing.imageKey) || safeImage(existing.image) : '');
            return;
        }
        stagedCover = file;
        byId('gameForm').elements.image.value = '';
        revokePreview();
        previewUrl = URL.createObjectURL(file);
        updatePreview(previewUrl);
    });
    byId('gameForm').addEventListener('submit', saveGame);
    byId('noteForm').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target;
        if (!form.reportValidity()) return;
        const fields = new FormData(form);
        const text = fields.get('text').trim();
        const date = fields.get('date');
        if (!text || !validDate(date)) { showError('noteFormError', 'Enter your note and a valid session date.'); return; }
        const note = { id: crypto.randomUUID(), text, date, minutes: fields.get('minutes') ? Number(fields.get('minutes')) : null, createdAt: new Date().toISOString() };
        try {
            await commitLibrary(library.map(game => game.id === selectedId ? { ...game, notes: [note, ...game.notes] } : game));
            form.reset();
            byId('noteDate').value = today();
            showError('noteFormError');
            renderDetails();
            renderLibrary();
            renderRecentNotes();
        } catch (error) { showError('noteFormError', error.message); }
    });
    setupBackup();
    setupDeletion();
}

async function saveGame(event) {
    event.preventDefault();
    const epoch = scopeEpoch;
    const form = event.target;
    if (!form.reportValidity()) return;
    showError('gameFormError');
    const fields = new FormData(form);
    const title = fields.get('title').trim();
    if (!title) { showError('gameFormError', 'Enter a game title.'); return; }
    const existing = library.find(game => game.id === editingId);
    const id = existing?.id || crypto.randomUUID();
    byId('saveGame').disabled = true;
    try {
        let imageKey = existing?.imageKey || '';
        let image = existing?.image || '';
        if (stagedCover instanceof File) {
            byId('saveGame').textContent = 'Compressing cover…';
            const blob = await prepareCover(stagedCover);
            assertScope(epoch);
            imageKey = crypto.randomUUID();
            await coverStore('put', imageKey, blob, epoch);
            coverUrls.set(imageKey, URL.createObjectURL(blob));
            image = '';
        } else if (stagedCover === '' || fields.get('image').trim()) {
            imageKey = '';
            image = safeImage(fields.get('image').trim());
        }
        const game = normalizeGame({ id, title, platform: fields.get('platform').trim(), year: fields.get('year'), status: fields.get('status'), rating: fields.get('rating'), image, imageKey, notes: existing?.notes || [] });
        byId('saveGame').textContent = 'Saving…';
        await commitLibrary(existing ? library.map(item => item.id === id ? game : item) : [game, ...library], epoch);
        byId('gameDialog').close();
        if (!existing) document.querySelector('[data-filter="all"]').click();
        renderLibrary();
        renderRecentNotes();
        if (existing) openDetails(id);
        else notify(`Added “${title}”. Open its journal to write about your first session.`);
    } catch (error) { showError('gameFormError', error.message); }
    finally { byId('saveGame').disabled = false; byId('saveGame').textContent = 'Save to library'; }
}

function setupBackup() {
    byId('exportLibrary').addEventListener('click', async event => {
        const epoch = scopeEpoch;
        const button = event.currentTarget;
        button.disabled = true;
        try {
            if (readError) throw new Error('Unable to export invalid data. Restore a valid library first.');
            const games = await Promise.all(library.map(async game => {
                const { imageKey, ...metadata } = game;
                if (!imageKey) return metadata;
                const blob = await coverStore('get', imageKey, undefined, epoch);
                if (!blob) throw new Error(`Missing cover for “${game.title}”. Select it again when editing the game before exporting.`);
                return { ...metadata, coverData: await blobToDataUrl(blob) };
            }));
            assertScope(epoch);
            const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, games }, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `gamelogs-${today()}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify('Library exported with your journal entries and custom covers.');
        } catch (error) { notify(error.message, true); }
        finally { button.disabled = false; }
    });
    byId('importLibrary').addEventListener('change', async event => {
        const epoch = scopeEpoch;
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        try {
            if (file.size > 50 * 1024 * 1024) throw new Error('This backup is too large. The maximum size is 50 MB.');
            const data = JSON.parse(await file.text());
            assertScope(epoch);
            if (data.version !== 1 || !Array.isArray(data.games) || data.games.length > 2000) throw new Error('Choose a JSON backup exported from GameLogs.');
            const ids = new Set();
            pendingImport = data.games.map(raw => {
                const game = normalizeGame(raw);
                if (ids.has(game.id)) throw new Error('This backup contains duplicate game identifiers.');
                ids.add(game.id);
                return { game: { ...game, imageKey: '' }, blob: raw.coverData ? dataUrlToBlob(raw.coverData) : null };
            });
            byId('importSummary').textContent = `Games: ${pendingImport.length} · Journal entries: ${pendingImport.reduce((sum, item) => sum + item.game.notes.length, 0)}`;
            showError('importError');
            byId('importDialog').showModal();
        } catch (error) { pendingImport = null; notify(`Unable to read this backup: ${error.message}`, true); }
    });
    byId('cancelImport').addEventListener('click', () => { pendingImport = null; byId('importDialog').close(); });
    byId('confirmImport').addEventListener('click', async event => {
        if (!pendingImport) return;
        const epoch = scopeEpoch;
        const items = pendingImport;
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const games = [];
            for (const { game, blob } of items) {
                if (blob) {
                    const cleanBlob = await prepareCover(new File([blob], 'cover', { type: blob.type }));
                    assertScope(epoch);
                    game.imageKey = crypto.randomUUID();
                    await coverStore('put', game.imageKey, cleanBlob, epoch);
                }
                games.push(game);
            }
            assertScope(epoch);
            if (cloudStore) await commitLibrary(games, epoch);
            else { saveLibrary(games); readError = ''; library = games; }
            pendingImport = null;
            await hydrateCovers();
            assertScope(epoch);
            byId('importDialog').close();
            document.querySelector('[data-filter="all"]').click();
            renderRecentNotes();
            notify('Library, custom covers and journal entries restored.');
        } catch (error) { showError('importError', error.message); }
        finally { button.disabled = false; }
    });
}

function setupDicePage() {
    const button = byId('rollButton');
    if (!button) return;
    button.addEventListener('click', async () => {
        const epoch = scopeEpoch;
        // Read again in case another tab changed the library.
        try {
            if (identityPending) throw new Error('Please wait for your account to load.');
            if (readError) throw new Error(readError);
            const games = cloudStore ? await cloudStore.load() : loadLibrary();
            assertScope(epoch);
            library = games;
        } catch (error) { byId('diceMessage').textContent = error.message; return; }
        const source = byId('diceSource').value;
        const games = source === 'all' ? library : library.filter(game => game.status === source);
        if (!games.length) {
            byId('randomResult').hidden = true;
            byId('diceMessage').textContent = 'No games in this list. Add a game or choose another list.';
            return;
        }
        button.disabled = true;
        byId('diceFace').classList.add('is-rolling');
        byId('diceMessage').textContent = 'Rolling…';
        setTimeout(async () => {
            if (epoch !== scopeEpoch) return;
            await hydrateCovers();
            if (epoch !== scopeEpoch) return;
            const game = games[Math.floor(Math.random() * games.length)];
            byId('diceFace').classList.remove('is-rolling');
            byId('diceFace').dataset.value = String(1 + Math.floor(Math.random() * 6));
            byId('diceMessage').textContent = `Today’s pick: ${game.title}`;
            byId('randomResult').innerHTML = `${gameCover(game, 'result-cover', true)}<div class="result-content"><p class="eyebrow">Today’s pick</p><h2 class="result-title" id="resultTitle">${escapeHtml(game.title)}</h2><p class="result-meta">${escapeHtml(game.platform)}${game.year ? ` · ${game.year}` : ''}</p><p class="result-status">${STATUSES[game.status]}</p><a class="text-button result-journal-link" href="index.html?game=${encodeURIComponent(game.id)}">Open journal ↗</a></div>`;
            byId('randomResult').hidden = false;
            button.disabled = false;
        }, 550);
    });
}

setupTheme();
setupGallery();
setupLibraryPage();
setupDicePage();
// Keep previously shared section links working after the English-only update.
const legacySection = { '#biblioteka': 'library', '#dziennik': 'journal' }[location.hash];
if (legacySection && byId(legacySection)) {
    history.replaceState(null, '', `#${legacySection}`);
    byId(legacySection).scrollIntoView();
}

async function changeIdentity(user, client, connectionError) {
    const epoch = ++scopeEpoch;
    identityPending = true;
    document.querySelector('main').inert = true;
    document.querySelectorAll('dialog:not(#accountDialog)').forEach(dialog => { if (dialog.open) dialog.close(); });
    selectedId = null;
    editingId = null;
    pendingImport = null;
    pendingDeletion = null;
    stagedCover = null;
    revokePreview();
    if (byId('randomResult')) byId('randomResult').hidden = true;
    if (byId('rollButton')) byId('rollButton').disabled = false;
    byId('diceFace')?.classList.remove('is-rolling');
    for (const url of coverUrls.values()) URL.revokeObjectURL(url);
    coverUrls.clear();
    library = [];
    renderLibrary();
    renderRecentNotes();
    cloudStore = user ? createCloudStore(client, user.id, normalizeGame) : null;
    readError = '';
    try {
        if (connectionError) throw connectionError;
        const games = cloudStore ? await cloudStore.load() : loadLibrary();
        if (scopeEpoch !== epoch) return;
        library = games;
        renderLibrary();
        renderRecentNotes();
    } catch (error) {
        if (scopeEpoch !== epoch) return;
        readError = cloudStore || connectionError ? error.message : `Unable to read your local library: ${error.message}`;
        library = [];
        notify(readError, true);
        throw error;
    } finally {
        if (scopeEpoch === epoch) {
            identityPending = false;
            document.querySelector('main').inert = false;
        }
    }
    await hydrateCovers();
    if (scopeEpoch === epoch) {
        renderLibrary();
        const initialGame = new URLSearchParams(location.search).get('game');
        if (initialGame && byId('detailDialog')) openDetails(initialGame);
    }
}

async function refreshCloudLibrary() {
    if (!cloudStore || writePending || identityPending) throw new Error('Please wait for the save to finish.');
    const epoch = scopeEpoch;
    const store = cloudStore;
    identityPending = true;
    let games;
    try { games = await store.load(); assertScope(epoch); }
    finally { if (epoch === scopeEpoch) identityPending = false; }
    library = games;
    readError = '';
    await hydrateCovers();
    assertScope(epoch);
    renderLibrary();
    renderRecentNotes();
    if (byId('detailDialog')?.open) renderDetails();
}

async function migrateLocalLibrary() {
    if (!cloudStore) throw new Error('Log in to bring your local games to your account.');
    if (readError) throw new Error('Refresh your account library first.');
    const epoch = scopeEpoch;
    const store = cloudStore;
    const local = loadLibrary();
    const existing = new Set(library.map(game => game.id));
    const additions = [];
    for (const game of local.filter(item => !existing.has(item.id))) {
        if (epoch !== scopeEpoch) throw new Error('Your account session has changed.');
        if (game.imageKey) {
            const blob = await localCoverStore('get', game.imageKey);
            assertScope(epoch);
            if (!blob) throw new Error(`Unable to read the cover for “${game.title}”. Update it in your local library before transferring.`);
            const key = crypto.randomUUID();
            await store.cover('put', key, blob);
            assertScope(epoch);
            additions.push({ ...game, imageKey: key });
        } else additions.push(game);
    }
    if (!additions.length) throw new Error('There are no new local games to transfer.');
    await commitLibrary([...library, ...additions], epoch);
    await hydrateCovers();
    renderLibrary();
    renderRecentNotes();
}

if (identityPending) document.querySelector('main').inert = true;
mountAccount({
    onUserChange: changeIdentity,
    onRefresh: refreshCloudLibrary,
    onMigrate: migrateLocalLibrary,
    isBusy: () => writePending || identityPending,
    canMigrate: () => { try { return Boolean(cloudStore && localStorage.getItem('gamelogs:library')); } catch { return false; } }
}).catch(error => notify(error.message, true));
