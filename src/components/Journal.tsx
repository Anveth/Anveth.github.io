import { useState } from 'react';
import { formatDate } from '../types';
import { STATUSES } from '../services/storage';
import { useLibrary } from '../state/library';
import { Cover } from './Cover';

export function Journal({ onOpen }: { onOpen: (id: string) => void }) {
    const { games } = useLibrary(),
        [visible, setVisible] = useState(4);
    const entries = games
        .flatMap((game) => game.notes.map((note) => ({ game, note })))
        .sort(
            (a, b) =>
                b.note.date.localeCompare(a.note.date) || b.note.createdAt.localeCompare(a.note.createdAt)
        );
    const recent = entries.slice(0, visible),
        remaining = entries.length - recent.length;
    return (
        <section className="journal-section page-width" id="journal" aria-labelledby="journalTitle">
            <div className="section-heading journal-heading">
                <div className="section-title-group">
                    <h2 id="journalTitle">Journal</h2>
                    <p className="section-caption">Your stories</p>
                </div>
                <p className="journal-count" role="status">
                    {entries.length
                        ? `${recent.length} of ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
                        : 'No entries yet'}
                </p>
            </div>
            <div id="recentNotes" className="recent-notes">
                {recent.length ? (
                    recent.map(({ game, note }) => (
                        <article className="journal-entry" key={`${game.id}:${note.id}`}>
                            <div className="journal-entry-date">
                                <time dateTime={note.date}>{formatDate(note.date)}</time>
                                {note.minutes ? <span>{note.minutes} min</span> : null}
                            </div>
                            <div className="journal-entry-header">
                                <button
                                    className="journal-cover-button"
                                    type="button"
                                    onClick={() => onOpen(game.id)}
                                    aria-label={`Open journal: ${game.title}`}
                                >
                                    <Cover game={game} className="journal-cover" />
                                </button>
                                <div className="journal-entry-body">
                                    <button
                                        className="journal-game text-button"
                                        type="button"
                                        onClick={() => onOpen(game.id)}
                                    >
                                        {game.title}
                                    </button>
                                    <p className="entry-status">{STATUSES[game.status]}</p>
                                </div>
                            </div>
                            <p className="note-text">{note.text}</p>
                        </article>
                    ))
                ) : (
                    <div className="journal-empty">
                        <h3>Every game has a story.</h3>
                        <p>Select a game cover or title to write about your first session.</p>
                    </div>
                )}
            </div>
            {remaining > 0 && (
                <div className="journal-pagination">
                    <button
                        className="button button-secondary"
                        aria-controls="recentNotes"
                        onClick={() => setVisible((count) => count + 4)}
                    >
                        Show more ({Math.min(4, remaining)})
                    </button>
                </div>
            )}
        </section>
    );
}
