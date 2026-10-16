export function setupGallery() {
    const track = document.getElementById('galleryTrack');
    if (!track) return;
    const previous = document.getElementById('galleryPrevious');
    const next = document.getElementById('galleryNext');
    const progress = document.getElementById('galleryProgress');
    const counter = document.getElementById('galleryCounter');
    const items = [...track.children];
    if (!items.length) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const behavior = () => reducedMotion.matches ? 'instant' : 'smooth';
    const maximum = () => Math.max(0, track.scrollWidth - track.clientWidth);
    let drag = null;
    let dragged = false;
    const lightbox = document.createElement('dialog');
    lightbox.id = 'galleryLightbox';
    lightbox.className = 'gallery-lightbox';
    lightbox.setAttribute('aria-labelledby', 'lightboxTitle');
    lightbox.innerHTML = `<div class="lightbox-shell">
        <div class="lightbox-heading"><div><p class="eyebrow">Kadry z gier</p><h2 id="lightboxTitle"></h2></div><button class="close-button" type="button" aria-label="Zamknij powiększenie">×</button></div>
        <div class="lightbox-stage" aria-busy="false"><p class="lightbox-message" role="status"></p><img alt="" decoding="async" hidden></div>
        <div class="lightbox-footer"><p class="lightbox-count" aria-live="polite"></p><div class="gallery-controls"><button class="icon-button gallery-arrow lightbox-previous" type="button" aria-label="Poprzednie zdjęcie">←</button><button class="icon-button gallery-arrow lightbox-next" type="button" aria-label="Następne zdjęcie">→</button></div><p class="lightbox-hint">← → zmiana zdjęcia · Esc zamyka</p></div>
    </div>`;
    document.body.append(lightbox);
    const fullImage = lightbox.querySelector('img');
    const stage = lightbox.querySelector('.lightbox-stage');
    const message = lightbox.querySelector('.lightbox-message');
    const previousPhoto = lightbox.querySelector('.lightbox-previous');
    const nextPhoto = lightbox.querySelector('.lightbox-next');
    let activePhoto = 0;
    let returnFocus = null;
    let savedOverflow = '';

    function showPhoto(index) {
        activePhoto = Math.max(0, Math.min(index, items.length - 1));
        const link = items[activePhoto];
        const thumbnail = link.querySelector('img');
        lightbox.querySelector('#lightboxTitle').textContent = link.querySelector('span').textContent;
        lightbox.querySelector('.lightbox-count').textContent = `${activePhoto + 1} / ${items.length}`;
        previousPhoto.disabled = activePhoto === 0;
        nextPhoto.disabled = activePhoto === items.length - 1;
        message.textContent = 'Ładowanie zdjęcia…';
        message.hidden = false;
        fullImage.hidden = true;
        stage.setAttribute('aria-busy', 'true');
        fullImage.alt = thumbnail.alt;
        fullImage.src = link.href;
    }
    fullImage.addEventListener('load', () => {
        fullImage.hidden = false;
        message.hidden = true;
        stage.setAttribute('aria-busy', 'false');
    });
    fullImage.addEventListener('error', () => {
        message.hidden = false;
        message.textContent = 'Nie udało się wczytać zdjęcia. Sprawdź połączenie i spróbuj ponownie.';
        stage.setAttribute('aria-busy', 'false');
    });
    lightbox.querySelector('.close-button').addEventListener('click', () => lightbox.close());
    previousPhoto.addEventListener('click', () => showPhoto(activePhoto - 1));
    nextPhoto.addEventListener('click', () => showPhoto(activePhoto + 1));
    lightbox.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        showPhoto(event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : activePhoto + (event.key === 'ArrowLeft' ? -1 : 1));
    });
    lightbox.addEventListener('click', event => {
        if (event.target !== lightbox) return;
        const bounds = lightbox.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) lightbox.close();
    });
    lightbox.addEventListener('close', () => {
        document.body.style.overflow = savedOverflow;
        fullImage.removeAttribute('src');
        fullImage.hidden = true;
        returnFocus?.focus({ preventScroll: true });
    });

    function update() {
        const max = maximum();
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max - 2;
        progress.disabled = max <= 0;
        progress.value = max ? Math.round(track.scrollLeft / max * 1000) : 0;
        const visible = items.filter(item => item.offsetLeft + item.offsetWidth > track.scrollLeft + 2 && item.offsetLeft < track.scrollLeft + track.clientWidth - 2);
        const first = items.indexOf(visible[0]) + 1;
        const last = items.indexOf(visible.at(-1)) + 1;
        counter.textContent = `${first || 1}–${last || items.length} / ${items.length}`;
        progress.setAttribute('aria-valuetext', `Kadry ${first || 1} do ${last || items.length} z ${items.length}`);
    }

    function move(direction) {
        const stride = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth;
        const gap = Math.max(0, stride - items[0].offsetWidth);
        const count = Math.max(1, Math.floor((track.clientWidth + gap + 1) / stride));
        track.scrollBy({ left: direction * stride * count, behavior: behavior() });
    }

    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', update, { passive: true });
    progress.addEventListener('input', () => {
        track.scrollTo({ left: maximum() * Number(progress.value) / 1000, behavior: 'instant' });
    });
    track.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home' || event.key === 'End') track.scrollTo({ left: event.key === 'Home' ? 0 : maximum(), behavior: behavior() });
        else move(event.key === 'ArrowLeft' ? -1 : 1);
    });
    track.addEventListener('dragstart', event => event.preventDefault());
    track.addEventListener('pointerdown', event => {
        // Touch keeps native scrolling and vertical page gestures.
        if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
        drag = { pointer: event.pointerId, x: event.clientX, scroll: track.scrollLeft };
        dragged = false;
    });
    track.addEventListener('pointermove', event => {
        if (!drag || drag.pointer !== event.pointerId) return;
        const distance = event.clientX - drag.x;
        if (!dragged && Math.abs(distance) < 6) return;
        if (!dragged) {
            dragged = true;
            track.classList.add('is-dragging');
            track.setPointerCapture(event.pointerId);
            track.scrollTo({ left: drag.scroll, behavior: 'instant' });
        }
        event.preventDefault();
        track.scrollLeft = drag.scroll - distance;
    });
    function endDrag(event) {
        if (!drag || drag.pointer !== event.pointerId) return;
        const pointer = drag.pointer;
        drag = null;
        track.classList.remove('is-dragging');
        if (track.hasPointerCapture(pointer)) track.releasePointerCapture(pointer);
        if (dragged) {
            const nearest = items.reduce((best, item) => Math.abs(item.offsetLeft - track.scrollLeft) < Math.abs(best.offsetLeft - track.scrollLeft) ? item : best);
            track.scrollTo({ left: nearest.offsetLeft, behavior: behavior() });
        }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('lostpointercapture', endDrag);
    track.addEventListener('pointerleave', event => { if (drag && !dragged) endDrag(event); });
    track.addEventListener('click', event => {
        const link = event.target.closest('.gallery-item');
        if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (dragged) { event.stopPropagation(); dragged = false; return; }
        returnFocus = link;
        savedOverflow = document.body.style.overflow;
        showPhoto(items.indexOf(link));
        lightbox.showModal();
        document.body.style.overflow = 'hidden';
    }, true);
    new ResizeObserver(update).observe(track);
    update();
}
