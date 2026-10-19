import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanPageURL } from '../routes.js';

test('clean page addresses preserve queries, fragments and origin', () => {
    for (const origin of ['https://anveth.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']) {
        for (const [before, after] of [
            ['/index.html', '/'],
            ['/dice.html', '/pick-a-game/'],
            ['/pick-a-game', '/pick-a-game/'],
            ['/pick-a-game/index.html', '/pick-a-game/'],
            ['/pick-a-game/', '/pick-a-game/'],
            ['/unknown.html', '/unknown.html']
        ]) {
            const suffix = '?game=example%20game&code=test-only#type=recovery&test_fragment=kept';
            assert.equal(cleanPageURL(origin + before + suffix).href, origin + after + suffix);
        }
    }
});

test('navigation uses clean paths and nested picker assets resolve from the root', async () => {
    const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const picker = await readFile(new URL('../pick-a-game/index.html', import.meta.url), 'utf8');
    const legacy = await readFile(new URL('../dice.html', import.meta.url), 'utf8');
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    for (const page of [home, picker]) {
        assert.match(page, /href="\/"/);
        assert.match(page, /href="\/#library"/);
        assert.match(page, /href="\/#journal"/);
        assert.match(page, /href="\/pick-a-game\/"/);
        assert.doesNotMatch(page, /href="[^"]*\.html(?:[?#][^"]*)?"/);
    }
    assert.match(picker, /<base href="\/">/);
    assert.match(legacy, /location\.replace\(cleanPageURL\(location\.href\)\.href\)/);
    assert.match(legacy, /<noscript><meta http-equiv="refresh"/);
    assert.match(script, /history\.replaceState\(history\.state, '', pageURL\.href\)/);
    assert.match(script, /href="\/\?game=\$\{encodeURIComponent\(game.id\)\}/);
});

test('auth callback stays at the existing allow-listed index path regardless of the current page', async () => {
    const account = await readFile(new URL('../account.js', import.meta.url), 'utf8');
    assert.match(account, /const redirectTo = new URL\('index.html', import.meta.url\)\.href/);
    for (const origin of ['https://anveth.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']) {
        const callback = new URL('index.html', `${origin}/account.js?v=20261018-3`);
        assert.equal(callback.href, `${origin}/index.html`);
        assert.equal(cleanPageURL(`${callback.href}?code=test-only#type=recovery`).href, `${origin}/?code=test-only#type=recovery`);
    }
});

test('preview server serves clean routes, redirects the missing slash and protects private files', async t => {
    const child = spawn(process.execPath, ['scripts/dev.mjs'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...process.env, GAMELOGS_PORT: '0' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    t.after(async () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    });
    const port = await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('Preview server did not start.')), 5000);
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}. ${errors}`)); });
        child.stdout.on('data', chunk => {
            output += chunk;
            const match = output.match(/http:\/\/localhost:(\d+)/);
            if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        });
    });
    const origin = `http://127.0.0.1:${port}`;
    for (const path of ['/', '/index.html', '/pick-a-game/', '/pick-a-game/index.html', '/dice.html', '/routes.js', '/cover-loader.js', '/images/optimized/covers/Dishonored-640.webp']) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        if (path.endsWith('/pick-a-game/')) assert.match(await response.text(), /id="rollButton"/);
        else await response.arrayBuffer();
    }
    const redirect = await fetch(`${origin}/pick-a-game?source=all`, { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), '/pick-a-game/?source=all');
    const head = await fetch(`${origin}/pick-a-game/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const path of ['/package.json', '/scripts/dev.mjs', '/.git/config', '/pick-a-game/missing.html', '/missing/']) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 404, path);
        await response.text();
    }
});
