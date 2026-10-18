export function validateConfig(config) {
    if (!config.url && !config.publishableKey) return false;
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid Project URL in config.js. Use https://….supabase.co without a path.');
    const key = config.publishableKey;
    if (typeof key !== 'string' || !key) throw new Error('Add your public Supabase key to config.js.');
    if (key.startsWith('sb_publishable_')) return true;
    try {
        const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        if (JSON.parse(atob(encoded)).role === 'anon') return true;
    } catch { /* Reject non-public credentials. */ }
    throw new Error('config.js may only contain a public publishable or anon key. Never use a service_role or secret key.');
}

export function friendlyError(error) {
    if (error?.message?.includes('LIBRARY_CONFLICT')) return 'Your library changed on another device. Refresh it in My account and try again.';
    if (error?.message?.includes('ACCOUNT_CHANGED')) return 'Your account session has changed. Log in again before saving.';
    if (error?.status === 401 || error?.code === 'PGRST301') return 'Your session has expired. Log in again.';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(error?.message || '')) return 'Unable to reach the server. Your change was not saved — try again when your connection is restored.';
    if (error?.code === 'PGRST202' || error?.code === '42P01') return 'The database needs to be configured. Run supabase/schema.sql as described in KONTA.md.';
    return error?.message || 'Unable to complete this action. Please try again.';
}

export async function connectSupabase(config) {
    if (!validateConfig(config)) return null;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.118.0');
    return createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
    });
}

export function createCloudStore(client, userId, normalize) {
    let revision = 0;
    const pathFor = key => {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new Error('Invalid cover identifier.');
        return `${userId}/${key}.webp`;
    };
    const check = result => {
        if (result.error) throw new Error(friendlyError(result.error));
        return result.data;
    };
    return {
        userId,
        async load() {
            const data = check(await client.rpc('gamelogs_load_library', { p_owner: userId }));
            if (!data || !Array.isArray(data.games) || !Number.isInteger(data.revision)) throw new Error('The server returned an invalid library.');
            const games = data.games.map(game => {
                const prefix = `${userId}/`;
                const cover = game.coverPath || '';
                if (cover && (!cover.startsWith(prefix) || !cover.endsWith('.webp'))) throw new Error('Invalid private cover path.');
                if (cover && pathFor(cover.slice(prefix.length, -5)) !== cover) throw new Error('Invalid private cover path.');
                return normalize({ ...game, imageKey: cover ? cover.slice(prefix.length, -5) : '' });
            });
            revision = data.revision;
            return games;
        },
        async save(games) {
            const payload = games.map(({ imageKey, ...game }) => ({ ...game, coverPath: imageKey ? pathFor(imageKey) : '' }));
            const nextRevision = check(await client.rpc('gamelogs_save_library', { p_owner: userId, p_games: payload, p_revision: revision }));
            if (!Number.isInteger(nextRevision)) throw new Error('The server did not confirm the save. Refresh your library before trying again.');
            revision = nextRevision;
        },
        async cover(action, key, blob) {
            const storage = client.storage.from('game-covers');
            if (action === 'get') return check(await storage.download(pathFor(key)));
            if (action === 'delete') return check(await storage.remove([pathFor(key)]));
            check(await storage.upload(pathFor(key), blob, { contentType: 'image/webp', upsert: false, cacheControl: '3600' }));
        }
    };
}
