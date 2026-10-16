import { DEFAULT_GAMES } from './games.js?v=20261016-7';
import { IMAGE_ASSETS } from './image-assets.js?v=20261016-7';

export const STATUSES = { backlog: 'Backlog', playing: 'Gram', completed: 'Ukończone' };
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
    if (raw === null) return DEFAULT_GAMES.map(normalizeGame);
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Nie udało się odczytać zapisanej biblioteki.');
    // Retire only the untouched demo tile, never a user's journal or cloud library.
    return saved.map(normalizeGame).filter(game => !(game.id === 'walking-dead'
        && game.title === 'The Walking Dead' && game.platform === 'PC' && game.year === 2012
        && game.status === 'completed' && game.rating === 8 && game.notes.length === 0
        && !game.imageKey && ['images/twd.jpg', 'images/optimized/covers/twd-640.webp'].includes(game.image)));
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

export function validateCoverFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Wybierz obraz JPG, PNG lub WebP.');
    if (!file.size) throw new Error('Wybrany plik jest pusty. Wybierz inny obraz.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Plik przekracza 10 MB i nie zostanie dodany. Wybierz mniejszy obraz — dopuszczalny plik pomniejszymy automatycznie.');
}

export async function prepareCover(file) {
    validateCoverFile(file);
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        try { await image.decode(); }
        catch { throw new Error('Nie można odczytać tego obrazu. Wybierz inny plik JPG, PNG lub WebP.'); }
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Obraz ma zbyt dużą rozdzielczość. Wybierz zdjęcie do 40 megapikseli.');
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Przeglądarka nie pozwala przygotować okładki. Spróbuj w nowszej przeglądarce.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let result;
        for (const quality of [.84, .76, .68, .6]) {
            result = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nie udało się przygotować obrazu.')), 'image/webp', quality));
            if (result.type !== 'image/webp') throw new Error('Ta przeglądarka nie obsługuje zapisu WebP. Zaktualizuj ją lub wybierz inną.');
            if (result.size <= 300 * 1024) break;
        }
        if (result.size > 512 * 1024) throw new Error('Nawet po kompresji okładka przekracza 512 KB. Wybierz mniej szczegółowy lub mniejszy obraz.');
        return result;
    }
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
