import { setupGallery } from './gallery.js?v=20261016-5';
import { STATUSES, safeImage, normalizeGame, validDate, loadLibrary, saveLibrary, coverStore as localCoverStore, prepareCover, blobToDataUrl, dataUrlToBlob } from './storage.js?v=20261016-4';
import { createCloudStore } from './cloud.js?v=20261016-6';
import { mountAccount } from './account.js?v=20261016-6';
import { SUPABASE_CONFIG } from './config.js?v=20261016-6';

let library = [];
let readError = '';
try { library = loadLibrary(); } catch (error) { readError = error.message; }
let currentFilter = 'all';
let selectedId = null;
let editingId = null;
let stagedCover = null;
let previewUrl = '';
let pendingImport = null;
let cloudStore = null;
let scopeEpoch = 0;
let writePending = false;
let identityPending = Boolean(SUPABASE_CONFIG.url || SUPABASE_CONFIG.publishableKey);
const coverUrls = new Map();
const byId = id => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const formatDate = date => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date + 'T12:00:00'));

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
    if (epoch !== scopeEpoch) throw new Error('Konto zmieniło się w trakcie operacji. Ponów ją na właściwym koncie.');
}

async function commitLibrary(next, expectedEpoch = scopeEpoch) {
    assertScope(expectedEpoch);
    if (readError) throw new Error(cloudStore ? 'Najpierw odśwież bibliotekę w panelu konta. Zmiany nie zostały zapisane.' : 'Najpierw przywróć poprawną kopię biblioteki przez Importuj. Obecne dane nie zostały nadpisane.');
    if (writePending || identityPending) throw new Error('Poczekaj na zakończenie bieżącego zapisu lub wczytania konta.');
    const epoch = scopeEpoch;
    const store = cloudStore;
    writePending = true;
    try {
        if (store) await store.save(next);
        else saveLibrary(next);
        if (scopeEpoch !== epoch) throw new Error('Konto zmieniło się w trakcie zapisu. Odśwież bibliotekę.');
        library = next;
    } finally { writePending = false; }
}

async function coverStore(action, key, blob, epoch = scopeEpoch) {
    assertScope(epoch);
    if (identityPending) return Promise.reject(new Error('Poczekaj na wczytanie biblioteki konta.'));
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
        toggle.setAttribute('aria-label', light ? 'Włącz ciemny motyw' : 'Włącz jasny motyw');
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
        } catch { if (epoch === scopeEpoch) notify('Nie udało się wczytać okładki. Sprawdź połączenie lub wybierz ją ponownie w edycji gry.', true); }
    }));
}

