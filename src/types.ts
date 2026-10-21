export type GameStatus = 'backlog' | 'playing' | 'completed';
export type LibraryFilter = GameStatus | 'all';
export interface JournalEntry {
    id: string;
    text: string;
    date: string;
    minutes: number | null;
    createdAt: string;
}
export interface Game {
    id: string;
    title: string;
    platform: string; // Retained for compatibility with existing backups; not shown in the UI.
    year: number | '';
    status: GameStatus;
    rating: number | null;
    image: string;
    imageKey: string;
    notes: JournalEntry[];
}
export interface Screenshot {
    id: string;
    caption: string;
    url: string;
    thumbnail?: string;
    srcset?: string;
    created_at?: string;
}
export interface ScreenshotInput {
    id: string;
    caption: string;
}
export interface ImageVariant {
    src: string;
    width: number;
    height: number;
    bytes: number;
}
export interface ImageAsset {
    src: string;
    width: number;
    height: number;
    sizes: ImageVariant[];
    aliases?: string[];
}
export interface Notice {
    text: string;
    error?: boolean;
}
export interface ImportedGame {
    game: Game;
    blob: Blob | null;
}
export type CoverAction = 'get' | 'put' | 'delete';
export const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unable to complete this action. Please try again.';
export const today = (): string => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const formatDate = (date: string): string =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(`${date}T12:00:00`)
    );
