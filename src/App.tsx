import { Component, useEffect, useState, type ReactNode } from 'react';
import { libraryStore, useLibrary } from './state/library';
import { Library } from './components/Library';
import { Dice } from './components/Dice';
import { Account } from './components/Account';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        if (this.state.failed)
            return (
                <main className="page-width library-section">
                    <h1>Unable to open GameLogs</h1>
                    <p>Your saved data has not been cleared. Refresh the page or try again later.</p>
                    <button className="button button-secondary" onClick={() => location.reload()}>
                        Reload page
                    </button>
                </main>
            );
        return this.props.children;
    }
}
function initialTheme(): boolean {
    try {
        return (localStorage.getItem('gamelogs:theme') || localStorage.getItem('colorMode')) === 'light';
    } catch {
        return false;
    }
}
export function App() {
    const { user, recovery, loading } = useLibrary(),
        [accountOpen, setAccountOpen] = useState(false),
        [light, setLight] = useState(initialTheme);
    const picker = location.pathname.startsWith('/pick-a-game');
    useEffect(() => {
        void libraryStore.start();
    }, []);
    useEffect(() => {
        if (recovery) setAccountOpen(true);
    }, [recovery]);
    useEffect(() => {
        document.body.classList.toggle('theme-light', light);
        try {
            localStorage.setItem('gamelogs:theme', light ? 'light' : 'dark');
        } catch {
            /* Appearance still works when persistence is unavailable. */
        }
    }, [light]);
    useEffect(() => {
        if (loading) return;
        const aliases: Record<string, string> = { '#biblioteka': '#library', '#dziennik': '#journal' };
        const hash = aliases[location.hash] || location.hash;
        if (hash === '#library' || hash === '#journal' || hash === '#gallery') {
            if (hash !== location.hash)
                history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
            document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
        }
    }, [loading]);
    return (
        <>
            <header className="site-header">
                <div className="nav-shell">
                    <a className="brand" href="/" aria-label="GameLogs — home">
                        Game<span>Logs</span>
                    </a>
                    <nav className="primary-nav" aria-label="Main navigation">
                        <a href="/#library">Library</a>
                        <a href="/#journal">Journal</a>
                        <a href="/#gallery">Gallery</a>
                        <a href="/pick-a-game/">Pick a game</a>
                    </nav>
                    <div className="header-actions">
                        <button
                            className="button button-secondary account-button"
                            id="accountButton"
                            onClick={() => setAccountOpen(true)}
                        >
                            {user ? 'My account' : 'Log in'}
                        </button>
                        <button
                            className="icon-button"
                            id="themeToggle"
                            aria-label={`Switch to ${light ? 'dark' : 'light'} theme`}
                            aria-pressed={light}
                            onClick={() => setLight((value) => !value)}
                        >
                            <img src={light ? '/svg/moon.png' : '/svg/sun.png'} alt="" />
                        </button>
                    </div>
                </div>
            </header>
            {picker ? <Dice key={user?.id || 'guest'} /> : <Library key={user?.id || 'guest'} />}
            <footer className="site-footer">
                <p>
                    <span className="footer-brand">
                        Game<span className="footer-brand-accent">Logs</span>
                    </span>
                    <span className="footer-tagline">
                        Your <span className="footer-gaming">gaming</span> journal
                    </span>
                </p>
            </footer>
            {accountOpen && <Account onClose={() => setAccountOpen(false)} />}
        </>
    );
}
