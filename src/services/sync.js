/**
 * Sincronizzazione degli esiti verso il backend.
 *
 *   - syncDelivery: invio subito dopo la chiusura di una consegna;
 *   - syncPending:  retry di tutte le consegne chiuse rimaste in attesa
 *                   (es. chiuse senza rete in una sessione precedente).
 *
 * Solo la parte dati (eventi → invio → syncStatus): feedback e refresh
 * della UI restano a chi chiama. Il backend deduplica per eventId, quindi
 * ogni reinvio è sicuro.
 */

import * as db from "../data/db.js";
import { backend } from "../backend/index.js";
import { CLOSING_EVENT_TYPES, EventSyncStatus } from "../domain/model.js";
import { byOccurredAt } from "../domain/projection.js";

function _isClosed(events) {
    return events.some((e) => CLOSING_EVENT_TYPES.includes(e.type));
}

/**
 * Invia gli eventi non ancora sincronizzati di una consegna CHIUSA e ne
 * aggiorna lo stato. Una consegna aperta non viene inviata (dataset incompleto).
 *
 * @returns {Promise<{submitted: number, errored: number}>}
 *   submitted = 0 se non c'era niente da inviare.
 *   Rigetta SOLO per errore di rete/temporaneo: gli eventi restano in attesa.
 */
export async function syncDelivery(shipmentId, deliveryId) {
    const events = await db.getEventsByDelivery(shipmentId, deliveryId);
    const unsynced = events
        .filter((e) => e.syncStatus !== EventSyncStatus.SYNCED)
        .sort(byOccurredAt);

    if (unsynced.length === 0 || !_isClosed(events)) {
        return { submitted: 0, errored: 0 };
    }

    const { results } = await backend.submitEvents(shipmentId, unsynced);
    await db.updateEventsSyncStatus(results);
    return {
        submitted: results.length,
        errored:   results.filter((r) => r.status === EventSyncStatus.ERROR).length
    };
}

/**
 * Retry di tutte le consegne chiuse con eventi non sincronizzati, in
 * sequenza. Alla prima caduta di rete il giro si interrompe: inutile
 * insistere senza connettività. Non rigetta mai.
 *
 * @returns {Promise<{candidates: number, synced: number, errored: number, failed: number}>}
 */
export async function syncPending() {
    const acc = { candidates: 0, synced: 0, errored: 0, failed: 0 };

    let unsynced;
    try {
        unsynced = await db.getUnsyncedEvents();
    } catch {
        return acc;
    }

    const groups = new Map();
    unsynced.forEach((e) => {
        const key = e.shipmentId + "\u0000" + e.deliveryId;
        if (!groups.has(key)) {
            groups.set(key, { shipmentId: e.shipmentId, deliveryId: e.deliveryId });
        }
    });

    for (const { shipmentId, deliveryId } of groups.values()) {
        try {
            const events = await db.getEventsByDelivery(shipmentId, deliveryId);
            if (!_isClosed(events)) {
                continue; // consegna ancora aperta: si invierà alla chiusura
            }
            acc.candidates += 1;
            const summary = await syncDelivery(shipmentId, deliveryId);
            if (summary.errored > 0) {
                acc.errored += 1;
            } else {
                acc.synced += 1;
            }
        } catch {
            acc.failed += 1;
            break;
        }
    }
    return acc;
}
