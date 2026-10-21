import { useEffect, useRef, useState } from 'react';
import type { Game } from '../types';
import { imageAsset, originalImage, safeImage } from '../services/storage';
import { libraryStore, useLibrary } from '../state/library';

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
    const asset = imageAsset(image),
        responsive = asset && className === 'journal-cover';
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
    const fallback = responsive ? asset.sizes[0]?.src : asset ? originalImage(image) : image;
    return (
        <div ref={ref} className={`${className} cover-placeholder`}>
            <span aria-hidden="true">{game.title.charAt(0).toUpperCase()}</span>
            {image && !failed && (
                <img
                    src={fallback}
                    srcSet={
                        responsive
                            ? asset.sizes.map((size) => `${size.src} ${size.width}w`).join(', ')
                            : undefined
                    }
                    sizes={responsive ? '44px' : undefined}
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
