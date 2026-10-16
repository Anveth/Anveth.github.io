export function setupGallery() {
    const track = document.getElementById('galleryTrack');
    if (!track) return;
    const previous = document.getElementById('galleryPrevious');
    const next = document.getElementById('galleryNext');
    const progress = document.getElementById('galleryProgress');
    const counter = document.getElementById('galleryCounter');
    const items = [...track.children];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const behavior = () => reducedMotion.matches ? 'instant' : 'smooth';
    const maximum = () => Math.max(0, track.scrollWidth - track.clientWidth);
    let drag = null;
    let dragged = false;

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
        const count = Math.max(1, Math.floor((track.clientWidth + 2) / stride));
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
        if (!dragged) return;
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
    }, true);
    new ResizeObserver(update).observe(track);
    update();
}
