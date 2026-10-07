/**
 * Collega il retry automatico dell'outbox all'interfaccia: avvisa l'operatore
 * quando delle consegne vengono inviate e segnala alle schermate aperte che
 * è il momento di ricaricare lo stato (syncVersion).
 */

import { ref } from "vue";
import { createOutboxFlusher } from "../services/outboxFlusher.js";
import { toast } from "../ui/feedback.js";
import { t } from "../i18n/index.js";

/** Incrementato a ogni giro di invio che ha toccato delle consegne. */
export const syncVersion = ref(0);

const flusher = createOutboxFlusher({
    onResult(result) {
        if (result.candidates > 0) {
            syncVersion.value += 1;
        }
        if (result.synced > 0) {
            toast(result.synced === 1
                ? t("sync.flushedOne")
                : t("sync.flushedMany", { count: result.synced }), "success");
        }
    }
});

export function startOutboxRetry() {
    return flusher.start();
}

/** Tentativo immediato, es. dopo un download riuscito. */
export function flushOutbox() {
    return flusher.flush();
}
