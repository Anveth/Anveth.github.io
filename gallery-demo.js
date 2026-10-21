import { IMAGE_ASSETS } from './image-assets.js?v=20261021-1';

// Public showcase only. Never insert these screenshots into a user's account.
const titles = [
    ['witcher3-1.png', 'The Witcher 3: Wild Hunt'], ['witcher3-2.png', 'The Witcher 3: Wild Hunt'],
    ['witcher3-3.png', 'The Witcher 3: Wild Hunt'], ['witcher-4.jpg', 'The Witcher 3: Wild Hunt'],
    ['cyberpunk-1.jpg', 'Cyberpunk 2077'], ['cyberpunk-2.jpg', 'Cyberpunk 2077'],
    ['cyberpunk-3.jpg', 'Cyberpunk 2077'], ['cyberpunk-4.jpg', 'Cyberpunk 2077'],
    ['dishonored-1.jpg', 'Dishonored'], ['dishonored-2.jpg', 'Dishonored'],
    ['got-1.jpg', 'Ghost of Tsushima'], ['got-2.jpg', 'Ghost of Tsushima'],
    ['gow-rag-1.jpg', 'God of War Ragnarök'], ['gow-rag-2.png', 'God of War Ragnarök'],
    ['Sekiro-1.jpg', 'Sekiro: Shadows Die Twice'], ['hogwarts-1.png', 'Hogwarts Legacy'],
    ['elden-1.jpg', 'Elden Ring'], ['lis-1.jpg', 'Life Is Strange']
];
export const DEMO_SCREENSHOTS = titles.map(([file, caption], index) => {
    const asset = IMAGE_ASSETS[`images/slider/${file}`];
    return { id: `demo-${index + 1}`, caption, url: asset.src, thumbnail: asset.sizes[0].src,
        srcset: asset.sizes.filter(size => size.width <= 1280).map(size => `${size.src} ${size.width}w`).join(', ') };
});

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
export function galleryMarkup(photos, { editable = false, ready = true, busy = false } = {}) {
    return photos.map(photo => `<div class="gallery-frame"><a class="gallery-item" data-screenshot-id="${escape(photo.id)}" data-deletable="${editable}" href="${escape(photo.url)}" aria-label="${escape(photo.caption || 'Screenshot')}, view full size"><img src="${escape(photo.thumbnail || photo.url)}" ${photo.srcset ? `srcset="${escape(photo.srcset)}" sizes="(max-width: 650px) calc(100vw - 32px), (min-width: 2560px) 708px, (min-width: 1921px) calc(25vw + 68px), (min-width: 1168px) 552px, calc(50vw - 32px)"` : ''} width="1920" height="1080" alt="${escape(photo.caption || 'Your screenshot')}" loading="lazy" decoding="async" draggable="false"><span>${escape(photo.caption || 'Screenshot')}</span></a>${editable ? `<button class="screenshot-remove" data-delete-screenshot="${escape(photo.id)}" type="button" aria-label="Delete screenshot: ${escape(photo.caption || 'Screenshot')}" ${!ready || busy ? 'disabled' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>` : ''}</div>`).join('')
        + (editable ? Array.from({ length: Math.max(0, 2 - photos.length) }, () => `<button class="gallery-upload" type="button" data-add-screenshot ${!ready || busy ? 'disabled' : ''}><span class="placeholder-plus" aria-hidden="true">+</span><strong>Add your favourite screenshots</strong><span>Keep a moment from your games</span></button>`).join('') : '');
}
