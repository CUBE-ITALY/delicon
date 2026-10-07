/**
 * Projection — riduce la sequenza di eventi dell'outbox nello stato di lavoro
 * di una consegna. Funzioni pure: nessuno stato viene mai scritto su
 * IndexedDB, lo stato derivato si ricostruisce sempre dagli eventi.
 *
 * Regole:
 *   - per ogni collo vale l'ultimo evento in ordine cronologico:
 *     PACKAGE_SCANNED → scaricato, PACKAGE_SCAN_CANCELLED → da scaricare,
 *     PACKAGE_REJECTED → rifiutato (con motivi);
 *   - DELIVERY_REJECTED (rifiuto totale) è terminale e domina sui colli;
 *   - DELIVERY_CONFIRMED / DELIVERY_REJECTED chiudono la consegna.
 */

import { EventType, DeliveryStatus, SyncState, EventSyncStatus } from "./model.js";

/**
 * @typedef {object} PackageState
 * @property {string}   packageId
 * @property {string}   [barcode]
 * @property {string}   lineId
 * @property {string}   articleCode
 * @property {string}   description
 * @property {boolean}  scanned
 * @property {boolean}  rejected
 * @property {string[]} rejectReasons   Codici motivo se rifiutato, altrimenti [].
 * @property {number}   photoCount      Foto del collo (PACKAGE_PHOTO_TAKEN non eliminate).
 */

/**
 * @typedef {object} DeliveryState
 * @property {string}         shipmentId
 * @property {string}         deliveryId
 * @property {number|null}    sequence
 * @property {string}         deliveryNumber
 * @property {string}         deliveryNoteNumber
 * @property {import("./model.js").Address} consignee
 * @property {PackageState[]} packages
 * @property {number}         scannedCount
 * @property {number}         rejectedCount
 * @property {number}         expectedCount
 * @property {number}         photoCount     Foto dei colli della consegna.
 * @property {boolean}        isConfirmable  Ogni collo scaricato o rifiutato, almeno uno scaricato.
 * @property {boolean}        isClosed       Confermata OPPURE rifiutata: niente più lavoro.
 * @property {boolean}        isConfirmed    Evento DELIVERY_CONFIRMED presente.
 * @property {boolean}        isRejected     Rifiuto totale.
 * @property {boolean}        isSigned
 * @property {boolean}        hasExceptions  Colli rifiutati o rifiuto totale.
 * @property {string[]}       rejectReasons  Motivi del rifiuto totale.
 * @property {{signerRole: string}[]} signatures
 * @property {string}         status         Vedi DeliveryStatus.
 * @property {string}         syncState      Vedi SyncState.
 */

/** Ordinamento cronologico per occurredAt (ISO 8601: confronto lessicografico). */
export function byOccurredAt(a, b) {
    const ta = a.occurredAt || "";
    const tb = b.occurredAt || "";
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
}

/**
 * Stato di lavoro di una singola consegna.
 *
 * @param {import("./model.js").Delivery}  delivery
 * @param {import("./model.js").Package[]} packages  Colli della consegna.
 * @param {import("./model.js").OutboxEvent[]} events  Eventi della consegna.
 * @returns {DeliveryState}
 */
export function buildDeliveryState(delivery, packages, events) {
    // 1. Stato finale per collo: vince l'ultimo evento.
    const sorted        = events.slice().sort(byOccurredAt);
    const packageStatus = new Map();   // packageId → "scanned" | "cancelled" | "rejected"
    const packageReasons = new Map();  // packageId → codici motivo dell'ultimo rifiuto
    const packagePhotos = new Map();   // packageId → numero di foto (scattate e non eliminate)
    const removedPhotos = new Set(sorted
        .filter((e) => e.type === EventType.PACKAGE_PHOTO_REMOVED)
        .map((e) => e.photoEventId));

    for (const event of sorted) {
        if (!event.packageId) {
            continue;
        }
        if (event.type === EventType.PACKAGE_SCANNED) {
            packageStatus.set(event.packageId, "scanned");
        } else if (event.type === EventType.PACKAGE_SCAN_CANCELLED) {
            packageStatus.set(event.packageId, "cancelled");
        } else if (event.type === EventType.PACKAGE_REJECTED) {
            packageStatus.set(event.packageId, "rejected");
            packageReasons.set(event.packageId, event.reasons || []);
        } else if (event.type === EventType.PACKAGE_PHOTO_TAKEN && !removedPhotos.has(event.eventId)) {
            // La foto documenta il collo e non ne cambia lo stato.
            packagePhotos.set(event.packageId, (packagePhotos.get(event.packageId) || 0) + 1);
        }
    }

    // 2. Stato di ogni collo.
    const packageStates = packages.map((pkg) => {
        const st = packageStatus.get(pkg.packageId) || "none";
        return {
            packageId:     pkg.packageId,
            barcode:       pkg.barcode,
            lineId:        pkg.lineId,
            articleCode:   pkg.articleCode,
            description:   pkg.description,
            scanned:       st === "scanned",
            rejected:      st === "rejected",
            rejectReasons: st === "rejected" ? (packageReasons.get(pkg.packageId) || []) : [],
            photoCount:    packagePhotos.get(pkg.packageId) || 0
        };
    });

    // 3. Contatori.
    const scannedCount  = packageStates.filter((p) => p.scanned).length;
    const rejectedCount = packageStates.filter((p) => p.rejected).length;
    const photoCount    = packageStates.reduce((n, p) => n + p.photoCount, 0);
    const expectedCount = delivery.expectedPackageCount;
    const isConfirmable = expectedCount > 0 &&
                          scannedCount > 0 &&
                          (scannedCount + rejectedCount) === expectedCount;

    // 4. Flag dagli eventi di consegna.
    const signEvents  = events.filter((e) => e.type === EventType.DELIVERY_SIGNED);
    const isRejected  = events.some((e) => e.type === EventType.DELIVERY_REJECTED);
    const isConfirmed = events.some((e) => e.type === EventType.DELIVERY_CONFIRMED);
    const isClosed    = isRejected || isConfirmed;
    const isSigned    = signEvents.length > 0;
    const hasExceptions = isRejected || rejectedCount > 0;

    const rejectReasons = events
        .filter((e) => e.type === EventType.DELIVERY_REJECTED)
        .flatMap((e) => e.reasons || []);
    const signatures = signEvents
        .slice().sort(byOccurredAt)
        .map((e) => ({ signerRole: e.signerRole }));

    return {
        shipmentId:         delivery.shipmentId,
        deliveryId:         delivery.deliveryId,
        sequence:           delivery.sequence ?? null,
        deliveryNumber:     delivery.deliveryNumber,
        deliveryNoteNumber: delivery.deliveryNoteNumber,
        consignee:          delivery.consignee,
        packages:           packageStates,
        scannedCount,
        rejectedCount,
        expectedCount,
        photoCount,
        isConfirmable,
        isClosed,
        isConfirmed,
        isRejected,
        isSigned,
        hasExceptions,
        rejectReasons,
        signatures,
        status:    _deriveStatus({ scannedCount, rejectedCount, isClosed, isRejected, signEvents }),
        syncState: _deriveSyncState(events, isClosed)
    };
}

