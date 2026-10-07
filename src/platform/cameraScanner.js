/**
 * Lettura dei codici con la fotocamera (plugin @capacitor-mlkit/barcode-scanning,
 * riconoscimento ML Kit incluso nell'APK: funziona senza rete).
 *
 * La fotocamera viene disegnata DIETRO la WebView: durante la lettura la
 * pagina diventa trasparente (classe "camera-active" su <html>) e resta
 * visibile solo la schermata di lettura, che fa da maschera col mirino.
 *
 * I codici accettati (formato, mirino, ripetizioni: vedi cameraScanFilter.js)
 * vanno alla callback, che li consegna allo stesso flusso dello scanner del
 * palmare. Fuori dall'app nativa la fotocamera non è disponibile.
 */

import { BarcodeScanner, LensFacing } from "@capacitor-mlkit/barcode-scanning";
import { isNative } from "./env.js";
import { cameraScanConfig } from "../config/cameraScan.js";
import { createRepeatFilter, codesInAim } from "./cameraScanFilter.js";

const ACTIVE_CLASS = "camera-active";

let listeners = [];
let repeatFilter = null;

/** @returns {Promise<boolean>} il dispositivo ha una fotocamera utilizzabile */
export async function isCameraScanAvailable() {
    if (!isNative()) {
        return false;
    }
    try {
        const { supported } = await BarcodeScanner.isSupported();
        return supported;
    } catch {
        return false;
    }
}

/**
 * Chiede il permesso della fotocamera se serve.
 * @returns {Promise<boolean>} true se concesso
 */
export async function ensureCameraPermission() {
    const current = await BarcodeScanner.checkPermissions();
    if (current.camera === "granted" || current.camera === "limited") {
        return true;
    }
    const requested = await BarcodeScanner.requestPermissions();
    return requested.camera === "granted" || requested.camera === "limited";
}

/** Apre le impostazioni dell'app (permesso negato in modo permanente). */
export function openAppSettings() {
    return BarcodeScanner.openSettings();
}

/**
 * Avvia la lettura continua.
 * @param {object} handlers
 * @param {(code: string) => void} handlers.onCode   codice accettato
 * @param {(message: string) => void} [handlers.onError]
 * @param {() => (DOMRect|null)} [handlers.getAimRect]  rettangolo del mirino in pixel CSS
 */
export async function startCameraScan({ onCode, onError, getAimRect }) {
    await stopCameraScan();
    repeatFilter = createRepeatFilter(cameraScanConfig.repeatWindowMs);
    document.documentElement.classList.add(ACTIVE_CLASS);

    listeners.push(await BarcodeScanner.addListener("barcodesScanned", (event) => {
        // Il mirino vale solo in verticale: il plugin calcola le coordinate per lo schermo in verticale.
        const portrait = window.innerHeight >= window.innerWidth;
        const codes = codesInAim(event.barcodes, {
            rect: portrait && getAimRect ? getAimRect() : null,
            devicePixelRatio: window.devicePixelRatio,
            tolerance: cameraScanConfig.aimTolerance
        });
        const now = Date.now();
        codes.filter((code) => repeatFilter.accept(code, now)).forEach(onCode);
    }));
    listeners.push(await BarcodeScanner.addListener("scanError", (event) => {
        onError && onError(event.message);
    }));

    try {
        await BarcodeScanner.startScan({
            formats: cameraScanConfig.formats,
            lensFacing: LensFacing.Back
        });
    } catch (err) {
        await stopCameraScan();
        throw err;
    }
}

/** Ferma la lettura e rende di nuovo visibile la pagina. */
export async function stopCameraScan() {
    const active = listeners.length > 0 || document.documentElement.classList.contains(ACTIVE_CLASS);
    const toRemove = listeners;
    listeners = [];
    repeatFilter = null;
    await Promise.all(toRemove.map((l) => l.remove().catch(() => {})));
    if (active) {
        await BarcodeScanner.stopScan().catch(() => {});
    }
    document.documentElement.classList.remove(ACTIVE_CLASS);
}

/** @returns {Promise<boolean>} la fotocamera ha la torcia */
export async function isTorchAvailable() {
    try {
        const { available } = await BarcodeScanner.isTorchAvailable();
        return available;
    } catch {
        return false;
    }
}

/** @returns {Promise<boolean>} stato della torcia dopo il cambio */
export async function toggleTorch() {
    await BarcodeScanner.toggleTorch();
    const { enabled } = await BarcodeScanner.isTorchEnabled();
    return enabled;
}
