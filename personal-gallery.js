import { setupGallery } from './gallery.js?v=20261019-4';
import { DEMO_SCREENSHOTS, galleryMarkup } from './gallery-demo.js?v=20261019-1';
import { createCloudGalleryStore } from './screenshots.js?v=20261019-1';
import { prepareCover, validateCoverFile } from './storage.js?v=20261019-2';

export function setupPersonalGallery() {
    const el = id => document.getElementById(id);
    const track = el('galleryTrack');
    if (!track) return null;
    let scope = 0, store, photos = [], ready = false, busy = false, remote = false, deleteId = null, preview = '';
    const urls = new Set();
    const upload = document.createElement('dialog');
    upload.id = 'screenshotDialog';
    upload.className = 'game-dialog';
    upload.setAttribute('aria-labelledby', 'screenshotTitle');
    upload.innerHTML = `<form id="screenshotForm" class="game-form"><div class="dialog-heading"><div><h2 id="screenshotTitle">Add a screenshot</h2><p class="dialog-caption">Your favourite moments</p></div><button type="button" class="close-button" data-close-shot aria-label="Close screenshot form">×</button></div><div class="form-grid"><label class="form-wide">Screenshot (JPG, PNG or WebP, max. 10 MB)<input id="screenshotFile" type="file" accept="image/jpeg,image/png,image/webp" required></label><label class="form-wide">Game or caption (optional)<input id="screenshotCaption" maxlength="100" placeholder="A moment worth keeping"></label></div><div class="screenshot-preview" id="screenshotPreview" hidden><img alt="Screenshot preview"></div><p class="form-hint">Images are resized to 1920 px and saved as WebP, up to 1 MB. Up to 100 screenshots in this gallery. Screenshots are separate from your game library.</p><p class="form-error" id="screenshotError" role="alert" hidden></p><div class="dialog-actions"><button class="button button-secondary" data-close-shot type="button">Cancel</button><button class="button button-primary" id="saveScreenshot" type="submit">Save screenshot</button></div></form>`;
    const deletion = document.createElement('dialog');
    deletion.id = 'deleteScreenshotDialog';
    deletion.className = 'game-dialog confirm-dialog';
    deletion.setAttribute('aria-labelledby', 'deleteScreenshotTitle');
    deletion.innerHTML = `<h2 id="deleteScreenshotTitle">Delete screenshot?</h2><p id="deleteScreenshotCaption" class="dialog-caption"></p><p>This permanently removes the screenshot from this gallery. Your games and journal entries will stay.</p><p class="form-error" id="deleteScreenshotError" role="alert" hidden></p><div class="dialog-actions"><button class="button button-secondary" id="cancelScreenshotDelete" type="button">Cancel</button><button class="button button-danger" id="confirmScreenshotDelete" type="button">Delete screenshot</button></div>`;
    document.body.append(upload, deletion);
    function openDeletion(id) {
        if (!remote || !ready || busy || !photos.some(photo => photo.id === id)) return;
        deleteId = id;
        el('deleteScreenshotCaption').textContent = photos.find(photo => photo.id === id)?.caption || 'Screenshot';
        el('deleteScreenshotError').hidden = true;
        deletion.showModal();
        el('cancelScreenshotDelete').focus();
    }
    const carousel = setupGallery({ onDelete: openDeletion });

    function message(text = '', error = false) {
        el('galleryMessage').textContent = text;
        el('galleryMessage').hidden = !text;
        el('galleryMessage').classList.toggle('is-error', error);
    }
    function render() {
        track.innerHTML = galleryMarkup(photos, { editable: remote, ready, busy });
        el('addScreenshot').hidden = !remote;
        el('addScreenshot').disabled = !ready || busy || photos.length >= 100;
        carousel.refresh();
    }
    async function load(epoch, currentStore) {
        const next = await currentStore.list();
        if (epoch !== scope) return;
        const nextPhotos = next.map(photo => {
            if (!photo.blob) return photo;
            const url = URL.createObjectURL(photo.blob);
            urls.add(url);
            return { ...photo, url };
        });
        // Close any old lightbox before revoking the previous scope's object URLs.
        carousel.close();
        for (const photo of photos) if (urls.has(photo.url)) { URL.revokeObjectURL(photo.url); urls.delete(photo.url); }
        photos = nextPhotos;
        ready = true;
        expires = Date.now() + 50 * 60 * 1000;
        render();
    }
    function openUpload() {
        if (!remote || !ready || busy) return;
        if (photos.length >= 100) { message('This gallery has 100 screenshots. Remove one before adding another.', true); return; }
        el('screenshotForm').reset();
        el('screenshotError').hidden = true;
        el('screenshotPreview').hidden = true;
        upload.showModal();
    }
    el('addScreenshot').addEventListener('click', openUpload);
    track.addEventListener('click', event => {
        const remove = event.target.closest('[data-delete-screenshot]');
        if (remove) openDeletion(remove.dataset.deleteScreenshot);
        else if (event.target.closest('[data-add-screenshot]')) openUpload();
    });
    upload.querySelectorAll('[data-close-shot]').forEach(button => button.addEventListener('click', () => { if (!busy) upload.close(); }));
    upload.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    upload.addEventListener('close', () => { if (preview) URL.revokeObjectURL(preview); preview = ''; });
    el('screenshotFile').addEventListener('change', event => {
        if (preview) URL.revokeObjectURL(preview);
        preview = '';
        el('screenshotPreview').hidden = true;
        el('screenshotError').hidden = true;
        const file = event.target.files[0];
        if (!file) return;
        try {
            validateCoverFile(file);
            preview = URL.createObjectURL(file);
            el('screenshotPreview').querySelector('img').src = preview;
            el('screenshotPreview').hidden = false;
        } catch (error) { event.target.value = ''; el('screenshotError').textContent = error.message; el('screenshotError').hidden = false; }
    });
    el('screenshotForm').addEventListener('submit', async event => {
        event.preventDefault();
        if (!remote || !ready || busy) return;
        const epoch = scope, currentStore = store;
        const file = el('screenshotFile').files[0];
        const record = { id: crypto.randomUUID(), caption: el('screenshotCaption').value.trim() };
        busy = true;
        el('saveScreenshot').disabled = true;
        el('screenshotError').hidden = true;
        let saved = false;
        try {
            const blob = await prepareCover(file, { maxDimension: 1920, maxBytes: 1048576, targetBytes: 650 * 1024 });
            if (epoch !== scope) return;
            await currentStore.add(record, blob);
            saved = true;
            if (epoch !== scope) return;
            upload.close();
            await load(epoch, currentStore);
            if (epoch === scope) message('Screenshot saved.');
        } catch (error) {
            if (epoch !== scope) return;
            if (saved) message(`Screenshot saved, but the gallery could not refresh. ${error.message}`, true);
            else { el('screenshotError').textContent = error.message; el('screenshotError').hidden = false; }
        } finally {
            if (epoch === scope) { busy = false; el('saveScreenshot').disabled = false; render(); }
        }
    });
    el('cancelScreenshotDelete').addEventListener('click', () => { if (!busy) deletion.close(); });
    deletion.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    el('confirmScreenshotDelete').addEventListener('click', async () => {
        if (!remote || !ready || busy || !deleteId) return;
        const epoch = scope, currentStore = store, id = deleteId;
        busy = true;
        el('confirmScreenshotDelete').disabled = true;
        try {
            const warning = await currentStore.remove(id);
            if (epoch !== scope) return;
            deletion.close();
            // Remove the tile immediately, even if refreshing later fails.
            const removed = photos.find(photo => photo.id === id);
            if (removed && urls.has(removed.url)) { URL.revokeObjectURL(removed.url); urls.delete(removed.url); }
            photos = photos.filter(photo => photo.id !== id);
            await load(epoch, currentStore);
            if (epoch === scope) message(warning || 'Screenshot deleted.', Boolean(warning));
        } catch (error) {
            if (epoch === scope) {
                el('deleteScreenshotError').textContent = error.message;
                el('deleteScreenshotError').hidden = false;
                if (!deletion.open) message(`Unable to refresh the gallery. ${error.message}`, true);
            }
        } finally {
            if (epoch === scope) { busy = false; el('confirmScreenshotDelete').disabled = false; render(); }
        }
    });
    async function refreshCurrent() {
        if (!remote || busy) return;
        const epoch = scope;
        try { await load(epoch, store); if (epoch === scope) message(); }
        catch (error) { if (epoch === scope) message(error.message, true); }
    }
    let expires = 0;
    const renew = () => { if (remote && !busy && Date.now() > expires) refreshCurrent(); };
    window.addEventListener('focus', renew);
    setInterval(renew, 5 * 60 * 1000);
    return {
        async setScope(client, userId, connectionError) {
            const epoch = ++scope;
            busy = ready = false;
            carousel.close();
            upload.close(); deletion.close();
            for (const url of urls) URL.revokeObjectURL(url);
            urls.clear(); photos = []; deleteId = null;
            el('saveScreenshot').disabled = el('confirmScreenshotDelete').disabled = false;
            remote = Boolean(userId);
            store = userId ? createCloudGalleryStore(client, userId) : null;
            if (!remote) { photos = [...DEMO_SCREENSHOTS]; ready = true; render(); message(); return; }
            render(); message('Loading screenshots…');
            try {
                if (connectionError) throw connectionError;
                await load(epoch, store);
                if (epoch === scope) { expires = Date.now() + 50 * 60 * 1000; message(); }
            } catch (error) { if (epoch === scope) message(`Unable to load screenshots. ${error.message} Reload the page to retry.`, true); }
        }
    };
}
