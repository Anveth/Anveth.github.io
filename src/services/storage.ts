import { IMAGE_ASSETS } from '../../image-assets.js';
import { DEFAULT_GAMES } from '../../games.js';
import type { CoverAction, Game, GameStatus, ImageAsset, ImportedGame, JournalEntry } from '../types';

export const STATUSES: Record<GameStatus, string> = {
    backlog: 'Want to play',
    playing: 'Playing',
    completed: 'Completed'
};
export const LIBRARY_KEY = 'gamelogs:library';
const originalSources = new Map<ImageAsset, string>(
    Object.entries(IMAGE_ASSETS).map(([source, asset]) => [asset, source])
);
const assetsByPath = new Map<string, ImageAsset>(
    Object.entries(IMAGE_ASSETS).flatMap(([source, asset]) =>
        [source, ...asset.sizes.map((size) => size.src), ...(asset.aliases || [])].map(
            (path) => [path, asset] as [string, ImageAsset]
        )
    )
);

export function imageAsset(value: string): ImageAsset | null {
    if (!value) return null;
    const direct = assetsByPath.get(value);
    if (direct) return direct;
    try {
        const current = new URL(window.location.href),
            url = new URL(value, current);
        return url.origin === current.origin
            ? assetsByPath.get(url.pathname.replace(/^\/+/, '')) || null
            : null;
    } catch {
        return null;
    }
}
export function safeImage(value: unknown = ''): string {
    if (typeof value !== 'string' || !value) return '';
    try {
        const url = new URL(value, window.location.href);
        return ['https:', 'http:'].includes(url.protocol) ? imageAsset(value)?.src || value : '';
    } catch {
        return '';
    }
}
// Restore source quality for full covers, including libraries saved with optimized aliases.
// The original files remain in the project; no stored game data needs to be rewritten.
export function originalImage(value: string): string {
    const asset = imageAsset(value);
    return (asset && originalSources.get(asset)) || safeImage(value);
}
export function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('This file contains invalid data.');
    return value as Record<string, unknown>;
}
export function normalizeGame(raw: unknown): Game {
    const value = object(raw);
    if (
        typeof value.id !== 'string' ||
        typeof value.title !== 'string' ||
        !value.title.trim() ||
        typeof value.status !== 'string' ||
        !Object.hasOwn(STATUSES, value.status)
    )
        throw new Error('This file contains an invalid game.');
    const rating = value.rating == null || value.rating === '' ? null : Number(value.rating);
    const notes: JournalEntry[] = (Array.isArray(value.notes) ? value.notes : []).map((rawNote) => {
        const note = object(rawNote);
        if (typeof note.text !== 'string' || !note.text.trim() || !validDate(note.date))
            throw new Error('Invalid journal entry.');
        return {
            id: typeof note.id === 'string' ? note.id : crypto.randomUUID(),
            text: note.text.trim().slice(0, 5000),
            date: note.date,
            minutes:
                typeof note.minutes === 'number' &&
                Number.isInteger(note.minutes) &&
                note.minutes > 0 &&
                note.minutes <= 1440
                    ? note.minutes
                    : null,
            createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date().toISOString()
        };
    });
    let image = value.image;
    if (
        value.id === 'cyberpunk' &&
        typeof image === 'string' &&
        /(?:^|\/)images\/cyberpunk\.jpg$/.test(image)
    )
        image = 'images/cyberpunk-cover.jpg';
    return {
        id: value.id.slice(0, 100),
        title: value.title.trim().slice(0, 80),
        platform: typeof value.platform === 'string' ? value.platform.slice(0, 30) : '',
        year:
            Number.isInteger(Number(value.year)) && Number(value.year) >= 1958 && Number(value.year) <= 2100
                ? Number(value.year)
                : '',
        status: value.status as GameStatus,
        rating: rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : null,
        image: safeImage(image),
        imageKey: typeof value.imageKey === 'string' ? value.imageKey : '',
        notes
    };
}
export function loadLibrary(): Game[] {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw === null) return [];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('Unable to read your saved library.');
    return saved
        .map(normalizeGame)
        .filter(
            (game) =>
                !(
                    game.id === 'walking-dead' &&
                    game.title === 'The Walking Dead' &&
                    game.platform === 'PC' &&
                    game.year === 2012 &&
                    game.status === 'completed' &&
                    game.rating === 8 &&
                    !game.notes.length &&
                    !game.imageKey &&
                    ['images/twd.jpg', 'images/optimized/covers/twd-640.webp'].includes(game.image)
                )
        );
}
export function loadGuestLibrary(): Game[] {
    const saved = loadLibrary();
    return saved.length ? saved : DEFAULT_GAMES.map(normalizeGame);
}
export function saveLibrary(games: Game[]): void {
    try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(games));
    } catch {
        throw new Error(
            'Unable to save changes. Check available storage and browser permissions. Export your library before clearing browser data.'
        );
    }
}
export function removeGame(games: Game[], id: string): Game[] {
    if (!games.some((game) => game.id === id)) throw new Error('This game is no longer in your library.');
    return games.filter((game) => game.id !== id);
}
export function removeEntry(games: Game[], id: string, entryId: string): Game[] {
    if (!games.find((game) => game.id === id)?.notes.some((note) => note.id === entryId))
        throw new Error('This journal entry is no longer available.');
    return games.map((game) =>
        game.id === id ? { ...game, notes: game.notes.filter((note) => note.id !== entryId) } : game
    );
}
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
    return (database ||= new Promise((resolve, reject) => {
        const request = indexedDB.open('gamelogs-media', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('covers');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            database = undefined;
            reject(
                new Error(
                    'Cover storage is unavailable. Use an image URL or check your browser storage settings.'
                )
            );
        };
    }));
}
export async function localCover(action: CoverAction, key: string, blob?: Blob): Promise<Blob | undefined> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('covers', action === 'get' ? 'readonly' : 'readwrite'),
            store = tx.objectStore('covers');
        const request =
            action === 'get'
                ? store.get(key)
                : action === 'delete'
                  ? store.delete(key)
                  : store.put(blob, key);
        tx.oncomplete = () => resolve(request.result instanceof Blob ? request.result : undefined);
        tx.onerror = tx.onabort = () => reject(new Error('Unable to save the cover. Try a smaller file.'));
    });
}
export function validateCoverFile(file: Pick<File, 'type' | 'size'>): void {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('Choose a JPG, PNG or WebP image.');
    if (!file.size) throw new Error('The selected file is empty. Choose another image.');
    if (file.size > 10 * 1024 * 1024)
        throw new Error(
            'This file exceeds 10 MB and cannot be added. Choose a smaller image — accepted uploads are resized automatically.'
        );
}
export async function prepareCover(
    file: Blob,
    { maxDimension = 800, maxBytes = 256 * 1024, targetBytes = 128 * 1024 } = {}
): Promise<Blob> {
    validateCoverFile(file);
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        try {
            await image.decode();
        } catch {
            throw new Error('Unable to read this image. Choose another JPG, PNG or WebP file.');
        }
        if (
            !image.naturalWidth ||
            !image.naturalHeight ||
            image.naturalWidth * image.naturalHeight > 40000000
        )
            throw new Error('This image is too large. Choose an image up to 40 megapixels.');
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare the cover in this browser. Try an updated browser.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let result: Blob | undefined;
        for (const quality of [0.84, 0.76, 0.68, 0.6]) {
            result = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                    (blob) => (blob ? resolve(blob) : reject(new Error('Unable to prepare the image.'))),
                    'image/webp',
                    quality
                )
            );
            if (result.type !== 'image/webp')
                throw new Error('This browser cannot save WebP images. Update it or use another browser.');
            if (result.size <= targetBytes) break;
        }
        if (!result || result.size > maxBytes)
            throw new Error(
                `This image still exceeds ${Math.round(maxBytes / 1024)} KB after compression. Choose a smaller or less detailed image.`
            );
        return result;
    } finally {
        URL.revokeObjectURL(url);
    }
}
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            typeof reader.result === 'string'
                ? resolve(reader.result)
                : reject(new Error('Unable to read the cover.'));
        reader.onerror = () => reject(new Error('Unable to read the cover.'));
        reader.readAsDataURL(blob);
    });
}
export function dataUrlToBlob(value: unknown): Blob {
    if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))
        throw new Error('Invalid cover in this library backup.');
    const [header, encoded] = value.split(',');
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    if (bytes.length > 10 * 1024 * 1024) throw new Error('A cover in this backup is too large.');
    return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) });
}
export async function parseBackup(file: File): Promise<ImportedGame[]> {
    if (file.size > 50 * 1024 * 1024) throw new Error('This backup is too large. The maximum size is 50 MB.');
    const data = object(JSON.parse(await file.text()));
    if (data.version !== 1 || !Array.isArray(data.games) || data.games.length > 2000)
        throw new Error('Choose a JSON backup exported from GameLogs.');
    const ids = new Set<string>();
    return data.games.map((raw) => {
        const value = object(raw),
            game = normalizeGame(value);
        if (ids.has(game.id)) throw new Error('This backup contains duplicate game identifiers.');
        ids.add(game.id);
        return {
            game: { ...game, imageKey: '' },
            blob: value.coverData ? dataUrlToBlob(value.coverData) : null
        };
    });
}
