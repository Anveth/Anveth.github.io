import { cp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Only deliberate public assets are published, never the repository or environment files.
const root = resolve(import.meta.dirname, '..');
for (const path of ['images', 'svg', 'favicon.ico']) {
    await cp(resolve(root, path), resolve(root, 'dist', path), { recursive: true });
}
await writeFile(resolve(root, 'dist/.nojekyll'), '');
