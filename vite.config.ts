import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
    base: '/',
    publicDir: false,
    plugins: [
        react(),
        {
            name: 'gamelogs-clean-paths',
            configureServer(server) {
                server.middlewares.use((request, response, next) => {
                    const url = new URL(request.url || '/', 'http://localhost');
                    if (url.pathname === '/__gamelogs') {
                        response.setHeader('Content-Type', 'application/json');
                        response.end(
                            JSON.stringify({ project: 'gamelogs-react', root: import.meta.dirname })
                        );
                    } else if (url.pathname === '/pick-a-game') {
                        response.writeHead(308, { Location: `/pick-a-game/${url.search}` });
                        response.end();
                    } else next();
                });
            }
        }
    ],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: {
        rollupOptions: {
            input: {
                library: resolve(import.meta.dirname, 'index.html'),
                picker: resolve(import.meta.dirname, 'pick-a-game/index.html'),
                legacyPicker: resolve(import.meta.dirname, 'dice.html')
            }
        }
    }
});
