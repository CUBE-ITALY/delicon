/**
 * Geometria dello scatto, funzioni pure (testate in tests/photoCrop.test.js).
 *
 * L'anteprima della fotocamera riempie la sua zona come object-fit: cover
 * (scalata e tagliata ai lati): la foto salvata deve essere esattamente ciò
 * che l'operatore vede dentro il riquadro.
 */

/**
 * Rettangolo del fotogramma video che corrisponde al riquadro a schermo.
 *
 * @param {{width: number, height: number}} video  dimensioni del fotogramma (videoWidth/videoHeight)
 * @param {{width: number, height: number}} view   zona in cui il video è mostrato con object-fit: cover
 * @param {{left: number, top: number, width: number, height: number}} frame  riquadro, relativo alla zona
 * @returns {{x: number, y: number, width: number, height: number}} in pixel del video
 */
export function coverSourceRect(video, view, frame) {
    const scale = Math.max(view.width / video.width, view.height / video.height);
    const offsetX = (view.width - video.width * scale) / 2;
    const offsetY = (view.height - video.height * scale) / 2;

    let x = (frame.left - offsetX) / scale;
    let y = (frame.top - offsetY) / scale;
    let width = frame.width / scale;
    let height = frame.height / scale;

    // Il riquadro non può uscire dal fotogramma.
    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.min(width, video.width - x);
    height = Math.min(height, video.height - y);
    return { x, y, width, height };
}

/**
 * Dimensioni finali, ridotte in proporzione se il lato lungo supera maxSide.
 * @returns {{width: number, height: number}} interi
 */
export function fitWithin(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
