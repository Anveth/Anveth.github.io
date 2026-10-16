export function validateConfig(config) {
    if (!config.url && !config.publishableKey) return false;
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Niepoprawny Project URL w config.js. Użyj adresu https://….supabase.co bez ścieżki.');
    const key = config.publishableKey;
    if (typeof key !== 'string' || !key) throw new Error('Uzupełnij publiczny klucz Supabase w config.js.');
    if (key.startsWith('sb_publishable_')) return true;
    try {
        const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        if (JSON.parse(atob(encoded)).role === 'anon') return true;
    } catch { /* Reject non-public credentials. */ }
    throw new Error('config.js może zawierać wyłącznie publiczny publishable key albo anon. Nie używaj klucza service_role/secret.');
}

export function friendlyError(error) {
    if (error?.message?.includes('LIBRARY_CONFLICT')) return 'Biblioteka zmieniła się na innym urządzeniu. Odśwież bibliotekę w panelu konta i ponów zmianę.';
    if (error?.message?.includes('ACCOUNT_CHANGED')) return 'Sesja konta zmieniła się. Zaloguj się ponownie przed zapisem.';
    if (error?.status === 401 || error?.code === 'PGRST301') return 'Sesja wygasła. Zaloguj się ponownie.';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(error?.message || '')) return 'Brak połączenia z serwerem. Zmiana nie została zapisana — spróbuj ponownie po odzyskaniu połączenia.';
    if (error?.code === 'PGRST202' || error?.code === '42P01') return 'Backend wymaga konfiguracji bazy. Uruchom supabase/schema.sql zgodnie z instrukcją KONTA.md.';
    return error?.message || 'Nie udało się wykonać operacji. Spróbuj ponownie.';
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
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new Error('Nieprawidłowy identyfikator okładki.');
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
            if (!data || !Array.isArray(data.games) || !Number.isInteger(data.revision)) throw new Error('Serwer zwrócił nieprawidłową bibliotekę.');
            const games = data.games.map(game => {
                const prefix = `${userId}/`;
                const cover = game.coverPath || '';
                if (cover && (!cover.startsWith(prefix) || !cover.endsWith('.webp'))) throw new Error('Nieprawidłowa ścieżka prywatnej okładki.');
                if (cover && pathFor(cover.slice(prefix.length, -5)) !== cover) throw new Error('Nieprawidłowa ścieżka prywatnej okładki.');
                return normalize({ ...game, imageKey: cover ? cover.slice(prefix.length, -5) : '' });
            });
            revision = data.revision;
            return games;
        },
        async save(games) {
            const payload = games.map(({ imageKey, ...game }) => ({ ...game, coverPath: imageKey ? pathFor(imageKey) : '' }));
            const nextRevision = check(await client.rpc('gamelogs_save_library', { p_owner: userId, p_games: payload, p_revision: revision }));
            if (!Number.isInteger(nextRevision)) throw new Error('Serwer nie potwierdził zapisu. Odśwież bibliotekę przed ponowieniem.');
            revision = nextRevision;
        },
        async cover(action, key, blob) {
            const storage = client.storage.from('game-covers');
            if (action === 'get') return check(await storage.download(pathFor(key)));
            check(await storage.upload(pathFor(key), blob, { contentType: 'image/webp', upsert: false, cacheControl: '3600' }));
        }
    };
}
