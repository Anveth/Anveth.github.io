import { createRoot } from 'react-dom/client';
import { App, AppErrorBoundary } from './App';
import '../style.css';

// Preserve old URLs and every auth query/fragment before initializing Supabase.
const url = new URL(location.href);
if (url.pathname === '/index.html') url.pathname = '/';
if (['/dice.html', '/pick-a-game', '/pick-a-game/index.html'].includes(url.pathname))
    url.pathname = '/pick-a-game/';
if (url.href !== location.href) history.replaceState(history.state, '', url.href);
document.body.dataset.page = url.pathname.startsWith('/pick-a-game') ? 'dice' : 'library';
const root = document.getElementById('root');
if (!root) throw new Error('GameLogs root element is missing.');
createRoot(root).render(
    <AppErrorBoundary>
        <App />
    </AppErrorBoundary>
);
