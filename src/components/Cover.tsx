import { useEffect, useRef, useState } from 'react';
import type { Game } from '../types';
import { imageAsset, originalImage, safeImage } from '../services/storage';
import { libraryStore, useLibrary } from '../state/library';
import { journalThumbnail } from '../services/thumbnails';

function useJournalThumbnail(source: string, enabled: boolean): string {
    const [thumbnail, setThumbnail] = useState<{ source: string; url: string } | null>(null);
    useEffect(() => {
        if (!enabled || !source) return;
        let active = true,
            objectURL = '';
        void journalThumbnail(source)
            .then((blob) => {
                if (!blob || !active) return;
                objectURL = URL.createObjectURL(blob);
                setThumbnail({ source, url: objectURL });
            })
            .catch(() => {
                // Keep the existing image if resampling is unavailable or blocked.
            });
        return () => {
            active = false;
            if (objectURL) URL.revokeObjectURL(objectURL);
        };
    }, [source, enabled]);
    return enabled && thumbnail?.source === source ? thumbnail.url : source;
}

export function Cover({
    game,
    className = 'game-cover',
    eager = false,
    showImage = true
}: {
    game: Game;
    className?: string;
    eager?: boolean;
    showImage?: boolean;
}) {
    const { covers } = useLibrary(),
        ref = useRef<HTMLDivElement>(null);
    const image = showImage ? (game.imageKey ? covers[game.imageKey] || '' : safeImage(game.image)) : '';
    const asset = imageAsset(image);
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [image]);
    useEffect(() => {
        if (!game.imageKey || image || !showImage) return;
        const node = ref.current;
        if (!node) return;
        let active = true;
        const load = () => {
            void libraryStore.ensureCover(game).catch(() => {
                if (active) setFailed(true);
            });
        };
        if (!('IntersectionObserver' in window)) {
            load();
            return () => {
                active = false;
            };
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    load();
                }
            },
            { rootMargin: '300px' }
        );
        observer.observe(node);
        return () => {
            active = false;
            observer.disconnect();
        };
    }, [game.imageKey, image, showImage]);
    const source = asset ? originalImage(image) : image;
    const displayedImage = useJournalThumbnail(source, className === 'journal-cover');
    return (
        <div ref={ref} className={`${className} cover-placeholder`}>
            <span aria-hidden="true">{game.title.charAt(0).toUpperCase()}</span>
            {image && !failed && (
                <img
                    src={displayedImage}
                    alt={`Cover for ${game.title}`}
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : 'auto'}
                    decoding="async"
                    width={asset?.width || 600}
                    height={asset?.height || 900}
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}
export function useObjectURL(blob: Blob | null): string {
    const [url, setURL] = useState('');
    useEffect(() => {
        if (!blob) {
            setURL('');
            return;
        }
        const value = URL.createObjectURL(blob);
        setURL(value);
        return () => URL.revokeObjectURL(value);
    }, [blob]);
    return url;
}
