import { useState, type FormEvent } from 'react';
import type { Game, JournalEntry } from '../types';
import { errorMessage, formatDate, today } from '../types';
import { removeEntry, STATUSES, validDate } from '../services/storage';
import { libraryStore, useLibrary } from '../state/library';
import { Cover } from './Cover';
import { CloseButton, FormError, Modal } from './Modal';

export function GameDetails({
    game,
    onClose,
    onEdit
}: {
    game: Game;
    onClose: () => void;
    onEdit: () => void;
}) {
    const { games, busy } = useLibrary();
    const [error, setError] = useState(''),
        [deletion, setDeletion] = useState<JournalEntry | 'game' | null>(null),
        [deleteError, setDeleteError] = useState('');
    async function addNote(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget,
            fields = new FormData(form),
            date = fields.get('date'),
            text = String(fields.get('text') || '').trim();
        if (!validDate(date) || !text) {
            setError('Enter a valid session date and note.');
            return;
        }
        const minutes = fields.get('minutes') ? Number(fields.get('minutes')) : null;
        const note: JournalEntry = {
            id: crypto.randomUUID(),
            text: text.slice(0, 5000),
            date,
            minutes,
            createdAt: new Date().toISOString()
        };
        try {
            await libraryStore.updateGames(
                games.map((item) => (item.id === game.id ? { ...item, notes: [note, ...item.notes] } : item))
            );
            form.reset();
            setError('');
        } catch (error) {
            setError(errorMessage(error));
        }
    }
    async function confirmDelete() {
        try {
            if (deletion === 'game') {
                await libraryStore.deleteGame(game.id);
                onClose();
            } else if (deletion) await libraryStore.updateGames(removeEntry(games, game.id, deletion.id));
            setDeletion(null);
        } catch (error) {
            setDeleteError(errorMessage(error));
        }
    }
    return (
        <>
            <Modal className="game-dialog detail-dialog" label="detailTitle" busy={busy} onClose={onClose}>
                <div className="detail-content">
                    <div className="dialog-heading detail-toolbar">
                        <p className="dialog-caption">Your journal</p>
                        <CloseButton label="Close journal" onClick={onClose} disabled={busy} />
                    </div>
                    <div className="detail-header">
                        <Cover game={game} className="detail-cover" eager />
                        <div>
                            <h2 id="detailTitle">{game.title}</h2>
                            <p className="game-meta">{game.year}</p>
                            <p className="detail-status">
                                {STATUSES[game.status]}
                                {game.rating ? ` · Rating ${game.rating}/10` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="detail-actions">
                        <button className="text-button" type="button" disabled={busy} onClick={onEdit}>
                            Edit game and cover
                        </button>
                        <button
                            className="text-button danger-text"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setDeleteError('');
                                setDeletion('game');
                            }}
                        >
                            Delete game
                        </button>
                    </div>
                    <form className="note-form" onSubmit={addNote}>
                        <h3>New entry</h3>
                        <label htmlFor="noteText">What will you remember from this session?</label>
                        <textarea
                            id="noteText"
                            name="text"
                            rows={4}
                            maxLength={5000}
                            required
                            disabled={busy}
                            placeholder="Impressions, progress, a favourite moment…"
                        />
                        <div className="note-fields">
                            <label>
                                Session date
                                <input
                                    name="date"
                                    type="date"
                                    defaultValue={today()}
                                    required
                                    disabled={busy}
                                />
                            </label>
                            <label>
                                Play time (min, optional)
                                <input
                                    name="minutes"
                                    type="number"
                                    min={1}
                                    max={1440}
                                    step={1}
                                    placeholder="e.g. 60"
                                    disabled={busy}
                                />
                            </label>
                        </div>
                        <FormError text={error} />
                        <button className="button button-primary" disabled={busy}>
                            {busy ? 'Saving…' : 'Save entry'}
                        </button>
                    </form>
                    <section className="note-history" aria-labelledby="notesTitle">
                        <h3 id="notesTitle" tabIndex={-1}>
                            Session history
                        </h3>
                        <div aria-live="polite">
                            {[...game.notes]
                                .sort(
                                    (a, b) =>
                                        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
                                )
                                .map((note) => (
                                    <article className="session-note" key={note.id}>
                                        <div className="session-heading">
                                            <p className="journal-meta">
                                                {formatDate(note.date)}
                                                {note.minutes ? ` · ${note.minutes} min` : ''}
                                            </p>
                                            <button
                                                className="text-button danger-text"
                                                type="button"
                                                disabled={busy}
                                                aria-label={`Delete entry from ${formatDate(note.date)}`}
                                                onClick={() => {
                                                    setDeleteError('');
                                                    setDeletion(note);
                                                }}
                                            >
                                                Delete entry
                                            </button>
                                        </div>
                                        <p className="note-text">{note.text}</p>
                                    </article>
                                ))}
                            {!game.notes.length && (
                                <p className="journal-meta">No entries yet. Start with your first session.</p>
                            )}
                        </div>
                    </section>
                </div>
            </Modal>
            {deletion && (
                <Modal
                    className="game-dialog confirm-dialog"
                    label="deleteTitle"
                    description="deleteDescription"
                    busy={busy}
                    onClose={() => setDeletion(null)}
                >
                    <div className="detail-content">
                        <h2 id="deleteTitle">
                            {deletion === 'game' ? `Delete “${game.title}”?` : 'Delete this entry?'}
                        </h2>
                        <p className="dialog-caption">Library management</p>
                        <p id="deleteDescription">
                            {deletion === 'game'
                                ? `This will remove the game and its journal (${game.notes.length} entries). This cannot be undone. Export your library first if you want a backup.`
                                : `This will permanently remove this entry from “${game.title}”. The game and its other entries will stay.`}
                        </p>
                        {deletion !== 'game' && (
                            <blockquote className="delete-preview">{deletion.text}</blockquote>
                        )}
                        <FormError text={deleteError} />
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
                                onClick={() => void confirmDelete()}
                            >
                                {deletion === 'game' ? 'Delete game' : 'Delete entry'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
