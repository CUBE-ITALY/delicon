/**
 * Stato della connessione del device (Wi-Fi o dati), tramite @capacitor/network:
 * in nativo legge il sistema operativo, in browser usa navigator.onLine e gli
 * eventi online/offline. "Connesso" significa che c'è un collegamento attivo,
 * NON che il backend sia raggiungibile: la raggiungibilità vera la dà solo
 * una richiesta riuscita.
 */

import { Network } from "@capacitor/network";

/** @returns {Promise<boolean>} */
export async function isOnline() {
    try {
        const status = await Network.getStatus();
        return !!(status && status.connected);
    } catch {
        return typeof navigator === "undefined" || navigator.onLine !== false;
    }
}

/**
 * Registra una callback chiamata quando la connessione torna disponibile.
 * @param {() => void} callback
 * @returns {Promise<() => void>} funzione per rimuovere il listener
 */
export async function onConnectionRestored(callback) {
    const handle = await Network.addListener("networkStatusChange", (status) => {
        if (status && status.connected) {
            callback();
        }
    });
    return () => handle.remove();
}
