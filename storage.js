import { DEFAULT_GAMES } from './games.js?v=20261016-3';

export const STATUSES = { backlog: 'Backlog', playing: 'Gram', completed: 'Ukończone' };
const LIBRARY_KEY = 'gamelogs:library';
let database;

export function safeImage(value = '') {
    if (typeof value !== 'string' || !value) return '';
    try {
        const url = new URL(value, window.location.href);
        return ['https:', 'http:'].includes(url.protocol) ? value : '';
    } catch { return ''; }
}

export function normalizeGame(value) {
    if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' || !value.title.trim() || !Object.hasOwn(STATUSES, value.status)) {
        throw new Error('Plik zawiera nieprawidłową grę.');
    }
    const rating = value.rating == null || value.rating === '' ? null : Number(value.rating);
    const notes = (Array.isArray(value.notes) ? value.notes : []).map(note => {
        if (!note || typeof note.text !== 'string' || !note.text.trim() || !validDate(note.date)) throw new Error('Nieprawidłowy wpis w dzienniku.');
        return {
            id: typeof note.id === 'string' ? note.id : crypto.randomUUID(),
            text: note.text.trim().slice(0, 5000), date: note.date,
            minutes: Number.isInteger(note.minutes) && note.minutes > 0 && note.minutes <= 1440 ? note.minutes : null,
            createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date().toISOString()
        };
    });
    let image = safeImage(value.image);
    // Migrate only the shipped Cyberpunk image; keep a user's custom cover.
    if (value.id === 'cyberpunk' && /(?:^|\/)images\/cyberpunk\.jpg$/.test(image)) image = 'images/cyberpunk-cover.jpg';
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
    if (raw === null) return DEFAULT_GAMES.map(normalizeGame);
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Nie udało się odczytać zapisanej biblioteki.');
    return saved.map(normalizeGame);
}

export function saveLibrary(games) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(games)); }
    catch { throw new Error('Nie udało się zapisać zmian. Sprawdź wolne miejsce lub uprawnienia przeglądarki. Wyeksportuj bibliotekę przed czyszczeniem jej danych.'); }
}

async function openDatabase() {
    if (!database) database = new Promise((resolve, reject) => {
        const request = indexedDB.open('gamelogs-media', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('covers');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Przeglądarka nie udostępnia miejsca na okładki. Użyj adresu obrazka lub sprawdź ustawienia przechowywania danych.'));
    });
    return database;
}

export async function coverStore(action, key, blob) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('covers', action === 'get' ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('covers');
        const request = action === 'get' ? store.get(key) : store.put(blob, key);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = transaction.onabort = () => reject(new Error('Nie udało się zapisać okładki. Spróbuj mniejszego pliku.'));
    });
}

export async function prepareCover(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Wybierz obraz JPG, PNG lub WebP.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Obraz jest za duży. Limit wynosi 10 MB.');
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nie udało się przygotować obrazu.')), 'image/webp', 0.9));
    } catch { throw new Error('Nie można odczytać tego obrazu. Wybierz inny plik JPG, PNG lub WebP.'); }
    finally { URL.revokeObjectURL(url); }
}

export function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Nie udało się odczytać okładki.'));
        reader.readAsDataURL(blob);
    });
}

export function dataUrlToBlob(value) {
    if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) throw new Error('Nieprawidłowa okładka w kopii biblioteki.');
    const [header, encoded] = value.split(',');
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    if (bytes.length > 10 * 1024 * 1024) throw new Error('Okładka w kopii jest za duża.');
    return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) });
}
