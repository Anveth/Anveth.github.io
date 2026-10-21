import { useEffect, useRef, useState } from 'react';
import type { Game, LibraryFilter } from '../types';
import { errorMessage } from '../types';
import { STATUSES, originalImage } from '../services/storage';
import { preloadCover } from '../services/preload';
import { libraryStore, useLibrary } from '../state/library';
import { Cover } from './Cover';

const PIPS = [
    [21, 21, '2 3 4 5 6'],
    [43, 21, '4 5 6'],
    [21, 32, '6'],
    [32, 32, '1 3 5'],
    [43, 32, '6'],
    [21, 43, '4 5 6'],
    [43, 43, '2 3 4 5 6']
] as const;
export function Dice() {
    const { games, loading, readError, busy } = useLibrary();
    const [source, setSource] = useState<LibraryFilter>('backlog'),
        [rolling, setRolling] = useState(false),
        [value, setValue] = useState(5),
        [message, setMessage] = useState('Ready when you are.');
    const [result, setResult] = useState<{ game: Game; ready: boolean } | null>(null),
        alive = useRef(true);
    useEffect(
        () => () => {
            alive.current = false;
        },
        []
    );
    async function roll() {
        if (rolling || loading || busy) return;
        if (readError) {
            setMessage(readError);
            return;
        }
        const candidates = source === 'all' ? games : games.filter((game) => game.status === source);
        if (!candidates.length) {
            setResult(null);
            setMessage('No games in this list. Add a game or choose another list.');
            return;
        }
        const game = candidates[Math.floor(Math.random() * candidates.length)],
            epoch = libraryStore.scope();
        setRolling(true);
        setMessage('Rolling…');
        try {
            let deadline: ReturnType<typeof setTimeout> | undefined;
            const prepare = (async () => {
                const image = game.imageKey
                    ? await libraryStore.ensureCover(game)
                    : originalImage(game.image);
                return preloadCover(image);
            })().catch(() => false);
            const bounded = Promise.race([
                prepare,
                new Promise<boolean>((resolve) => {
                    deadline = setTimeout(() => resolve(false), 2500);
                })
            ]).finally(() => clearTimeout(deadline));
            const [ready] = await Promise.all([
                bounded,
                new Promise<void>((resolve) => setTimeout(resolve, 550))
            ]);
            if (!alive.current) return;
            libraryStore.assertScope(epoch);
            setValue(1 + Math.floor(Math.random() * 6));
            setResult({ game, ready });
            setMessage(`Today’s pick: ${game.title}`);
        } catch (error) {
            if (alive.current) setMessage(errorMessage(error));
        } finally {
            if (alive.current) setRolling(false);
        }
    }
    return (
        <main className="dice-page page-width" inert={loading} aria-busy={loading}>
            <section className="dice-intro" aria-labelledby="diceTitle">
                <h1 id="diceTitle">Not sure what to play?</h1>
                <p>
                    <span className="copy-lead">Your next adventure.</span> The dice will pick a game from
                    your library. Choose a list and let chance decide.
                </p>
            </section>
            <section className="dice-panel" aria-label="Random game picker">
                <div className="dice-controls">
                    <div
                        className={`dice-face${rolling ? ' is-rolling' : ''}`}
                        id="diceFace"
                        data-value={value}
                        aria-hidden="true"
                    >
                        <svg
                            className="dice-symbol"
                            viewBox="0 0 64 64"
                            width="64"
                            height="64"
                            focusable="false"
                        >
                            <rect
                                x="8"
                                y="8"
                                width="48"
                                height="48"
                                rx="6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                            {PIPS.map(([x, y, values]) => (
                                <circle
                                    key={`${x}-${y}`}
                                    className="dice-pip"
                                    cx={x}
                                    cy={y}
                                    r="3.5"
                                    data-values={values}
                                />
                            ))}
                        </svg>
                    </div>
                    <label className="dice-source">
                        Pick from
                        <select
                            id="diceSource"
                            value={source}
                            disabled={rolling}
                            onChange={(event) => setSource(event.target.value as LibraryFilter)}
                        >
                            <option value="backlog">Want to play</option>
                            <option value="all">Entire library</option>
                            <option value="playing">Currently playing</option>
                        </select>
                    </label>
                    <button
                        className="button button-primary dice-button"
                        id="rollButton"
                        disabled={rolling || loading || busy}
                        onClick={() => void roll()}
                    >
                        Roll the dice
                    </button>
                    <p className="dice-message" aria-live="polite">
                        {message}
                    </p>
                </div>
                <div className="dice-result-area">
                    {result ? (
                        <article className="random-result" id="randomResult" aria-labelledby="resultTitle">
                            <Cover
                                game={result.game}
                                className="result-cover"
                                eager
                                showImage={result.ready}
                            />
                            <div className="result-content">
                                <h2 className="result-title" id="resultTitle">
                                    {result.game.title}
                                </h2>
                                <p className="result-meta">
                                    <span className="result-context">Today’s pick</span>
                                    {result.game.year ? ` · ${result.game.year}` : ''}
                                </p>
                                <p className="result-status">{STATUSES[result.game.status]}</p>
                                <a
                                    className="text-button result-journal-link"
                                    href={`/?game=${encodeURIComponent(result.game.id)}`}
                                >
                                    Open journal ↗
                                </a>
                            </div>
                        </article>
                    ) : (
                        <div className="dice-empty">
                            <h2>One roll, a new story.</h2>
                            <p>
                                <span className="copy-lead">Your next game.</span> Choose a list and roll to
                                reveal your next game.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
