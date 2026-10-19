// Warm the browser cache and decode the cover before revealing a pick.
export function preloadCover(src, { timeoutMs = 2500, ImageClass = globalThis.Image } = {}) {
    if (!src) return Promise.resolve(false);
    return new Promise(resolve => {
        const image = new ImageClass();
        const finish = loaded => {
            clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            resolve(loaded);
        };
        const timeout = setTimeout(() => finish(false), timeoutMs);
        image.decoding = 'async';
        image.onload = async () => {
            try {
                if (image.decode) await image.decode();
                finish(image.naturalWidth > 0);
            } catch { finish(false); }
        };
        image.onerror = () => finish(false);
        image.src = src;
    });
}