function gameCover(game, className = 'game-cover') {
    const image = coverUrls.get(game.imageKey) || safeImage(game.image);
    return `<div class="${className} cover-placeholder"><span aria-hidden="true">${escapeHtml(game.title.charAt(0).toUpperCase())}</span>${image ? `<img src="${escapeHtml(image)}" alt="Okładka gry ${escapeHtml(game.title)}" loading="lazy">` : ''}</div>`;
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
    const noun = count === 1 ? 'gra' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'gry' : 'gier';
    byId('gameCount').textContent = `${count} ${noun}`;
    grid.innerHTML = games.length ? games.map(game => `<article class="game-card">
        <button class="cover-button" type="button" data-open-game="${escapeHtml(game.id)}" aria-label="Otwórz dziennik: ${escapeHtml(game.title)}">${gameCover(game)}</button>
        <div class="game-card-content">
            <button class="game-title" type="button" data-open-game="${escapeHtml(game.id)}">${escapeHtml(game.title)}</button>
            <p class="game-meta">${escapeHtml(game.platform || 'Platforma nieznana')}${game.year ? ` · ${game.year}` : ''}</p>
            <label class="select-label">Status<select class="status-select" data-status-id="${escapeHtml(game.id)}" aria-label="Status gry ${escapeHtml(game.title)}">${Object.entries(STATUSES).map(([value, label]) => `<option value="${value}" ${game.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            ${game.status === 'completed' ? `<label class="rating-label">Ocena<input class="rating-input" data-rating-id="${escapeHtml(game.id)}" aria-label="Ocena gry ${escapeHtml(game.title)}" type="number" min="1" max="10" step="1" inputmode="numeric" value="${game.rating ?? ''}" placeholder="—"><span>/ 10</span></label>` : `<p class="status-hint">${game.status === 'playing' ? 'W toku' : 'Czeka na swoją kolej'}</p>`}
            <button class="text-button diary-link" type="button" data-open-game="${escapeHtml(game.id)}">Dziennik <span>${game.notes.length ? `(${game.notes.length})` : '↗'}</span></button>
        </div></article>`).join('') : '<p class="empty-state">Brak gier w tej kategorii. Zmień filtr albo dodaj nowy tytuł.</p>';
}

function noteMarkup(note) {
    return `<article class="session-note"><p class="journal-meta">${formatDate(note.date)}${note.minutes ? ` · ${note.minutes} min` : ''}</p><p class="note-text">${escapeHtml(note.text)}</p></article>`;
}

function renderRecentNotes() {
    const container = byId('recentNotes');
    if (!container) return;
    const recent = library.flatMap(game => game.notes.map(note => ({ game, note })))
        .sort((a, b) => b.note.date.localeCompare(a.note.date) || b.note.createdAt.localeCompare(a.note.createdAt)).slice(0, 3);
    container.innerHTML = recent.length ? recent.map(({ game, note }) => `<article class="journal-note"><button class="journal-game text-button" type="button" data-open-game="${escapeHtml(game.id)}">${escapeHtml(game.title)} <span>· ${STATUSES[game.status]}</span></button><p class="note-text">${escapeHtml(note.text)}</p><p class="journal-meta">${formatDate(note.date)}${note.minutes ? ` · ${note.minutes} min` : ''}</p></article>`).join('') : '<div class="journal-note"><p class="journal-game">Każda gra ma swoją historię.</p><p class="journal-meta">Otwórz okładkę lub przycisk „Dziennik” pod grą, aby zapisać pierwszą sesję.</p></div>';
}

function renderDetails() {
    const game = library.find(item => item.id === selectedId);
    if (!game) return;
    byId('detailHeader').innerHTML = `${gameCover(game, 'detail-cover')}<div><h2 id="detailTitle">${escapeHtml(game.title)}</h2><p class="game-meta">${escapeHtml(game.platform || 'Platforma nieznana')}${game.year ? ` · ${game.year}` : ''}</p><p class="detail-status">${STATUSES[game.status]}${game.rating ? ` · Ocena ${game.rating}/10` : ''}</p></div>`;
    byId('noteList').innerHTML = game.notes.length ? [...game.notes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map(noteMarkup).join('') : '<p class="journal-meta">Jeszcze nie ma wpisów. Zacznij od pierwszej sesji.</p>';
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
    if (!url) { container.textContent = 'Brak okładki'; return; }
    const image = new Image();
    image.alt = 'Podgląd okładki gry';
    image.src = url;
    image.onerror = () => { container.textContent = 'Nie można wczytać obrazka'; };
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
    byId('dialogTitle').textContent = game ? 'Edytuj grę' : 'Dodaj grę';
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
    if (readError) notify(`Nie można wczytać biblioteki: ${readError} Dane pozostały nienaruszone. Możesz przywrócić kopię przez Importuj.`, true);
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
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
            showError('gameFormError', 'Wybierz JPG, PNG lub WebP o rozmiarze do 10 MB.');
            event.target.value = '';
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
        if (!text || !validDate(date)) { showError('noteFormError', 'Wpisz treść i poprawną datę sesji.'); return; }
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
}

async function saveGame(event) {
    event.preventDefault();
    const epoch = scopeEpoch;
    const form = event.target;
    if (!form.reportValidity()) return;
    showError('gameFormError');
    const fields = new FormData(form);
    const title = fields.get('title').trim();
    if (!title) { showError('gameFormError', 'Podaj nazwę gry.'); return; }
    const existing = library.find(game => game.id === editingId);
    const id = existing?.id || crypto.randomUUID();
    byId('saveGame').disabled = true;
    try {
        let imageKey = existing?.imageKey || '';
        let image = existing?.image || '';
        if (stagedCover instanceof File) {
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
        await commitLibrary(existing ? library.map(item => item.id === id ? game : item) : [game, ...library], epoch);
        byId('gameDialog').close();
        if (!existing) document.querySelector('[data-filter="all"]').click();
        renderLibrary();
        renderRecentNotes();
        if (existing) openDetails(id);
        else notify(`Dodano „${title}”. Otwórz dziennik gry, aby zapisać pierwszą sesję.`);
    } catch (error) { showError('gameFormError', error.message); }
    finally { byId('saveGame').disabled = false; }
}

function setupBackup() {
    byId('exportLibrary').addEventListener('click', async event => {
        const epoch = scopeEpoch;
        const button = event.currentTarget;
        button.disabled = true;
        try {
            if (readError) throw new Error('Nie można wyeksportować uszkodzonych danych. Najpierw przywróć poprawną bibliotekę.');
            const games = await Promise.all(library.map(async game => {
                const { imageKey, ...metadata } = game;
                if (!imageKey) return metadata;
                const blob = await coverStore('get', imageKey, undefined, epoch);
                if (!blob) throw new Error(`Brak lokalnej okładki gry „${game.title}”. Wybierz ją ponownie w edycji przed eksportem.`);
                return { ...metadata, coverData: await blobToDataUrl(blob) };
            }));
            assertScope(epoch);
            const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, games }, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `gamelogs-${today()}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify('Wyeksportowano bibliotekę z notatkami i własnymi okładkami.');
        } catch (error) { notify(error.message, true); }
        finally { button.disabled = false; }
    });
    byId('importLibrary').addEventListener('change', async event => {
        const epoch = scopeEpoch;
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        try {
            if (file.size > 50 * 1024 * 1024) throw new Error('Kopia jest za duża. Maksymalny rozmiar to 50 MB.');
            const data = JSON.parse(await file.text());
            assertScope(epoch);
            if (data.version !== 1 || !Array.isArray(data.games) || data.games.length > 2000) throw new Error('Wybierz plik JSON wyeksportowany z GameLogs.');
            const ids = new Set();
            pendingImport = data.games.map(raw => {
                const game = normalizeGame(raw);
                if (ids.has(game.id)) throw new Error('Kopia zawiera powtórzone identyfikatory gier.');
                ids.add(game.id);
                return { game: { ...game, imageKey: '' }, blob: raw.coverData ? dataUrlToBlob(raw.coverData) : null };
            });
            byId('importSummary').textContent = `Kopia zawiera ${pendingImport.length} gier i ${pendingImport.reduce((sum, item) => sum + item.game.notes.length, 0)} wpisów w dzienniku.`;
            showError('importError');
            byId('importDialog').showModal();
        } catch (error) { pendingImport = null; notify(`Nie można wczytać kopii: ${error.message}`, true); }
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
            notify('Przywrócono bibliotekę, własne okładki i dzienniki.');
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
            if (identityPending) throw new Error('Poczekaj na wczytanie konta.');
            if (readError) throw new Error(readError);
            const games = cloudStore ? await cloudStore.load() : loadLibrary();
            assertScope(epoch);
            library = games;
        } catch (error) { byId('diceMessage').textContent = error.message; return; }
        const source = byId('diceSource').value;
        const games = source === 'all' ? library : library.filter(game => game.status === source);
        byId('randomResult').hidden = true;
        if (!games.length) { byId('diceMessage').textContent = 'Brak gier w tej kategorii. Dodaj tytuł albo wybierz inne źródło.'; return; }
        button.disabled = true;
        byId('diceFace').classList.add('is-rolling');
        byId('diceMessage').textContent = 'Kość wybiera…';
        setTimeout(async () => {
            if (epoch !== scopeEpoch) return;
            await hydrateCovers();
            if (epoch !== scopeEpoch) return;
            const game = games[Math.floor(Math.random() * games.length)];
            byId('diceFace').classList.remove('is-rolling');
            byId('diceFace').textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.floor(Math.random() * 6)];
            byId('diceMessage').textContent = 'Dzisiejszy wybór:';
            byId('randomResult').innerHTML = `${gameCover(game, 'result-cover')}<div><p class="result-title">${escapeHtml(game.title)}</p><p class="result-meta">${escapeHtml(game.platform)}${game.year ? ` · ${game.year}` : ''}</p><p class="result-status">${STATUSES[game.status]}</p><a class="text-button" href="index.html?game=${encodeURIComponent(game.id)}">Otwórz dziennik ↗</a></div>`;
            byId('randomResult').hidden = false;
            button.disabled = false;
        }, 550);
    });
}

