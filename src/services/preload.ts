export function preloadCover(src: string, timeoutMs = 2500): Promise<boolean> {
    if (!src) return Promise.resolve(false);
    return new Promise((resolve) => {
        const image = new Image();
        let done = false;
        const finish = (loaded: boolean) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            resolve(loaded);
        };
        const timeout = setTimeout(() => finish(false), timeoutMs);
        image.decoding = 'async';
        image.onload = () => {
            void image
                .decode()
                .then(() => finish(image.naturalWidth > 0))
                .catch(() => finish(false));
        };
        image.onerror = () => finish(false);
        image.src = src;
    });
}
