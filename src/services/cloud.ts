import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../../config.js';
import { normalizeGame } from './storage';
import type { CoverAction, Game } from '../types';
import { errorMessage } from '../types';

export function friendlyError(error: unknown): string {
    const value = error as { message?: string; status?: number; code?: string } | null;
    if (value?.message?.includes('LIBRARY_CONFLICT'))
        return 'Your library changed on another device. Refresh it in My account and try again.';
    if (value?.message?.includes('ACCOUNT_CHANGED'))
        return 'Your account session has changed. Log in again before saving.';
    if (value?.status === 401 || value?.code === 'PGRST301') return 'Your session has expired. Log in again.';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(value?.message || ''))
        return 'Unable to reach the server. Your change was not saved — try again when your connection is restored.';
    if (value?.code === 'PGRST202' || value?.code === '42P01')
        return 'The database needs to be configured. See KONTA.md.';
    return value?.message || errorMessage(error);
}
export function check<T>(result: { data: T; error: unknown }): T {
    if (result.error) throw new Error(friendlyError(result.error));
    return result.data;
}
export const config = {
    url: import.meta.env?.VITE_SUPABASE_URL ?? SUPABASE_CONFIG.url,
    publishableKey: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_CONFIG.publishableKey
};
export function validateConfig(value: { url: string; publishableKey: string }): boolean {
    if (!value.url && !value.publishableKey) return false;
    const url = new URL(value.url);
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    )
        throw new Error('Invalid Project URL.');
    if (value.publishableKey.startsWith('sb_publishable_')) return true;
    try {
        const payload: unknown = JSON.parse(
            atob(value.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        if (payload && typeof payload === 'object' && 'role' in payload && payload.role === 'anon')
            return true;
    } catch {
        /* Secret and malformed keys are rejected. */
    }
    throw new Error(
        'Only a public publishable or anon key is allowed. Never use a service_role or secret key.'
    );
}
let connection: Promise<SupabaseClient | null> | undefined;
export function connectSupabase(): Promise<SupabaseClient | null> {
    return (connection ||= (async () => {
        if (!validateConfig(config)) return null;
        const { createClient } = await import('@supabase/supabase-js');
        return createClient(config.url, config.publishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'implicit'
            }
        });
    })());
}
export function createCloudStore(client: SupabaseClient, userId: string) {
    let revision = 0;
    const pathFor = (key: string): string => {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new Error('Invalid cover identifier.');
        return `${userId}/${key}.webp`;
    };
    return {
        userId,
        async load(): Promise<Game[]> {
            const data: unknown = check(await client.rpc('gamelogs_load_library', { p_owner: userId }));
            if (
                !data ||
                typeof data !== 'object' ||
                !('games' in data) ||
                !Array.isArray(data.games) ||
                !('revision' in data) ||
                !Number.isInteger(data.revision)
            )
                throw new Error('The server returned an invalid library.');
            const games = data.games.map((raw: unknown) => {
                if (!raw || typeof raw !== 'object') throw new Error('Invalid game.');
                const game = raw as Record<string, unknown>,
                    cover = game.coverPath || '';
                if (
                    typeof cover !== 'string' ||
                    (cover &&
                        (!cover.startsWith(`${userId}/`) ||
                            !cover.endsWith('.webp') ||
                            pathFor(cover.slice(userId.length + 1, -5)) !== cover))
                )
                    throw new Error('Invalid private cover path.');
                return normalizeGame({ ...game, imageKey: cover ? cover.slice(userId.length + 1, -5) : '' });
            });
            revision = data.revision as number;
            return games;
        },
        async save(games: Game[]): Promise<void> {
            const payload = games.map(({ imageKey, ...game }) => ({
                ...game,
                coverPath: imageKey ? pathFor(imageKey) : ''
            }));
            const next: unknown = check(
                await client.rpc('gamelogs_save_library', {
                    p_owner: userId,
                    p_games: payload,
                    p_revision: revision
                })
            );
            if (!Number.isInteger(next))
                throw new Error(
                    'The server did not confirm the save. Refresh your library before trying again.'
                );
            revision = next as number;
        },
        async cover(action: CoverAction, key: string, blob?: Blob): Promise<Blob | undefined> {
            const path = pathFor(key);
            const bucket = client.storage.from('game-covers');
            if (action === 'get') return check(await bucket.download(path)) || undefined;
            if (action === 'delete') {
                check(await bucket.remove([path]));
                return;
            }
            if (!blob) throw new Error('Missing cover.');
            check(
                await bucket.upload(path, blob, {
                    contentType: 'image/webp',
                    upsert: false,
                    cacheControl: '3600'
                })
            );
        }
    };
}
export type CloudStore = ReturnType<typeof createCloudStore>;