setupTheme();
setupGallery();
setupLibraryPage();
setupDicePage();

async function changeIdentity(user, client, connectionError) {
    const epoch = ++scopeEpoch;
    identityPending = true;
    document.querySelector('main').inert = true;
    document.querySelectorAll('dialog:not(#accountDialog)').forEach(dialog => { if (dialog.open) dialog.close(); });
    selectedId = null;
    editingId = null;
    pendingImport = null;
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
        readError = cloudStore || connectionError ? error.message : `Nie można odczytać lokalnej biblioteki: ${error.message}`;
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
    if (!cloudStore || writePending || identityPending) throw new Error('Poczekaj na zakończenie zapisu.');
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
    if (!cloudStore) throw new Error('Zaloguj się, aby przenieść lokalne gry.');
    if (readError) throw new Error('Najpierw odśwież bibliotekę konta.');
    const epoch = scopeEpoch;
    const store = cloudStore;
    const local = loadLibrary();
    const existing = new Set(library.map(game => game.id));
    const additions = [];
    for (const game of local.filter(item => !existing.has(item.id))) {
        if (epoch !== scopeEpoch) throw new Error('Sesja konta się zmieniła.');
        if (game.imageKey) {
            const blob = await localCoverStore('get', game.imageKey);
            assertScope(epoch);
            if (!blob) throw new Error(`Nie można odczytać okładki gry „${game.title}”. Popraw ją w lokalnej bibliotece przed przeniesieniem.`);
            const key = crypto.randomUUID();
            await store.cover('put', key, blob);
            assertScope(epoch);
            additions.push({ ...game, imageKey: key });
        } else additions.push(game);
    }
    if (!additions.length) throw new Error('Nie ma nowych lokalnych gier do przeniesienia.');
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
