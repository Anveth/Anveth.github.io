import { useSyncExternalStore } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Game, ImportedGame, Notice } from '../types';
import { errorMessage } from '../types';
import { connectSupabase, createCloudStore, friendlyError, type CloudStore } from '../services/cloud';
import {
    blobToDataUrl,
    loadGuestLibrary,
    loadLibrary,
    localCover,
    normalizeGame,
    prepareCover,
    saveLibrary
} from '../services/storage';

export interface LibraryState {
    games: Game[];
    user: User | null;
    client: SupabaseClient | null;
    loading: boolean;
    busy: boolean;
    readError: string;
    recovery: boolean;
    covers: Readonly<Record<string, string>>;
    notice: Notice | null;
}
class LibraryStore {
    private state: LibraryState = {
        games: [],
        user: null,
        client: null,
        loading: true,
        busy: false,
        readError: '',
        recovery: false,
        covers: {},
        notice: null
    };
    private listeners = new Set<() => void>();
    private epoch = 0;
    private cloud: CloudStore | null = null;
    private started = false;
    private owner: string | null | undefined;
    private blobs = new Map<string, Blob>();
    private pendingCovers = new Map<string, Promise<string>>();
    private unsubscribeAuth?: () => void;
    getSnapshot = (): LibraryState => this.state;
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    private update(patch: Partial<LibraryState>): void {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((listener) => listener());
    }
    notify = (text: string, error = false): void => this.update({ notice: { text, error } });
    clearNotice = (): void => this.update({ notice: null });
    private assert(epoch: number): void {
        if (epoch !== this.epoch)
            throw new Error('Your account changed during this operation. Try again on the correct account.');
    }
    scope = (): number => this.epoch;
    assertScope = (epoch: number): void => this.assert(epoch);
    async start(): Promise<void> {
        if (this.started) return;
        this.started = true;
        try {
            const client = await connectSupabase();
            this.update({ client });
            if (!client) {
                await this.identity(null);
                return;
            }
            const recoveryLink = /(?:^|[&#])type=recovery(?:&|$)/.test(location.hash);
            const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
                // Never await a Supabase request from inside the auth callback/lock.
                setTimeout(() => {
                    if (event === 'PASSWORD_RECOVERY') this.update({ recovery: true });
                    void this.identity(session?.user || null).catch((error) =>
                        this.notify(friendlyError(error), true)
                    );
                }, 0);
            });
            this.unsubscribeAuth = () => subscription.subscription.unsubscribe();
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            if (recoveryLink && data.session) this.update({ recovery: true });
            // loadScope reports read failures for its own epoch. A stale load must
            // not reach the fatal initialization handler and clear a newer account.
            await this.identity(data.session?.user || null).catch(() => undefined);
        } catch (error) {
            this.epoch++;
            this.update({
                games: [],
                loading: false,
                readError: friendlyError(error),
                notice: {
                    text: 'Unable to connect to accounts. Refresh the page before changing your library.',
                    error: true
                }
            });
        }
    }
    private async identity(user: User | null): Promise<void> {
        const owner = user?.id || null;
        if (owner === this.owner) {
            this.update({ user });
            return;
        }
        this.owner = owner;
        await this.loadScope(user);
    }
    private async loadScope(user: User | null): Promise<void> {
        const epoch = ++this.epoch;
        for (const url of Object.values(this.state.covers)) URL.revokeObjectURL(url);
        this.blobs.clear();
        this.pendingCovers.clear();
        this.cloud = user && this.state.client ? createCloudStore(this.state.client, user.id) : null;
        this.update({
            games: [],
            user,
            loading: true,
            busy: false,
            readError: '',
            covers: {},
            notice: null,
            recovery: user ? this.state.recovery : false
        });
        try {
            const games = this.cloud ? await this.cloud.load() : loadGuestLibrary();
            this.assert(epoch);
            this.update({ games });
        } catch (error) {
            if (epoch === this.epoch)
                this.update({
                    readError: errorMessage(error),
                    notice: { text: errorMessage(error), error: true }
                });
            throw error;
        } finally {
            if (epoch === this.epoch) this.update({ loading: false });
        }
    }
    refresh = async (): Promise<void> => {
        if (this.state.busy || this.state.loading)
            throw new Error('Please wait for the current save to finish.');
        await this.loadScope(this.state.user);
    };
    private async cover(
        action: 'get' | 'put' | 'delete',
        key: string,
        blob?: Blob,
        epoch = this.epoch
    ): Promise<Blob | undefined> {
        this.assert(epoch);
        const result = await (this.cloud
            ? this.cloud.cover(action, key, blob)
            : localCover(action, key, blob));
        this.assert(epoch);
        return result;
    }
    ensureCover = (game: Game): Promise<string> => {
        if (!game.imageKey) return Promise.resolve(game.image);
        const key = game.imageKey,
            existing = this.state.covers[key];
        if (existing) return Promise.resolve(existing);
        const pending = this.pendingCovers.get(key);
        if (pending) return pending;
        const epoch = this.epoch;
        const operation = (async () => {
            const blob = this.blobs.get(key) || (await this.cover('get', key, undefined, epoch));
            this.assert(epoch);
            if (!blob) throw new Error(`Unable to read the cover for “${game.title}”.`);
            this.blobs.set(key, blob);
            const url = URL.createObjectURL(blob);
            this.update({ covers: { ...this.state.covers, [key]: url } });
            return url;
        })().finally(() => {
            if (epoch === this.epoch) this.pendingCovers.delete(key);
        });
        this.pendingCovers.set(key, operation);
        return operation;
    };
    private async commit(games: Game[], epoch: number, recoverLocal = false): Promise<void> {
        this.assert(epoch);
        if (this.state.readError && !(recoverLocal && !this.cloud))
            throw new Error(
                'Refresh your account library or restore a valid local backup before saving. Your data is unchanged.'
            );
        const validated = games.map(normalizeGame);
        if (this.cloud) await this.cloud.save(validated);
        else saveLibrary(validated);
        this.assert(epoch);
        this.update({ games: validated, readError: '' });
    }
    private async write<T>(action: (epoch: number) => Promise<T>): Promise<T> {
        if (this.state.busy || this.state.loading)
            throw new Error('Please wait for the current save or account loading to finish.');
        const epoch = this.epoch;
        this.update({ busy: true });
        try {
            return await action(epoch);
        } finally {
            if (epoch === this.epoch) this.update({ busy: false });
        }
    }
    updateGames = (games: Game[]): Promise<void> => this.write((epoch) => this.commit(games, epoch));
    saveGame = (draft: Game, file: File | null, clear: boolean): Promise<void> =>
        this.write(async (epoch) => {
            const existing = this.state.games.find((game) => game.id === draft.id);
            let game = normalizeGame({
                ...draft,
                imageKey: clear ? '' : draft.imageKey,
                image: clear ? '' : draft.image
            });
            let uploaded = '';
            try {
                if (file) {
                    const blob = await prepareCover(file);
                    this.assert(epoch);
                    uploaded = crypto.randomUUID();
                    await this.cover('put', uploaded, blob, epoch);
                    this.blobs.set(uploaded, blob);
                    game = { ...game, imageKey: uploaded, image: '' };
                }
                await this.commit(
                    existing
                        ? this.state.games.map((item) => (item.id === game.id ? game : item))
                        : [game, ...this.state.games],
                    epoch
                );
            } catch (error) {
                if (uploaded && epoch === this.epoch)
                    await this.cover('delete', uploaded).catch(() => undefined);
                throw error;
            }
        });
    deleteGame = (id: string): Promise<void> =>
        this.write(async (epoch) => {
            const game = this.state.games.find((item) => item.id === id);
            if (!game) throw new Error('This game is no longer in your library.');
            await this.commit(
                this.state.games.filter((item) => item.id !== id),
                epoch
            );
            if (game.imageKey && !this.state.games.some((item) => item.imageKey === game.imageKey)) {
                try {
                    await this.cover('delete', game.imageKey, undefined, epoch);
                } catch {
                    if (epoch === this.epoch)
                        this.notify(
                            'The game was deleted, but its unused cover could not be removed from storage.',
                            true
                        );
                }
            }
        });
    restore = (items: ImportedGame[]): Promise<void> =>
        this.write(async (epoch) => {
            const games: Game[] = [],
                uploaded: string[] = [];
            try {
                for (const item of items) {
                    let game = { ...item.game };
                    if (item.blob) {
                        const blob = await prepareCover(item.blob);
                        this.assert(epoch);
                        const key = crypto.randomUUID();
                        await this.cover('put', key, blob, epoch);
                        uploaded.push(key);
                        this.blobs.set(key, blob);
                        game = { ...game, imageKey: key, image: '' };
                    }
                    games.push(game);
                }
                await this.commit(games, epoch, true);
            } catch (error) {
                if (epoch === this.epoch)
                    await Promise.all(
                        uploaded.map((key) => this.cover('delete', key).catch(() => undefined))
                    );
                throw error;
            }
        });
    exportBackup = async (): Promise<void> => {
        if (this.state.readError)
            throw new Error('Unable to export invalid data. Restore a valid backup first.');
        const epoch = this.epoch;
        const games = await Promise.all(
            this.state.games.map(async (game) => {
                const { imageKey, ...metadata } = game;
                if (!imageKey) return metadata;
                const blob =
                    this.blobs.get(imageKey) || (await this.cover('get', imageKey, undefined, epoch));
                if (!blob) throw new Error(`Missing cover for “${game.title}”.`);
                return { ...metadata, coverData: await blobToDataUrl(blob) };
            })
        );
        this.assert(epoch);
        const url = URL.createObjectURL(
            new Blob([JSON.stringify({ version: 1, games }, null, 2)], { type: 'application/json' })
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = `gamelogs-${new Date().toLocaleDateString('en-CA')}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    migrateLocal = (): Promise<void> =>
        this.write(async (epoch) => {
            if (!this.cloud) throw new Error('Log in to bring your local games to your account.');
            const existing = new Set(this.state.games.map((game) => game.id)),
                additions: Game[] = [],
                uploaded: string[] = [];
            try {
                for (const item of loadLibrary().filter((game) => !existing.has(game.id))) {
                    let game = { ...item };
                    if (game.imageKey) {
                        const blob = await localCover('get', game.imageKey);
                        this.assert(epoch);
                        if (!blob) throw new Error(`Unable to read the local cover for “${game.title}”.`);
                        const key = crypto.randomUUID();
                        await this.cover('put', key, blob, epoch);
                        uploaded.push(key);
                        game.imageKey = key;
                    }
                    additions.push(game);
                }
                if (!additions.length) throw new Error('There are no new local games to transfer.');
                await this.commit([...this.state.games, ...additions], epoch);
            } catch (error) {
                if (epoch === this.epoch)
                    await Promise.all(
                        uploaded.map((key) => this.cover('delete', key).catch(() => undefined))
                    );
                throw error;
            }
        });
    finishRecovery = (): void => this.update({ recovery: false });
    syncSession = (user: User | null): Promise<void> => this.identity(user);
    dispose = (): void => {
        this.unsubscribeAuth?.();
        this.epoch++;
        for (const url of Object.values(this.state.covers)) URL.revokeObjectURL(url);
    };
}
export const libraryStore = new LibraryStore();
export const useLibrary = (): LibraryState =>
    useSyncExternalStore(libraryStore.subscribe, libraryStore.getSnapshot);
if (import.meta.hot) import.meta.hot.dispose(() => libraryStore.dispose());
