export function setupGallery({ onDelete } = {}) {
    const track = document.getElementById('galleryTrack');
    if (!track) return;
    const previous = document.getElementById('galleryPrevious');
    const next = document.getElementById('galleryNext');
    const progress = document.getElementById('galleryProgress');
    const counter = document.getElementById('galleryCounter');
    let items = [...track.querySelectorAll('.gallery-item')];
    const frame = item => item.closest('.gallery-frame') || item;
    const left = item => frame(item).offsetLeft;
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
        <div class="lightbox-heading"><div><h2 id="lightboxTitle"></h2><p class="dialog-caption">In-game moments</p></div><button class="close-button" type="button" aria-label="Close image">×</button></div>
        <div class="lightbox-stage" aria-busy="false"><p class="lightbox-message" role="status"></p><img alt="" decoding="async" hidden></div>
        <div class="lightbox-footer"><p class="lightbox-count" aria-live="polite"></p><div class="gallery-controls"><button class="icon-button gallery-arrow lightbox-previous" type="button" aria-label="Previous image">←</button><button class="icon-button gallery-arrow lightbox-next" type="button" aria-label="Next image">→</button></div><button class="text-button danger-text delete-screenshot" type="button" ${onDelete ? '' : 'hidden'}>Delete screenshot</button><p class="lightbox-hint">← → change image · Esc to close</p></div>
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
        if (!items.length) return;
        activePhoto = Math.max(0, Math.min(index, items.length - 1));
        const link = items[activePhoto];
        lightbox.querySelector('.delete-screenshot').hidden = !onDelete || link.dataset.deletable !== 'true';
        const thumbnail = link.querySelector('img');
        lightbox.querySelector('#lightboxTitle').textContent = link.querySelector('span').textContent;
        lightbox.querySelector('.lightbox-count').textContent = `${activePhoto + 1} / ${items.length}`;
        previousPhoto.disabled = activePhoto === 0;
        nextPhoto.disabled = activePhoto === items.length - 1;
        message.textContent = 'Loading image…';
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
        message.textContent = 'Unable to load the image. Check your connection and try again.';
        stage.setAttribute('aria-busy', 'false');
    });
    lightbox.querySelector('.close-button').addEventListener('click', () => lightbox.close());
    lightbox.querySelector('.delete-screenshot').addEventListener('click', () => {
        const id = items[activePhoto]?.dataset.screenshotId;
        lightbox.close();
        if (id) onDelete?.(id);
    });
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
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });

    function update() {
        if (!items.length) {
            previous.disabled = next.disabled = progress.disabled = true;
            progress.value = 0;
            progress.hidden = true;
            counter.textContent = '0 screenshots';
            return;
        }
        progress.hidden = false;
        const max = maximum();
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max - 2;
        progress.disabled = max <= 0;
        progress.value = max ? Math.round(track.scrollLeft / max * 1000) : 0;
        const visible = items.filter(item => left(item) + frame(item).offsetWidth > track.scrollLeft + 2 && left(item) < track.scrollLeft + track.clientWidth - 2);
        const first = items.indexOf(visible[0]) + 1;
        const last = items.indexOf(visible.at(-1)) + 1;
        counter.textContent = `${first || 1}–${last || items.length} / ${items.length}`;
        progress.setAttribute('aria-valuetext', `Screenshots ${first || 1} to ${last || items.length} of ${items.length}`);
    }

    function move(direction) {
        if (!items.length) return;
        const stride = items.length > 1 ? left(items[1]) - left(items[0]) : track.clientWidth;
        const gap = Math.max(0, stride - frame(items[0]).offsetWidth);
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
        if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || event.target.closest('[data-delete-screenshot]')) return;
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
        if (dragged && items.length) {
            const nearest = items.reduce((best, item) => Math.abs(left(item) - track.scrollLeft) < Math.abs(left(best) - track.scrollLeft) ? item : best);
            track.scrollTo({ left: left(nearest), behavior: behavior() });
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
    return {
        refresh() {
            if (lightbox.open) lightbox.close();
            items = [...track.querySelectorAll('.gallery-item')];
            track.scrollTo({ left: 0, behavior: 'instant' });
            update();
        },
        close() { if (lightbox.open) lightbox.close(); }
    };
}
