import type { SupabaseClient } from '@supabase/supabase-js';
import type { Screenshot, ScreenshotInput } from '../types';
import { errorMessage } from '../types';
import { check } from './cloud';

export const validId = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function validateScreenshot(record: ScreenshotInput, blob?: Blob): void {
    if (!validId(record.id) || typeof record.caption !== 'string' || record.caption.length > 100)
        throw new Error('Invalid screenshot details.');
    if (blob && (blob.type !== 'image/webp' || !blob.size || blob.size > 1048576))
        throw new Error('A compressed screenshot must be WebP, up to 1 MB.');
}
export function createCloudGalleryStore(client: SupabaseClient, userId: string) {
    if (!validId(userId)) throw new Error('Invalid gallery owner.');
    const path = (id: string): string => {
        if (!validId(id)) throw new Error('Invalid screenshot identifier.');
        return `${userId}/${id}.webp`;
    };
    const bucket = () => client.storage.from('game-screenshots');
    return {
        async list(): Promise<Screenshot[]> {
            const rows: { id: string; caption: string; created_at: string; user_id: string }[] = [];
            for (let offset = 0; ; offset += 100) {
                const page = check(
                    await client
                        .from('gamelogs_screenshots')
                        .select('id,caption,created_at,user_id')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .order('id')
                        .range(offset, offset + 99)
                );
                if (!Array.isArray(page)) throw new Error('Invalid gallery response.');
                for (const row of page) {
                    if (row.user_id !== userId) throw new Error('Invalid gallery owner.');
                    validateScreenshot(row);
                }
                rows.push(...page);
                if (page.length < 100) break;
            }
            const photos: Screenshot[] = [];
            for (let offset = 0; offset < rows.length; offset += 100) {
                const batch = rows.slice(offset, offset + 100),
                    urls = check(
                        await bucket().createSignedUrls(
                            batch.map((row) => path(row.id)),
                            3600
                        )
                    );
                for (let index = 0; index < batch.length; index++) {
                    const url = urls?.[index]?.signedUrl;
                    if (urls?.[index]?.error || !url || new URL(url).protocol !== 'https:')
                        throw new Error('Unable to load a private screenshot. Reload the page to retry.');
                    photos.push({ ...batch[index], url });
                }
            }
            return photos;
        },
        async add(record: ScreenshotInput, blob: Blob): Promise<void> {
            validateScreenshot(record, blob);
            check(
                await bucket().upload(path(record.id), blob, {
                    contentType: 'image/webp',
                    upsert: false,
                    cacheControl: '3600'
                })
            );
            try {
                const saved = check(
                    await client
                        .from('gamelogs_screenshots')
                        .insert({ user_id: userId, ...record })
                        .select('id')
                        .single()
                );
                if (saved?.id !== record.id)
                    throw new Error(
                        'The server did not confirm the screenshot save. Refresh before retrying.'
                    );
            } catch (error) {
                try {
                    check(
                        await client
                            .from('gamelogs_screenshots')
                            .delete()
                            .eq('user_id', userId)
                            .eq('id', record.id)
                    );
                    check(await bucket().remove([path(record.id)]));
                } catch {
                    throw new Error(
                        `${errorMessage(error)} The unused upload could not be cleaned up. Please retry when connected.`
                    );
                }
                throw error;
            }
        },
        async remove(id: string): Promise<string> {
            const objectPath = path(id);
            const removed = check(
                await client
                    .from('gamelogs_screenshots')
                    .delete()
                    .eq('user_id', userId)
                    .eq('id', id)
                    .select('id')
                    .single()
            );
            if (removed?.id !== id)
                throw new Error('The server did not confirm screenshot deletion. Reload the page to retry.');
            try {
                check(await bucket().remove([objectPath]));
                return '';
            } catch {
                return 'The screenshot was removed, but its unused file could not be cleaned up from storage.';
            }
        }
    };
}
