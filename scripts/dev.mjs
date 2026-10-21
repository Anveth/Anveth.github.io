import { get } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.GAMELOGS_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid GAMELOGS_PORT.');

function runningProject() {
    return new Promise((resolve) => {
        const request = get(`http://127.0.0.1:${port}/__gamelogs`, (response) => {
            let body = '';
            response.on('data', (chunk) => {
                if (body.length < 4096) body += chunk;
            });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve(null);
                }
            });
        });
        request.setTimeout(1500, () => request.destroy());
        request.on('error', () => resolve(null));
    });
}

const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), server: { port } });
try {
    await server.listen();
    console.log(
        `\n  GameLogs React → http://localhost:${port}/\n  Zmiany odświeżają się automatycznie. Zatrzymanie: Ctrl+C.\n`
    );
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, async () => {
            await server.close();
            process.exit(0);
        });
    }
} catch (error) {
    await server.close();
    if (error.code !== 'EADDRINUSE' && !String(error.message).includes('already in use')) throw error;
    const running = await runningProject();
    if (running?.project === 'gamelogs-react' && running.root === root) {
        console.log(`GameLogs już działa → http://localhost:${port}/`);
    } else {
        console.error(
            `Port ${port} jest zajęty przez inny lub starszy serwer. Zatrzymaj go w jego terminalu (Ctrl+C) i ponów npm run dev. Nie zmieniamy portu, żeby zachować zapis biblioteki.`
        );
        process.exitCode = 1;
    }
}
