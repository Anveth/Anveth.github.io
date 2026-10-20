import { IMAGE_ASSETS } from './image-assets.js?v=20261018-2';
import { DEFAULT_GAMES } from './games.js?v=20261018-2';

export const STATUSES = { backlog: 'Want to play', playing: 'Playing', completed: 'Completed' };
const LIBRARY_KEY = 'gamelogs:library';
let database;

export function safeImage(value = '') {
    if (typeof value !== 'string' || !value) return '';
    try {
        const url = new URL(value, window.location.href);
        return ['https:', 'http:'].includes(url.protocol) ? IMAGE_ASSETS[value]?.src || value : '';
    } catch { return ''; }
}

export function normalizeGame(value) {
    if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' || !value.title.trim() || !Object.hasOwn(STATUSES, value.status)) {
        throw new Error('This file contains an invalid game.');
    }
    const rating = value.rating == null || value.rating === '' ? null : Number(value.rating);
    const notes = (Array.isArray(value.notes) ? value.notes : []).map(note => {
        if (!note || typeof note.text !== 'string' || !note.text.trim() || !validDate(note.date)) throw new Error('Invalid journal entry.');
        return {
            id: typeof note.id === 'string' ? note.id : crypto.randomUUID(),
            text: note.text.trim().slice(0, 5000), date: note.date,
            minutes: Number.isInteger(note.minutes) && note.minutes > 0 && note.minutes <= 1440 ? note.minutes : null,
            createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date().toISOString()
        };
    });
    let image = value.image;
    // Migrate only the shipped Cyberpunk image; keep a user's custom cover.
    if (value.id === 'cyberpunk' && /(?:^|\/)images\/cyberpunk\.jpg$/.test(image)) image = 'images/cyberpunk-cover.jpg';
    image = safeImage(image);
    return {
        id: value.id.slice(0, 100), title: value.title.trim().slice(0, 80),
        platform: typeof value.platform === 'string' ? value.platform.slice(0, 30) : '',
        year: Number.isInteger(Number(value.year)) && Number(value.year) >= 1958 && Number(value.year) <= 2100 ? Number(value.year) : '',
        status: value.status, rating: Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : null,
        image, imageKey: typeof value.imageKey === 'string' ? value.imageKey : '', notes
    };
}

export function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function loadLibrary() {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw === null) return [];
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Unable to read your saved library.');
    // Retire only the untouched demo tile, never a user's journal or cloud library.
    return saved.map(normalizeGame).filter(game => !(game.id === 'walking-dead'
        && game.title === 'The Walking Dead' && game.platform === 'PC' && game.year === 2012
        && game.status === 'completed' && game.rating === 8 && game.notes.length === 0
        && !game.imageKey && ['images/twd.jpg', 'images/optimized/covers/twd-640.webp'].includes(game.image)));
}

export function loadGuestLibrary() {
    const saved = loadLibrary();
    // Demo is a guest-only view, not saved data or a seed for a new account.
    return saved.length ? saved : DEFAULT_GAMES.map(normalizeGame);
}

export function saveLibrary(games) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(games)); }
    catch { throw new Error('Unable to save changes. Check available storage and browser permissions. Export your library before clearing browser data.'); }
}

export function removeGame(games, gameId) {
    if (!games.some(game => game.id === gameId)) throw new Error('This game is no longer in your library.');
    return games.filter(game => game.id !== gameId);
}

export function removeEntry(games, gameId, entryId) {
    const game = games.find(item => item.id === gameId);
    if (!game?.notes.some(note => note.id === entryId)) throw new Error('This journal entry is no longer available.');
    return games.map(item => item.id === gameId ? { ...item, notes: item.notes.filter(note => note.id !== entryId) } : item);
}

async function openDatabase() {
    if (!database) database = new Promise((resolve, reject) => {
        const request = indexedDB.open('gamelogs-media', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('covers');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Cover storage is unavailable. Use an image URL or check your browser storage settings.'));
    });
    return database;
}

export async function coverStore(action, key, blob) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('covers', action === 'get' ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('covers');
        const request = action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(blob, key);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = transaction.onabort = () => reject(new Error('Unable to save the cover. Try a smaller file.'));
    });
}

export function validateCoverFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
    if (!file.size) throw new Error('The selected file is empty. Choose another image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('This file exceeds 10 MB and cannot be added. Choose a smaller image — accepted uploads are resized automatically.');
}

export async function prepareCover(file, { maxDimension = 1200, maxBytes = 512 * 1024, targetBytes = 300 * 1024 } = {}) {
    validateCoverFile(file);
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        try { await image.decode(); }
        catch { throw new Error('Unable to read this image. Choose another JPG, PNG or WebP file.'); }
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('This image is too large. Choose an image up to 40 megapixels.');
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare the cover in this browser. Try an updated browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let result;
        for (const quality of [.84, .76, .68, .6]) {
            result = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to prepare the image.')), 'image/webp', quality));
            if (result.type !== 'image/webp') throw new Error('This browser cannot save WebP images. Update it or use another browser.');
            if (result.size <= targetBytes) break;
        }
        if (result.size > maxBytes) throw new Error(`This image still exceeds ${Math.round(maxBytes / 1024)} KB after compression. Choose a smaller or less detailed image.`);
        return result;
    }
    finally { URL.revokeObjectURL(url); }
}

export function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the cover.'));
        reader.readAsDataURL(blob);
    });
}

export function dataUrlToBlob(value) {
    if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) throw new Error('Invalid cover in this library backup.');
    const [header, encoded] = value.split(',');
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    if (bytes.length > 10 * 1024 * 1024) throw new Error('A cover in this backup is too large.');
    return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) });
}
