import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const themes = [css.match(/:root\s*\{([^}]+)\}/)[1], css.match(/body\.theme-light\s*\{([^}]+)\}/)[1]];
const color = (theme, name) => theme.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})`, 'i'))[1];
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const luminance = hex => rgb(hex).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test('rearranged captions retain purple and green accents with readable contrast in both themes', () => {
    for (const selector of ['copy-lead', 'section-caption', 'dialog-caption', 'result-context']) {
        assert.match(css, new RegExp(`\\.${selector} \\{[^}]*color: var\\(--accent\\)`));
    }
    assert.match(css, /\.hero \.section-caption,\s*\.journal-section \.section-caption \{ color: var\(--journal-accent\); \}/);
    for (const theme of themes) {
        for (const accent of ['accent', 'journal-accent']) {
            for (const background of ['background', 'surface']) {
                assert.ok(contrast(color(theme, accent), color(theme, background)) >= 4.5);
            }
        }
    }
});

test('captions remain in descriptions or beside headings instead of uppercase eyebrows', async () => {
    for (const file of ['index.html', 'pick-a-game/index.html', 'script.js', 'gallery.js', 'account.js']) {
        const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /class="eyebrow"/, file);
        if (file.endsWith('.html')) assert.doesNotMatch(source, /account-status|id="accountStatus"/, file);
    }
    const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    for (const id of ['heroTitle', 'libraryTitle', 'journalTitle', 'galleryTitle']) {
        assert.match(home, new RegExp(`<h[12] id="${id}"`));
    }
    assert.match(home, /class="dialog-heading detail-toolbar"/);
    assert.match(css, /\.detail-toolbar \{ justify-content: space-between; \}/);
    for (const caption of ['Your gaming journal', 'My collection', 'Your stories', 'In-game moments', 'Your library', 'Your journal', 'Library management']) {
        assert.ok(home.includes(caption), caption);
    }
    assert.match(home, /<h2 id="libraryTitle"[^>]*>Library<\/h2><p class="section-caption">My collection<\/p>/);
    assert.match(home, /class="section-caption">Your gaming journal<\/p>/);
    assert.match(css, /\.section-title-group \{[^}]*align-items: baseline/);
    assert.doesNotMatch(css, /\.section-caption \{[^}]*(?:text-transform: uppercase|letter-spacing)/);
});

test('save status lives inside the account dialog and is bound after it exists', async () => {
    const account = await readFile(new URL('../account.js', import.meta.url), 'utf8');
    const markup = account.slice(account.indexOf('dialog.innerHTML'), account.indexOf('document.body.append(dialog)'));
    assert.match(markup, /id="accountStatus" role="status"/);
    assert.ok(account.indexOf("const status = el('accountStatus')") > account.indexOf('document.body.append(dialog)'));
    assert.match(account, /status.textContent = 'Unable to connect to accounts/);
});

test('library count and transfer controls have larger scoped typography and spacing', () => {
    assert.match(css, /\.library-tools \{[^}]*gap: 10px 20px/);
    assert.match(css, /\.library-tools \.game-count,\s*\.library-tools \.text-button \{ font-size: clamp\(16px, 1vw, 18px\); \}/);
});

test('library controls stack transfer tools above actions and intro typography is smaller', async () => {
    const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(home, /class="hero-actions"/);
    assert.match(css, /\.library-heading \{[^}]*grid-template-areas: "title tools" "filters actions"; align-items: center/);
    assert.match(css, /\.library-heading > \.filter-bar \{[^}]*grid-area: filters;[^}]*margin: 0/);
    assert.match(css, /\.library-heading > \.library-primary-actions \{ grid-area: actions/);
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.library-heading \{[^}]*grid-template-areas: "title" "tools" "actions" "filters"/);
    assert.match(css, /\.hero h1 \{[^}]*font-size: clamp\(32px, 4vw, 46px\)/);
    assert.match(css, /\.journal-section \{[^}]*padding-block: 48px 104px/);
    assert.match(css, /\.gallery-hint \{ margin: 18px 0 36px/);
    assert.match(css, /\.gallery-track \{ grid-auto-columns: 100%; \}/);
    assert.match(home, /id="galleryTrack"/);
});

test('library rows and covers have more breathing room without changing their alignment', () => {
    assert.match(css, /\.library-heading \{[^}]*align-items: center; gap: 40px 24px; margin-bottom: 40px/);
    assert.match(css, /\.library-heading \{ gap: 24px; margin-bottom: 32px; \}/);
});

test('hero uses a short caption beside the title with no trailing periods or long description', async () => {
    const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(home, /class="section-title-group"><h1 id="heroTitle">Games worth coming back to<\/h1><p class="section-caption">Your gaming journal<\/p>/);
    assert.doesNotMatch(home, /Save games for later|keep memories of every session|library-description/);
    assert.doesNotMatch(css, /\.library-description/);
});

test('green journal text stays readable in both themes and purple remains the main accent', () => {
    for (const theme of themes) {
        const journal = color(theme, 'journal-accent');
        const [red, green, blue] = rgb(journal);
        assert.ok(green > red && green > blue);
        assert.ok(contrast(journal, color(theme, 'background')) >= 4.5);
        assert.ok(contrast(journal, color(theme, 'surface')) >= 4.5);
        const [, primaryGreen, primaryBlue] = rgb(color(theme, 'accent'));
        assert.ok(primaryBlue > primaryGreen);
    }
    assert.match(css, /\.diary-link\s*\{[^}]*color: var\(--journal-accent\)/);
    assert.match(css, /\.brand span\s*\{[^}]*color: var\(--accent\)/);
});

test('green hover and keyboard focus target unselected library filters only', () => {
    for (const state of ['hover', 'focus-visible']) {
        const selector = `.filter-bar .filter-button:not(.is-selected):${state}`;
        const rule = css.slice(css.indexOf(selector)).split('}')[0];
        assert.ok(css.includes(selector));
        assert.match(rule, /color: var\(--journal-accent\)/);
        assert.match(rule, /border-color: var\(--journal-accent\)/);
    }
    assert.match(css, /\.filter-bar \.filter-button\s*\{[^}]*transition: color 150ms/);
    assert.match(css, /\.filter-button\.is-selected\s*\{[^}]*border-color: var\(--accent\); background: var\(--accent-soft\)/);
    assert.doesNotMatch(css, /\.filter-button:hover\s*\{[^}]*journal-accent/);
});

test('status focus uses green borders without recoloring the field or other forms', () => {
    const rule = css.match(/\.status-select:focus\s*\{([^}]+)\}/)[1];
    assert.match(rule, /border-color: var\(--journal-accent\)/);
    assert.match(rule, /outline-color: var\(--journal-accent\)/);
    assert.doesNotMatch(`{${rule}`, /[;{]\s*(?:background(?:-color)?|color)\s*:/);
    assert.match(css, /:focus-visible\s*\{ outline: 3px solid var\(--accent\)/);
});

test('the larger green dice has no tinted tile and retains its purple roll button and animation', () => {
    const rule = css.match(/\.dice-face\s*\{([^}]+)\}/)[1];
    assert.match(rule, /background: transparent/);
    assert.match(rule, /color: var\(--journal-accent\)/);
    assert.match(css, /\.dice-controls\s*\{ --dice-size: clamp\(200px, 18vw, 240px\)/);
    assert.match(css, /\.dice-symbol\s*\{[^}]*width: 90%; height: 90%/);
    assert.match(css, /\.dice-controls\s*\{ --dice-size: 160px/);
    assert.match(css, /\.dice-face\.is-rolling\s*\{ animation: dice-roll 550ms ease-in-out/);
    assert.match(css, /\.button-primary\s*\{[^}]*background: var\(--accent\)/);
});

test('the original dice roll is preserved and only changed pips crossfade at the end', async () => {
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    assert.match(css, /@keyframes dice-roll \{ 0% \{ transform: rotate\(0deg\) scale\(1\); \} 45% \{ transform: rotate\(220deg\) scale\(\.78\); \} 100% \{ transform: rotate\(360deg\) scale\(1\); \} \}/);
    assert.doesNotMatch(css, /dice-pulse/);
    assert.match(css, /\.dice-pip \{[^}]*transition: opacity 120ms ease-in-out/);
    assert.match(script, /\}, 550\);/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: \.01ms !important/);
});

test('picker button follows the visible dice width and supporting text is more readable', () => {
    assert.match(css, /\.dice-controls \.dice-button\s*\{[^}]*width: calc\(var\(--dice-size\) \* \.72\)/);
    assert.match(css, /\.dice-controls \.dice-button\s*\{[^}]*font-size: 18px; letter-spacing: \.02em/);
    for (const selector of ['dice-source', 'dice-message']) {
        assert.match(css, new RegExp(`\\.${selector}\\s*\\{[^}]*font-size: 16px`));
    }
});

test('footer wordmark and tagline use separate accents and spacing without a dot', async () => {
    const footer = '<footer class="site-footer"><p><span class="footer-brand">Game<span class="footer-brand-accent">Logs</span></span><span class="footer-tagline">Your <span class="footer-gaming">gaming</span> journal</span></p></footer>';
    for (const file of ['index.html', 'pick-a-game/index.html']) {
        const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.ok(html.includes(footer), file);
    }
    assert.match(css, /\.site-footer p \{[^}]*flex-wrap: wrap; gap: 8px 24px/);
    assert.match(css, /\.footer-brand-accent \{ color: var\(--accent\); \}/);
    assert.match(css, /\.footer-gaming \{ color: var\(--journal-accent\); \}/);
});

test('the footer stays at the bottom of short pages without covering long content', () => {
    const body = css.match(/\bbody\s*\{([^}]+)\}/)[1];
    const footer = css.match(/\.site-footer\s*\{([^}]+)\}/)[1];
    assert.match(body, /display: flex/);
    assert.match(body, /flex-direction: column/);
    assert.match(body, /min-height: 100dvh/);
    assert.match(footer, /margin-top: auto/);
    assert.doesNotMatch(footer, /position:\s*(fixed|absolute)/);
});

test('game picker dedicates space to a large accessible result and stacks on smaller screens', async () => {
    const html = await readFile(new URL('../pick-a-game/index.html', import.meta.url), 'utf8');
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    assert.match(html, /class="dice-controls"/);
    assert.match(html, /class="dice-result-area"/);
    assert.match(html, /id="randomResult" aria-labelledby="resultTitle" hidden/);
    assert.match(css, /\.dice-intro h1\s*\{[^}]*white-space: nowrap/);
    assert.match(css, /\.dice-panel\s*\{[^}]*grid-template-columns: minmax\(220px, \.7fr\) minmax\(0, 1\.3fr\)/);
    assert.match(css, /\.dice-panel\s*\{ grid-template-columns: 1fr/);
    assert.match(css, /\.random-result:not\(\[hidden\]\) \+ \.dice-empty\s*\{ display: none/);
    assert.match(css, /\.dice-empty h2\s*\{[^}]*font-size: clamp\(38px, 3\.5vw, 56px\)/);
    assert.match(css, /\.dice-empty > p:last-child\s*\{[^}]*max-width: 510px;[^}]*font-size: 18px/);
    assert.match(script, /<h2 class="result-title" id="resultTitle">\$\{escapeHtml\(game.title\)\}/);
    assert.match(script, /gameCover\(game, 'result-cover', true, coverLoaded\)/);
});

test('all six SVG dice faces have the right pip count and symmetric geometry', async () => {
    const html = await readFile(new URL('../pick-a-game/index.html', import.meta.url), 'utf8');
    assert.match(html, /class="dice-symbol" viewBox="0 0 64 64"/);
    const dots = [...html.matchAll(/<circle\b([^>]+)>/g)].map(([, attrs]) => ({
        x: Number(attrs.match(/cx="(\d+)"/)[1]),
        y: Number(attrs.match(/cy="(\d+)"/)[1]),
        values: attrs.match(/data-values="([^"]+)"/)[1].split(' ')
    }));
    for (let value = 1; value <= 6; value++) {
        const visible = dots.filter(dot => dot.values.includes(String(value)));
        assert.equal(visible.length, value);
        assert.equal(visible.reduce((sum, dot) => sum + dot.x, 0) / value, 32);
        assert.equal(visible.reduce((sum, dot) => sum + dot.y, 0) / value, 32);
        assert.ok(css.includes(`.dice-face[data-value="${value}"] [data-values~="${value}"]`));
    }
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    assert.match(script, /byId\('diceFace'\)\.dataset\.value/);
});

test('rolling hides the welcome text or previous pick without collapsing the result area', async () => {
    const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
    assert.match(css, /\.dice-panel:has\(\.dice-face\.is-rolling\) \.dice-result-area \{ visibility: hidden; \}/);
    const picker = script.slice(script.indexOf('function setupDicePage()'), script.indexOf('\nsetupTheme();'));
    assert.doesNotMatch(picker.slice(0, picker.indexOf('if (!games.length)')), /byId\('randomResult'\)\.hidden = true/);
    assert.match(picker, /if \(!games.length\) \{\s*byId\('randomResult'\)\.hidden = true/);
});
