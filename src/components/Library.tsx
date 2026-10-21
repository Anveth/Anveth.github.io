import { useEffect, useState } from 'react';
import type { Game, GameStatus, ImportedGame, LibraryFilter } from '../types';
import { errorMessage } from '../types';
import { parseBackup, STATUSES } from '../services/storage';
import { libraryStore, useLibrary } from '../state/library';
import { Cover } from './Cover';
import { Journal } from './Journal';
import { GameDetails } from './GameDetails';
import { GameForm } from './GameForm';
import { FormError, Modal } from './Modal';
import { Gallery } from './Gallery';

function Rating({ game }: { game: Game }) {
    const { busy, games } = useLibrary(),
        [value, setValue] = useState(String(game.rating ?? ''));
    useEffect(() => setValue(String(game.rating ?? '')), [game.rating]);
    return (
        <label className="rating-label">
            Rating
            <span className="rating-value">
                <input
                    className="rating-input"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    inputMode="numeric"
                    value={value}
                    placeholder="—"
                    aria-label={`Rating for ${game.title}`}
                    disabled={busy}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    onBlur={(event) => {
                        if (!event.currentTarget.checkValidity()) {
                            event.currentTarget.reportValidity();
                            return;
                        }
                        const rating = value === '' ? null : Number(value);
                        if (rating === game.rating) return;
                        void libraryStore
                            .updateGames(
                                games.map((item) => (item.id === game.id ? { ...item, rating } : item))
                            )
                            .catch((error) => {
                                setValue(String(game.rating ?? ''));
                                libraryStore.notify(errorMessage(error), true);
                            });
                    }}
                />
                <span>/ 10</span>
            </span>
        </label>
    );
}
function LibraryActions({ add, bottom = false }: { add: () => void; bottom?: boolean }) {
    const { busy, loading } = useLibrary();
    return (
        <div
            className={bottom ? 'library-actions' : 'library-primary-actions'}
            id={bottom ? 'libraryBottomActions' : undefined}
            role="group"
            aria-label="Library actions"
        >
            <button className="button button-primary" onClick={add} disabled={busy || loading}>
                Add a game
            </button>
            <a className="button button-secondary" href="/pick-a-game/">
                Pick from Want to play
            </a>
        </div>
    );
}
export function Library() {
    const { games, user, busy, loading, notice, readError } = useLibrary();
    const [filter, setFilter] = useState<LibraryFilter>('all'),
        [selected, setSelected] = useState<string | null>(null),
        [editing, setEditing] = useState<Game | 'new' | null>(null);
    const [imported, setImported] = useState<ImportedGame[] | null>(null),
        [importError, setImportError] = useState(''),
        [exporting, setExporting] = useState(false);
    const visible = filter === 'all' ? games : games.filter((game) => game.status === filter),
        selectedGame = games.find((game) => game.id === selected);
    useEffect(() => {
        if (loading) return;
        const id = new URLSearchParams(location.search).get('game');
        if (id && games.some((game) => game.id === id)) setSelected(id);
    }, [loading]);
    const add = () => setEditing('new');
    return (
        <>
            <main inert={loading} aria-busy={loading}>
                <section className="library-section page-width" id="library" aria-labelledby="libraryTitle">
                    <div className="section-heading library-heading">
                        <div className="section-title-group">
                            <h1 id="libraryTitle" tabIndex={-1}>
                                Library
                            </h1>
                            <p className="section-caption">Your gaming journal</p>
                        </div>
                        <div className="library-tools">
                            <p className="game-count" aria-live="polite">
                                {visible.length} {visible.length === 1 ? 'game' : 'games'}
                            </p>
                            <button
                                className="text-button"
                                disabled={exporting || busy || loading || Boolean(readError)}
                                onClick={async () => {
                                    setExporting(true);
                                    try {
                                        await libraryStore.exportBackup();
                                    } catch (error) {
                                        libraryStore.notify(errorMessage(error), true);
                                    } finally {
                                        setExporting(false);
                                    }
                                }}
                            >
                                Export
                            </button>
                            <label className="text-button import-label">
                                Import
                                <input
                                    type="file"
                                    accept="application/json,.json"
                                    disabled={busy || loading}
                                    onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = '';
                                        if (!file) return;
                                        try {
                                            setImported(await parseBackup(file));
                                            setImportError('');
                                        } catch (error) {
                                            libraryStore.notify(
                                                `Unable to read this backup: ${errorMessage(error)}`,
                                                true
                                            );
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <div className="filter-bar" aria-label="Filter library">
                            {Object.entries({ all: 'All', ...STATUSES }).map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`filter-button${filter === key ? ' is-selected' : ''}`}
                                    aria-pressed={filter === key}
                                    onClick={() => setFilter(key as LibraryFilter)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <LibraryActions add={add} />
                    </div>
                    {notice?.error && (
                        <p
                            className={`app-message${notice.error ? ' is-error' : ''}`}
                            id="appMessage"
                            role={notice.error ? 'alert' : 'status'}
                        >
                            {notice.text}
                        </p>
                    )}
                    <div className="game-grid" id="gameGrid" aria-live="polite">
                        {visible.map((game, index) => (
                            <article className="game-card" key={game.id}>
                                <button
                                    className="cover-button"
                                    onClick={() => setSelected(game.id)}
                                    aria-label={`Open journal: ${game.title}`}
                                >
                                    <Cover game={game} eager={index < 5} />
                                </button>
                                <div className="game-card-content">
                                    <button className="game-title" onClick={() => setSelected(game.id)}>
                                        {game.title}
                                    </button>
                                    <p className="game-meta">{game.year}</p>
                                    <div className="game-controls">
                                        <div className="status-control">
                                            <select
                                                className="status-select"
                                                value={game.status}
                                                aria-label={`Status for ${game.title}`}
                                                disabled={busy}
                                                onChange={(event) => {
                                                    const status = event.target.value as GameStatus;
                                                    void libraryStore
                                                        .updateGames(
                                                            games.map((item) =>
                                                                item.id === game.id
                                                                    ? { ...item, status }
                                                                    : item
                                                            )
                                                        )
                                                        .catch((error) =>
                                                            libraryStore.notify(errorMessage(error), true)
                                                        );
                                                }}
                                            >
                                                {Object.entries(STATUSES).map(([key, label]) => (
                                                    <option key={key} value={key}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <Rating game={game} />
                                    </div>
                                </div>
                            </article>
                        ))}
                        {!visible.length &&
                            (loading ? (
                                <p className="empty-state" role="status">
                                    Loading library…
                                </p>
                            ) : user && !games.length ? (
                                <button className="first-game-tile" onClick={add}>
                                    <span className="placeholder-plus" aria-hidden="true">
                                        +
                                    </span>
                                    <strong>Add your first game</strong>
                                    <span>Your library starts here</span>
                                </button>
                            ) : (
                                <p className="empty-state">
                                    No games in this list yet. Try another filter or add a game.
                                </p>
                            ))}
                    </div>
                    {visible.length >= 16 && <LibraryActions add={add} bottom />}
                </section>
                <Journal onOpen={setSelected} />
                <Gallery />
            </main>
            {selectedGame && !editing && (
                <GameDetails
                    game={selectedGame}
                    onClose={() => setSelected(null)}
                    onEdit={() => setEditing(selectedGame)}
                />
            )}
            {editing && (
                <GameForm
                    game={editing === 'new' ? undefined : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        if (editing === 'new') setFilter('all');
                    }}
                />
            )}
            {imported && (
                <Modal
                    className="game-dialog"
                    label="importTitle"
                    busy={busy}
                    onClose={() => setImported(null)}
                >
                    <div className="detail-content">
                        <h2 id="importTitle">Restore library?</h2>
                        <p>
                            Games: {imported.length} · Journal entries:{' '}
                            {imported.reduce((sum, item) => sum + item.game.notes.length, 0)}
                        </p>
                        <p>
                            Import replaces your current library. Export it first if you want to keep a
                            backup.
                        </p>
                        <FormError text={importError} />
                        <div className="dialog-actions">
                            <button
                                className="button button-secondary"
                                disabled={busy}
                                onClick={() => setImported(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="button button-primary"
                                disabled={busy}
                                onClick={async () => {
                                    try {
                                        await libraryStore.restore(imported);
                                        setImported(null);
                                        setFilter('all');
                                    } catch (error) {
                                        setImportError(errorMessage(error));
                                    }
                                }}
                            >
                                {busy ? 'Restoring…' : 'Restore library'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