/**
 * Stato di tutte le consegne di un trasporto, in ordine di scarico.
 *
 * @param {import("./model.js").Delivery[]}    deliveries
 * @param {import("./model.js").Package[]}     packages  Tutti i colli del trasporto.
 * @param {import("./model.js").OutboxEvent[]} events    Tutti gli eventi del trasporto.
 * @returns {DeliveryState[]}
 */
export function buildShipmentState(deliveries, packages, events) {
    return deliveries
        .map((delivery) => buildDeliveryState(
            delivery,
            packages.filter((p) => p.deliveryId === delivery.deliveryId),
            events.filter((e) => e.deliveryId === delivery.deliveryId)
        ))
        .sort(bySequence);
}

/**
 * Riepilogo di avanzamento del trasporto. "Chiusa" = confermata o rifiutata.
 * @param {DeliveryState[]} states
 */
export function buildShipmentSummary(states) {
    return {
        deliveriesClosed: states.filter((s) => s.isClosed).length,
        deliveriesTotal:  states.length,
        packagesScanned:  states.reduce((n, s) => n + s.scannedCount, 0),
        packagesExpected: states.reduce((n, s) => n + s.expectedCount, 0)
    };
}

/**
 * Collo corrispondente al codice letto dallo scanner: confronta l'etichetta
 * (barcode) se il collo ne ha una, altrimenti packageId.
 *
 * @param {string} code
 * @param {Array<{packageId: string, barcode?: string}>} packages
 * @returns {object|null}
 */
export function findPackageByCode(code, packages) {
    const value = (code || "").trim();
    if (!value) {
        return null;
    }
    return packages.find((p) => (p.barcode || p.packageId) === value) || null;
}

// --- Funzioni private ---

/**
 * Ordine di scarico numerico; consegne senza sequenza in fondo, poi per
 * deliveryId con confronto "naturale" (2 prima di 10).
 */
function bySequence(a, b) {
    const sa = a.sequence;
    const sb = b.sequence;
    if (sa !== sb) {
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sa - sb;
    }
    return String(a.deliveryId).localeCompare(String(b.deliveryId), undefined, { numeric: true });
}

function _deriveStatus({ scannedCount, rejectedCount, isClosed, isRejected, signEvents }) {
    // Rifiuto totale: terminale e dominante, ignora i colli.
    if (isRejected) {
        return DeliveryStatus.REJECTED;
    }
    // Consegnata con almeno un collo rifiutato.
    if (isClosed && rejectedCount > 0) {
        return DeliveryStatus.CONFIRMED_WITH_EXCEPTIONS;
    }
    if (signEvents.length > 0) {
        return signEvents.every((e) => e.syncStatus === EventSyncStatus.SYNCED)
            ? DeliveryStatus.SYNCED
            : DeliveryStatus.PENDING_SYNC;
    }
    if (isClosed) {
        return DeliveryStatus.CONFIRMED;
    }
    if (scannedCount > 0 || rejectedCount > 0) {
        return DeliveryStatus.IN_PROGRESS;
    }
    return DeliveryStatus.NOT_STARTED;
}

/**
 * Stato di invio della consegna, separato da DeliveryStatus così è visibile
 * anche per le consegne rifiutate o con eccezioni. Le consegne aperte non
 * vengono inviate (dataset incompleto): per loro vale NONE.
 */
function _deriveSyncState(events, isClosed) {
    if (!isClosed) {
        return SyncState.NONE;
    }
    if (events.some((e) => e.syncStatus === EventSyncStatus.ERROR)) {
        return SyncState.ERROR;
    }
    if (events.some((e) => e.syncStatus !== EventSyncStatus.SYNCED)) {
        return SyncState.PENDING;
    }
    return SyncState.SYNCED;
}
