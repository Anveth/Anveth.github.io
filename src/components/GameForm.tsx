import { useState, type FormEvent } from 'react';
import type { Game } from '../types';
import { errorMessage } from '../types';
import { normalizeGame, safeImage, STATUSES, validateCoverFile } from '../services/storage';
import { libraryStore, useLibrary } from '../state/library';
import { CloseButton, FormError, Modal } from './Modal';
import { Cover, useObjectURL } from './Cover';

export function GameForm({
    game,
    onClose,
    onSaved
}: {
    game?: Game;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { busy } = useLibrary();
    const [file, setFile] = useState<File | null>(null),
        [mode, setMode] = useState<'keep' | 'remove' | 'file' | 'url'>('keep');
    const [url, setURL] = useState(game?.image.startsWith('http') ? game.image : ''),
        [error, setError] = useState('');
    const preview = useObjectURL(file);
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const fields = new FormData(event.currentTarget);
        try {
            const image = mode === 'url' ? safeImage(url.trim()) : mode === 'keep' ? game?.image || '' : '';
            const draft = normalizeGame({
                id: game?.id || crypto.randomUUID(),
                title: fields.get('title'),
                platform: game?.platform || '',
                year: fields.get('year'),
                status: fields.get('status'),
                rating: fields.get('rating'),
                image,
                imageKey: mode === 'keep' ? game?.imageKey || '' : '',
                notes: game?.notes || []
            });
            await libraryStore.saveGame(draft, file, mode === 'remove');
            onSaved();
            onClose();
        } catch (error) {
            setError(errorMessage(error));
        }
    }
    return (
        <Modal label="dialogTitle" busy={busy} onClose={onClose}>
            <form id="gameForm" onSubmit={save}>
                <div className="dialog-heading">
                    <div>
                        <h2 id="dialogTitle">{game ? 'Edit game' : 'Add a game'}</h2>
                        <p className="dialog-caption">Your library</p>
                    </div>
                    <CloseButton onClick={onClose} label="Close form" disabled={busy} />
                </div>
                <fieldset disabled={busy} className="form-grid">
                    <label>
                        Game title
                        <input
                            name="title"
                            defaultValue={game?.title || ''}
                            autoComplete="off"
                            required
                            maxLength={80}
                            placeholder="e.g. Hades II"
                        />
                    </label>
                    <label>
                        Release year
                        <input
                            name="year"
                            type="number"
                            defaultValue={game?.year || ''}
                            min={1958}
                            max={2100}
                            placeholder="2026"
                        />
                    </label>
                    <label>
                        Status
                        <select name="status" defaultValue={game?.status || 'backlog'}>
                            {Object.entries(STATUSES).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Rating (1–10, optional)
                        <input
                            name="rating"
                            type="number"
                            defaultValue={game?.rating ?? ''}
                            min={1}
                            max={10}
                            step={1}
                            placeholder="—"
                        />
                    </label>
                    <label>
                        Upload cover (max. 10 MB)
                        <input
                            id="coverFile"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-describedby="coverHelp"
                            onChange={(event) => {
                                const next = event.target.files?.[0];
                                if (!next) return;
                                try {
                                    validateCoverFile(next);
                                    setFile(next);
                                    setMode('file');
                                    setURL('');
                                    setError('');
                                } catch (error) {
                                    event.target.value = '';
                                    setError(errorMessage(error));
                                }
                            }}
                        />
                    </label>
                    <label className="form-wide">
                        Or a cover image URL
                        <input
                            type="url"
                            inputMode="url"
                            value={url}
                            placeholder="https://..."
                            onChange={(event) => {
                                setURL(event.target.value);
                                setMode(event.target.value ? 'url' : 'remove');
                                setFile(null);
                            }}
                        />
                    </label>
                    <div className="cover-preview-row form-wide">
                        <div className="cover-preview" aria-label="Cover preview">
                            {preview || (mode === 'url' && safeImage(url)) ? (
                                <img src={preview || safeImage(url)} alt="Cover preview" />
                            ) : game && mode === 'keep' ? (
                                <Cover game={game} className="detail-cover" />
                            ) : (
                                'No cover'
                            )}
                        </div>
                        <p id="coverHelp">
                            JPG, PNG or WebP up to 10 MB and 40 megapixels. Covers are resized to 800 px and
                            converted to WebP (target 128 KB, max. 256 KB). External image URLs are not
                            converted. A cover is optional.
                        </p>
                        <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                                setMode('remove');
                                setURL('');
                                setFile(null);
                            }}
                        >
                            Remove cover
                        </button>
                    </div>
                </fieldset>
                <FormError text={error} />
                <div className="dialog-actions">
                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Cancel
                    </button>
                    <button className="button button-primary" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : 'Save to library'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
