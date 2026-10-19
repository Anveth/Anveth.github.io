import { createServer, get } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.GAMELOGS_PORT ?? 5173);
const projectId = 'gamelogs-v2';
const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = createServer(async (request, response) => {
    if (request.url === '/__gamelogs') {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ project: projectId, root }));
        return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
    }

    try {
        const requestURL = new URL(request.url, 'http://localhost');
        const pathname = decodeURIComponent(requestURL.pathname);
        if (pathname === '/pick-a-game') {
            response.writeHead(308, { Location: `/pick-a-game/${requestURL.search}`, 'Cache-Control': 'no-store' });
            response.end();
            return;
        }
        const relative = pathname === '/' ? 'index.html' : pathname === '/pick-a-game/' ? 'pick-a-game/index.html' : pathname.slice(1);
        const path = resolve(root, relative);
        const extension = extname(path).toLowerCase();
        const isPublic = ['index.html', 'dice.html', 'pick-a-game/index.html', 'routes.js', 'cover-loader.js', 'style.css', 'script.js', 'games.js', 'storage.js', 'image-assets.js', 'account.js', 'gallery.js', 'cloud.js', 'config.js', 'favicon.ico'].includes(relative)
            || relative.startsWith('images/') || relative.startsWith('svg/');

        if (!isPublic || !path.startsWith(root + sep) || relative.split('/').some(part => part.startsWith('.')) || !types[extension]) {
            response.writeHead(404);
            response.end('Nie znaleziono pliku.');
            return;
        }

        if (!(await stat(path)).isFile()) throw new Error('Not a file');
        const content = await readFile(path);
        response.writeHead(200, { 'Content-Type': types[extension], 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
        response.writeHead(404);
        response.end('Nie znaleziono pliku.');
    }
});

server.on('error', async error => {
    if (error.code !== 'EADDRINUSE') {
        console.error(error.message);
        process.exitCode = 1;
        return;
    }
    const running = await new Promise(resolve => {
        const request = get(`http://127.0.0.1:${port}/__gamelogs`, response => {
            let body = '';
            response.on('data', chunk => { if (body.length < 4096) body += chunk; });
            response.on('end', () => {
                try { resolve(JSON.parse(body)); } catch { resolve(null); }
            });
        });
        request.setTimeout(1500, () => request.destroy());
        request.on('error', () => resolve(null));
    });
    if (running?.project === projectId && running.root === root) {
        console.log(`\n  GameLogs V2 już działa → http://localhost:${port}\n  Otwórz ten adres; nie musisz uruchamiać drugiego serwera.\n`);
        return;
    }
    console.error(`Port ${port} jest zajęty przez inny lub starszy serwer.\nZatrzymaj go w jego terminalu (Ctrl+C), a następnie ponów npm run dev.\nZachowujemy port ${port}, żeby nie rozdzielać zapisanej biblioteki między adresami.`);
    process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
    console.log(`\n  GameLogs V2 → http://localhost:${server.address().port}\n  Zapisz plik i odśwież stronę. Zatrzymanie: Ctrl+C.\n`);
});
