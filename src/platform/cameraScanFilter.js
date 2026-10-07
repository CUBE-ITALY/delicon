/**
 * Filtri sulle letture della fotocamera, funzioni pure (testate in
 * tests/cameraScanFilter.test.js).
 *
 * La fotocamera rileva lo stesso codice decine di volte al secondo e vede
 * tutti i codici nell'inquadratura: qui si decide quali letture diventano
 * davvero un "collo letto".
 */

/**
 * Filtro delle ripetizioni a finestra scorrevole: un codice viene accettato
 * la prima volta e poi di nuovo solo dopo essere rimasto fuori vista per
 * almeno windowMs. Finché resta inquadrato non riscatta.
 *
 * @param {number} windowMs
 * @returns {{ accept: (code: string, now: number) => boolean, reset: () => void }}
 */
export function createRepeatFilter(windowMs) {
    const lastSeen = new Map();
    return {
        accept(code, now) {
            const last = lastSeen.get(code);
            lastSeen.set(code, now);
            return last === undefined || now - last > windowMs;
        },
        reset() {
            lastSeen.clear();
        }
    };
}

/**
 * Centro del codice in pixel CSS. Il plugin fornisce i quattro angoli in
 * pixel fisici dello schermo.
 *
 * @param {Array<[number, number]>|undefined} cornerPoints
 * @param {number} devicePixelRatio
 * @returns {{x: number, y: number}|null} null se gli angoli mancano
 */
export function barcodeCenter(cornerPoints, devicePixelRatio) {
    if (!Array.isArray(cornerPoints) || cornerPoints.length === 0) {
        return null;
    }
    const ratio = devicePixelRatio || 1;
    const sum = cornerPoints.reduce((acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }), { x: 0, y: 0 });
    return { x: sum.x / cornerPoints.length / ratio, y: sum.y / cornerPoints.length / ratio };
}

/**
 * Il punto cade nel rettangolo del mirino, allargato di `tolerance`
 * (frazione di larghezza e altezza) per lato?
 *
 * @param {{x: number, y: number}} point
 * @param {{left: number, top: number, width: number, height: number}} rect
 * @param {number} tolerance
 */
export function isInsideAim(point, rect, tolerance) {
    const dx = rect.width * tolerance;
    const dy = rect.height * tolerance;
    return point.x >= rect.left - dx &&
           point.x <= rect.left + rect.width + dx &&
           point.y >= rect.top - dy &&
           point.y <= rect.top + rect.height + dy;
}

/**
 * Sceglie, tra i codici rilevati in un fotogramma, quelli da considerare:
 * con un valore, e col centro nel mirino. Senza mirino (rect null) o senza
 * angoli si accetta: meglio un codice estraneo, che l'app scarta comunque,
 * di una lettura persa.
 *
 * @param {Array<{rawValue?: string, displayValue?: string, cornerPoints?: Array<[number, number]>}>} barcodes
 * @param {{rect: object|null, devicePixelRatio: number, tolerance: number}} aim
 * @returns {string[]} valori letti
 */
export function codesInAim(barcodes, aim) {
    const codes = [];
    (barcodes || []).forEach((b) => {
        const value = ((b && (b.rawValue || b.displayValue)) || "").trim();
        if (!value) {
            return;
        }
        const center = aim.rect ? barcodeCenter(b.cornerPoints, aim.devicePixelRatio) : null;
        if (center && !isInsideAim(center, aim.rect, aim.tolerance)) {
            return;
        }
        codes.push(value);
    });
    return codes;
}
