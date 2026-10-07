/**
 * Retry automatico degli esiti rimasti in outbox, senza azioni manuali
 * (l'operatore non ha sempre il palmare in mano) e senza ping dedicati:
 * ogni tentativo è esso stesso la verifica di raggiungibilità del backend.
 *
 * Trigger:
 *   1. avvio dell'app;
 *   2. ritorno in primo piano (visibilitychange → visible e, nell'app
 *      nativa, l'evento resume di Capacitor, più affidabile);
 *   3. connessione ritrovata (@capacitor/network);
 *   4. a richiesta, es. dopo un download riuscito (backend certamente raggiungibile).
 *
 * I trigger possono scattare insieme: gira un solo giro alla volta.
 */

import { syncPending } from "./sync.js";
import { onConnectionRestored } from "../platform/network.js";
import { onAppResume } from "../platform/nativeApp.js";

/**
 * @param {object} [options]
 * @param {(result: object) => void} [options.onResult]  Chiamata a fine giro
 *        (es. per un avviso "N consegne sincronizzate" e il refresh della vista).
 */
export function createOutboxFlusher({ onResult } = {}) {
    let inFlight = null;
    let started = false;

    function flush() {
        if (inFlight) {
            return inFlight;
        }
        inFlight = syncPending()
            .then((result) => {
                if (onResult) {
                    onResult(result);
                }
                return result;
            })
            .finally(() => { inFlight = null; });
        return inFlight;
    }

    async function start() {
        if (started) {
            return;
        }
        started = true;
        flush();
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                flush();
            }
        });
        onAppResume(flush);
        try {
            await onConnectionRestored(flush);
        } catch (err) {
            console.warn("Monitoraggio rete non disponibile:", err);
        }
    }

    return { flush, start };
}
