// Small journal covers need deliberate resampling: directly shrinking a large,
// detailed cover in CSS can leave jagged edges and moiré around lettering.
export async function journalThumbnail(source: string): Promise<Blob | null> {
    const url = new URL(source, document.baseURI);
    // Do not add CORS requirements or duplicate requests for external cover URLs.
    if (url.origin !== location.origin) return null;
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) return null;

    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(56 * ratio);
    canvas.height = Math.round(84 * ratio);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Match the existing centered object-fit: cover crop before shrinking.
    const width = Math.min(image.naturalWidth, image.naturalHeight * (2 / 3));
    const height = width * (3 / 2);
    context.drawImage(
        image,
        (image.naturalWidth - width) / 2,
        (image.naturalHeight - height) / 2,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height
    );
    // Lossless, temporary browser-only thumbnail; never saved over a user's cover.
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
