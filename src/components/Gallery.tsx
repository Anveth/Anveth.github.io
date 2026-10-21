import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { DEMO_SCREENSHOTS } from '../../gallery-demo.js';
import type { Screenshot } from '../types';
import { errorMessage } from '../types';
import { useLibrary, libraryStore } from '../state/library';
import { createCloudGalleryStore } from '../services/screenshots';
import { prepareCover, validateCoverFile } from '../services/storage';
import { CloseButton, FormError, Modal } from './Modal';
import { useObjectURL } from './Cover';

function LightboxImage({ photo }: { photo: Screenshot }) {
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(false);
    return (
        <div className="lightbox-stage" aria-busy={loading && !error}>
            {(loading || error) && (
                <p className="lightbox-message" role="status">
                    {error
                        ? 'Unable to load the image. Check your connection and try again.'
                        : 'Loading image…'}
                </p>
            )}
            <img
                src={photo.url}
                alt={photo.caption || 'Your screenshot'}
                decoding="async"
                hidden={loading || error}
                onLoad={() => setLoading(false)}
                onError={() => setError(true)}
            />
        </div>
    );
}
function Lightbox({
    photos,
    index,
    setIndex,
    onClose,
    onDelete
}: {
    photos: Screenshot[];
    index: number;
    setIndex: (index: number) => void;
    onClose: () => void;
    onDelete?: (id: string) => void;
}) {
    const photo = photos[index];
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            setIndex(
                event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? photos.length - 1
                      : Math.max(0, Math.min(photos.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))
            );
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [index, photos.length, setIndex]);
    if (!photo) return null;
    return (
        <Modal className="gallery-lightbox" label="lightboxTitle" closeOnBackdrop onClose={onClose}>
            <div className="lightbox-shell">
                <div className="lightbox-heading">
                    <div>
                        <h2 id="lightboxTitle">{photo.caption || 'Screenshot'}</h2>
                        <p className="dialog-caption">In-game moments</p>
                    </div>
                    <CloseButton label="Close image" onClick={onClose} />
                </div>
                <LightboxImage key={photo.url} photo={photo} />
                <div className="lightbox-footer">
                    <p className="lightbox-count" aria-live="polite">
                        {index + 1} / {photos.length}
                    </p>
                    <div className="gallery-controls">
                        <button
                            className="icon-button gallery-arrow"
                            disabled={index === 0}
                            aria-label="Previous image"
                            onClick={() => setIndex(index - 1)}
                        >
                            ←
                        </button>
                        <button
                            className="icon-button gallery-arrow"
                            disabled={index === photos.length - 1}
                            aria-label="Next image"
                            onClick={() => setIndex(index + 1)}
                        >
                            →
                        </button>
                    </div>
                    {onDelete && (
                        <button className="text-button danger-text" onClick={() => onDelete(photo.id)}>
                            Delete screenshot
                        </button>
                    )}
                    <p className="lightbox-hint">← → change image · Esc to close</p>
                </div>
            </div>
        </Modal>
    );
}
export function Gallery() {
    const { user, client, loading } = useLibrary(),
        owner = user?.id || 'guest';
    const [photos, setPhotos] = useState<Screenshot[]>([]),
        [loadedOwner, setLoadedOwner] = useState(''),
        [ready, setReady] = useState(false),
        [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(''),
        [upload, setUpload] = useState(false),
        [deletion, setDeletion] = useState<string | null>(null),
        [activePhoto, setActivePhoto] = useState<number | null>(null);
    const [file, setFile] = useState<File | null>(null),
        [error, setError] = useState('');
    const preview = useObjectURL(file),
        track = useRef<HTMLDivElement>(null),
        storeRef = useRef<ReturnType<typeof createCloudGalleryStore> | null>(null);
    const list = loadedOwner === owner ? photos : [],
        remote = Boolean(user);
    const [position, setPosition] = useState({ first: 1, last: 2, left: 0, max: 0 });
    const drag = useRef<{ x: number; left: number } | null>(null),
        dragged = useRef(false);
    const working = useRef(false),
        requests = useRef(0);
    const work = (value: boolean) => {
        working.current = value;
        setBusy(value);
    };
    useEffect(() => {
        let current = true;
        requests.current++;
        storeRef.current = null;
        working.current = false;
        setPhotos([]);
        setLoadedOwner(owner);
        setReady(false);
        setUpload(false);
        setDeletion(null);
        setActivePhoto(null);
        setMessage('');
        setBusy(false);
        if (loading) return;
        if (!user) {
            storeRef.current = null;
            setPhotos(DEMO_SCREENSHOTS);
            setReady(true);
            return;
        }
        if (!client) {
            setMessage('Unable to connect to the gallery. Reload the page to retry.');
            return;
        }
        const store = createCloudGalleryStore(client, user.id);
        storeRef.current = store;
        let expires = 0;
        const load = async () => {
            const request = ++requests.current;
            try {
                const next = await store.list();
                if (current && request === requests.current) {
                    setPhotos(next);
                    setReady(true);
                    setMessage('');
                    expires = Date.now() + 50 * 60 * 1000;
                }
            } catch (error) {
                if (current && request === requests.current)
                    setMessage(`Unable to load screenshots. ${errorMessage(error)}`);
            }
        };
        setMessage('Loading screenshots…');
        void load();
        const renew = () => {
            if (!working.current && Date.now() > expires) void load();
        };
        const interval = setInterval(renew, 5 * 60 * 1000);
        window.addEventListener('focus', renew);
        return () => {
            current = false;
            clearInterval(interval);
            window.removeEventListener('focus', renew);
        };
    }, [user?.id, client, loading, owner]);
    const update = useCallback(() => {
        const node = track.current;
        if (!node) return;
        const max = Math.max(0, node.scrollWidth - node.clientWidth),
            bounds = node.getBoundingClientRect();
        const frames = [...node.querySelectorAll<HTMLElement>('.gallery-frame')];
        const visible = frames
            .map((frame, index) => ({ index, rect: frame.getBoundingClientRect() }))
            .filter(({ rect }) => rect.right > bounds.left + 2 && rect.left < bounds.right - 2);
        setPosition({
            left: node.scrollLeft,
            max,
            first: (visible[0]?.index || 0) + 1,
            last: (visible.at(-1)?.index ?? Math.max(0, list.length - 1)) + 1
        });
    }, [list.length]);
    useEffect(() => {
        const node = track.current;
        if (!node) return;
        node.scrollLeft = 0;
        update();
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, [list, update]);
    const behavior = (): ScrollBehavior =>
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    const move = (direction: number) => {
        const node = track.current,
            first = node?.querySelector<HTMLElement>('.gallery-frame');
        if (!node || !first) return;
        const stride = first.offsetWidth + parseFloat(getComputedStyle(node).columnGap || '0');
        node.scrollBy({
            left: direction * stride * Math.max(1, Math.round(node.clientWidth / stride)),
            behavior: behavior()
        });
    };
    const openUpload = () => {
        if (!remote || !ready || busy || list.length >= 100) return;
        setFile(null);
        setError('');
        setUpload(true);
    };
    const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (
            event.pointerType === 'touch' ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest('button')
        )
            return;
        drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
        dragged.current = false;
    };
    return (
        <section
            className="gallery-section"
            id="gallery"
            aria-labelledby="galleryTitle"
            aria-roledescription="carousel"
        >
            <div className="page-width">
                <div className="section-heading gallery-heading">
                    <div className="section-title-group">
                        <h2 id="galleryTitle">Gallery</h2>
                        <p className="section-caption">In-game moments</p>
                    </div>
                    <div className="gallery-controls">
                        <span className="gallery-counter">
                            {list.length
                                ? `${position.first}–${position.last} / ${list.length}`
                                : '0 screenshots'}
                        </span>
                        <button
                            className="icon-button gallery-arrow"
                            disabled={!list.length || position.left <= 2}
                            aria-label="Previous screenshots"
                            aria-controls="galleryTrack"
                            onClick={() => move(-1)}
                        >
                            ←
                        </button>
                        <button
                            className="icon-button gallery-arrow"
                            disabled={!list.length || position.left >= position.max - 2}
                            aria-label="Next screenshots"
                            aria-controls="galleryTrack"
                            onClick={() => move(1)}
                        >
                            →
                        </button>
                    </div>
                </div>
                <div className="gallery-tools">
                    <p className="gallery-hint" id="galleryHint">
                        Your favourite screenshots. Select an image to view it full size.
                    </p>
                    {remote && (
                        <button
                            className="button button-secondary"
                            disabled={!ready || busy || list.length >= 100}
                            onClick={openUpload}
                        >
                            Add screenshot
                        </button>
                    )}
                </div>
                {message && (
                    <p className="app-message" role="status">
                        {message}
                    </p>
                )}
                <div
                    className="gallery-track"
                    id="galleryTrack"
                    ref={track}
                    tabIndex={0}
                    role="region"
                    aria-label="Screenshot gallery"
                    aria-describedby="galleryHint"
                    onScroll={update}
                    onPointerDown={pointerDown}
                    onPointerMove={(event) => {
                        if (!drag.current) return;
                        if (Math.abs(event.clientX - drag.current.x) > 5) {
                            dragged.current = true;
                            event.currentTarget.setPointerCapture(event.pointerId);
                        }
                        if (dragged.current) {
                            event.preventDefault();
                            event.currentTarget.scrollLeft =
                                drag.current.left - (event.clientX - drag.current.x);
                        }
                    }}
                    onPointerUp={() => {
                        drag.current = null;
                    }}
                    onPointerCancel={() => {
                        drag.current = null;
                    }}
                    onClickCapture={(event) => {
                        if (dragged.current) {
                            event.preventDefault();
                            event.stopPropagation();
                            dragged.current = false;
                        }
                    }}
                    onKeyDown={(event) => {
                        if (
                            event.target !== event.currentTarget ||
                            !['ArrowLeft', 'ArrowRight'].includes(event.key)
                        )
                            return;
                        event.preventDefault();
                        move(event.key === 'ArrowLeft' ? -1 : 1);
                    }}
                >
                    {list.map((photo, index) => (
                        <div className="gallery-frame" key={photo.id}>
                            <a
                                className="gallery-item"
                                href={photo.url}
                                aria-label={`${photo.caption || 'Screenshot'}, view full size`}
                                onDragStart={(event) => event.preventDefault()}
                                onClick={(event) => {
                                    event.preventDefault();
                                    setActivePhoto(index);
                                }}
                            >
                                <img
                                    src={photo.thumbnail || photo.url}
                                    srcSet={photo.srcset}
                                    sizes={
                                        photo.srcset
                                            ? '(max-width: 650px) calc(100vw - 32px), (min-width: 2560px) 708px, (min-width: 1921px) calc(25vw + 68px), (min-width: 1168px) 552px, calc(50vw - 32px)'
                                            : undefined
                                    }
                                    width={1920}
                                    height={1080}
                                    alt={photo.caption || 'Your screenshot'}
                                    loading="lazy"
                                    decoding="async"
                                    draggable={false}
                                />
                                <span>{photo.caption || 'Screenshot'}</span>
                            </a>
                        </div>
                    ))}
                    {remote &&
                        Array.from({ length: Math.max(0, 2 - list.length) }, (_, index) => (
                            <button
                                className="gallery-upload"
                                key={`upload-${index}`}
                                disabled={!ready || busy}
                                onClick={openUpload}
                            >
                                <span className="placeholder-plus" aria-hidden="true">
                                    +
                                </span>
                                <strong>Add your favourite screenshots</strong>
                                <span>Keep a moment from your games</span>
                            </button>
                        ))}
                </div>
                <input
                    className="gallery-progress"
                    type="range"
                    min={0}
                    max={1000}
                    step={1}
                    value={position.max ? Math.round((position.left / position.max) * 1000) : 0}
                    hidden={!list.length}
                    disabled={position.max <= 0}
                    aria-label="Scroll gallery"
                    onChange={(event) =>
                        track.current?.scrollTo({
                            left: (Number(event.target.value) / 1000) * position.max,
                            behavior: 'instant'
                        })
                    }
                />
            </div>
            {activePhoto !== null && list[activePhoto] && (
                <Lightbox
                    photos={list}
                    index={activePhoto}
                    setIndex={setActivePhoto}
                    onClose={() => setActivePhoto(null)}
                    onDelete={
                        remote
                            ? (id) => {
                                  setActivePhoto(null);
                                  setError('');
                                  setDeletion(id);
                              }
                            : undefined
                    }
                />
            )}
            {upload && (
                <Modal label="screenshotTitle" busy={busy} onClose={() => setUpload(false)}>
                    <form
                        onSubmit={async (event) => {
                            event.preventDefault();
                            if (!file || busy || !storeRef.current) return;
                            const epoch = libraryStore.scope(),
                                store = storeRef.current,
                                caption = String(
                                    new FormData(event.currentTarget).get('caption') || ''
                                ).trim();
                            requests.current++;
                            work(true);
                            setError('');
                            let saved = false;
                            try {
                                const blob = await prepareCover(file, {
                                    maxDimension: 1920,
                                    maxBytes: 1048576,
                                    targetBytes: 650 * 1024
                                });
                                libraryStore.assertScope(epoch);
                                await store.add({ id: crypto.randomUUID(), caption }, blob);
                                saved = true;
                                libraryStore.assertScope(epoch);
                                setUpload(false);
                                const next = await store.list();
                                libraryStore.assertScope(epoch);
                                setPhotos(next);
                                setMessage('');
                            } catch (error) {
                                if (epoch !== libraryStore.scope()) return;
                                if (saved)
                                    setMessage(
                                        `Screenshot saved, but the gallery could not refresh. ${errorMessage(error)}`
                                    );
                                else setError(errorMessage(error));
                            } finally {
                                if (epoch === libraryStore.scope()) work(false);
                            }
                        }}
                    >
                        <div className="dialog-heading">
                            <div>
                                <h2 id="screenshotTitle">Add a screenshot</h2>
                                <p className="dialog-caption">Your favourite moments</p>
                            </div>
                            <CloseButton
                                label="Close screenshot form"
                                disabled={busy}
                                onClick={() => setUpload(false)}
                            />
                        </div>
                        <div className="form-grid">
                            <label className="form-wide">
                                Screenshot (JPG, PNG or WebP, max. 10 MB)
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    required
                                    disabled={busy}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            validateCoverFile(file);
                                            setFile(file);
                                            setError('');
                                        } catch (error) {
                                            event.target.value = '';
                                            setFile(null);
                                            setError(errorMessage(error));
                                        }
                                    }}
                                />
                            </label>
                            <label className="form-wide">
                                Game or caption (optional)
                                <input
                                    name="caption"
                                    maxLength={100}
                                    disabled={busy}
                                    placeholder="A moment worth keeping"
                                />
                            </label>
                        </div>
                        {preview && (
                            <div className="screenshot-preview">
                                <img src={preview} alt="Screenshot preview" />
                            </div>
                        )}
                        <p className="form-hint">
                            Images are resized to 1920 px and saved as WebP, up to 1 MB. Up to 100
                            screenshots. Screenshots are separate from your game library.
                        </p>
                        <FormError text={error} />
                        <div className="dialog-actions">
                            <button
                                type="button"
                                className="button button-secondary"
                                disabled={busy}
                                onClick={() => setUpload(false)}
                            >
                                Cancel
                            </button>
                            <button className="button button-primary" disabled={busy}>
                                {busy ? 'Saving…' : 'Save screenshot'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            {deletion && (
                <Modal
                    className="game-dialog confirm-dialog"
                    label="deleteScreenshotTitle"
                    busy={busy}
                    onClose={() => setDeletion(null)}
                >
                    <div className="detail-content">
                        <h2 id="deleteScreenshotTitle">Delete screenshot?</h2>
                        <p className="dialog-caption">
                            {list.find((photo) => photo.id === deletion)?.caption || 'Screenshot'}
                        </p>
                        <p>
                            This permanently removes the screenshot. Your games and journal entries will stay.
                        </p>
                        <FormError text={error} />
                        <div className="dialog-actions">
                            <button
                                className="button button-secondary"
                                disabled={busy}
                                onClick={() => setDeletion(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="button button-danger"
                                disabled={busy}
                                onClick={async () => {
                                    if (!storeRef.current || working.current) return;
                                    const epoch = libraryStore.scope(),
                                        store = storeRef.current;
                                    requests.current++;
                                    work(true);
                                    setError('');
                                    try {
                                        const warning = await store.remove(deletion);
                                        libraryStore.assertScope(epoch);
                                        setPhotos((photos) =>
                                            photos.filter((photo) => photo.id !== deletion)
                                        );
                                        setDeletion(null);
                                        setMessage(warning);
                                    } catch (error) {
                                        if (epoch === libraryStore.scope()) setError(errorMessage(error));
                                    } finally {
                                        if (epoch === libraryStore.scope()) work(false);
                                    }
                                }}
                            >
                                Delete screenshot
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </section>
    );
}
