import { friendlyError } from './cloud.js?v=20261018-2';

const validId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const check = result => {
    if (result.error) throw new Error(friendlyError(result.error));
    return result.data;
};
export function validateScreenshot(record, blob) {
    if (!validId(record.id) || typeof record.caption !== 'string' || record.caption.length > 100) throw new Error('Invalid screenshot details.');
    if (blob && (blob.type !== 'image/webp' || !blob.size || blob.size > 1048576)) throw new Error('A compressed screenshot must be WebP, up to 1 MB.');
    return record;
}

export function createCloudGalleryStore(client, userId) {
    if (!validId(userId)) throw new Error('Invalid gallery owner.');
    const path = id => {
        if (!validId(id)) throw new Error('Invalid screenshot identifier.');
        return `${userId}/${id}.webp`;
    };
    const bucket = () => client.storage.from('game-screenshots');
    return {
        async list() {
            const rows = [];
            for (let offset = 0; ; offset += 100) {
                const page = check(await client.from('gamelogs_screenshots').select('id,caption,created_at,user_id').eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 99));
                if (!Array.isArray(page)) throw new Error('Invalid gallery response.');
                for (const row of page) {
                    if (row.user_id !== userId) throw new Error('Invalid gallery owner.');
                    validateScreenshot(row);
                }
                rows.push(...page);
                if (page.length < 100) break;
            }
            const result = [];
            for (let offset = 0; offset < rows.length; offset += 100) {
                const batch = rows.slice(offset, offset + 100);
                const urls = check(await bucket().createSignedUrls(batch.map(row => path(row.id)), 3600));
                for (let index = 0; index < batch.length; index++) {
                    const url = urls?.[index]?.signedUrl;
                    if (urls?.[index]?.error || !url || new URL(url).protocol !== 'https:') throw new Error('Unable to load a private screenshot. Try refreshing the gallery.');
                    result.push({ ...batch[index], url });
                }
            }
            return result;
        },
        async add(record, blob) {
            validateScreenshot(record, blob);
            check(await bucket().upload(path(record.id), blob, { contentType: 'image/webp', upsert: false, cacheControl: '3600' }));
            try {
                const saved = check(await client.from('gamelogs_screenshots').insert({ user_id: userId, id: record.id, caption: record.caption }).select('id').single());
                if (saved?.id !== record.id) throw new Error('The server did not confirm the screenshot save. Refresh before retrying.');
            } catch (error) {
                // A lost response may still have committed the row: remove it before its blob.
                try {
                    check(await client.from('gamelogs_screenshots').delete().eq('user_id', userId).eq('id', record.id));
                    check(await bucket().remove([path(record.id)]));
                }
                catch { throw new Error(`${error.message} The unused upload could not be cleaned up. Please retry when connected.`); }
                throw error;
            }
        },
        async remove(id) {
            const objectPath = path(id);
            const removed = check(await client.from('gamelogs_screenshots').delete().eq('user_id', userId).eq('id', id).select('id').single());
            if (removed?.id !== id) throw new Error('The server did not confirm screenshot deletion. Refresh the gallery.');
            try { check(await bucket().remove([objectPath])); return ''; }
            catch { return 'The screenshot was removed from your gallery, but its unused file could not be cleaned up from storage.'; }
        }
    };
}

export function createLocalGalleryStore() {
    let database;
    const open = () => database ||= new Promise((resolve, reject) => {
        const request = indexedDB.open('gamelogs-screenshots', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('screenshots', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Screenshot storage is unavailable in this browser.'));
    });
    async function transaction(mode, operation) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('screenshots', mode);
            const request = operation(tx.objectStore('screenshots'));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = tx.onabort = () => reject(new Error('Unable to save screenshots. Check browser storage space and permissions.'));
        });
    }
    return {
        async list() { return (await transaction('readonly', store => store.getAll())).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)); },
        async add(record, blob) { validateScreenshot(record, blob); await transaction('readwrite', store => store.add({ ...record, blob, created_at: new Date().toISOString() })); },
        async remove(id) { if (!validId(id)) throw new Error('Invalid screenshot identifier.'); await transaction('readwrite', store => store.delete(id)); return ''; }
    };
}
