/**
 * Comandi e letture dell'app. Raccoglie la logica di business che nella
 * versione precedente stava nei controller: le schermate (fase 2) chiamano
 * solo queste funzioni e si occupano di presentazione e feedback.
 *
 * Regola: durante il lavoro l'unica scrittura è l'append sull'outbox; lo
 * snapshot del trasporto si scrive solo al download.
 */

import * as db from "../data/db.js";
import { backend } from "../backend/index.js";
import {
    buildDeliveryState, buildShipmentState, buildShipmentSummary,
    findPackageByCode, byOccurredAt
} from "../domain/projection.js";
import { EventType, SignerRole } from "../domain/model.js";
import { WRONG_SCAN_CODE, MISSING_CODE } from "../config/rejectReasons.js";

/** Esiti di una scansione. */
export const ScanOutcome = Object.freeze({
    SCANNED:         "scanned",
    NOT_EXPECTED:    "not_expected",
    ALREADY_SCANNED: "already_scanned",
    CLOSED:          "closed"
});

function _domainError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

// Timestamp strettamente crescenti nella sessione: due eventi accodati nello
// stesso millisecondo (es. conferma + firma) mantengono un ordine certo.
let _lastTs = 0;
function _now() {
    let t = Date.now();
    if (t <= _lastTs) {
        t = _lastTs + 1;
    }
    _lastTs = t;
    return new Date(t).toISOString();
}

function _event(type, shipmentId, deliveryId, extra = {}) {
    return {
        eventId:    crypto.randomUUID(),
        type,
        shipmentId,
        deliveryId,
        occurredAt: _now(),
        ...extra
    };
}

async function _requireDelivery(shipmentId, deliveryId) {
    const state = await loadDelivery(shipmentId, deliveryId);
    if (!state) {
        throw _domainError("DELIVERY_NOT_FOUND", `Consegna ${deliveryId} non trovata`);
    }
    return state;
}

async function _requireOpenDelivery(shipmentId, deliveryId) {
    const state = await _requireDelivery(shipmentId, deliveryId);
    if (state.isClosed) {
        throw _domainError("DELIVERY_CLOSED", `La consegna ${deliveryId} è già chiusa`);
    }
    return state;
}

function _requirePackage(state, packageId) {
    const pkg = state.packages.find((p) => p.packageId === packageId);
    if (!pkg) {
        throw _domainError("PACKAGE_NOT_FOUND", `Collo ${packageId} non presente nella consegna`);
    }
    return pkg;
}

function _requireReasons(reasons) {
    if (!Array.isArray(reasons) || reasons.length === 0) {
        throw _domainError("REASONS_REQUIRED", "Selezionare almeno un motivo");
    }
}

// --- Trasporti ---

/**
 * Scarica un trasporto dal backend e ne sostituisce lo snapshot locale.
 * Gli eventi già registrati sul device sopravvivono al re-download.
 * @returns {Promise<string>} shipmentId salvato
 */
export async function downloadShipment(shipmentId) {
    const id = (shipmentId || "").trim();
    if (!id) {
        throw _domainError("SHIPMENT_ID_REQUIRED", "Inserire il numero del trasporto");
    }
    const data = await backend.downloadShipment(id);
    await db.replaceShipmentSnapshot(data.shipment, data.deliveries, data.packages);
    return data.shipment.shipmentId;
}

/** Trasporti già scaricati sul device, dal più recente. */
export async function listShipments() {
    const shipments = await db.getAllShipments();
    return shipments.sort((a, b) => (a.downloadedAt < b.downloadedAt ? 1 : -1));
}

/**
 * Stato di lavoro di un trasporto (consegne in ordine di scarico + riepilogo).
 * @returns {Promise<{shipment: object, deliveries: object[], summary: object}|null>}
 */
export async function loadShipment(shipmentId) {
    const [shipment, deliveries, packages, events] = await Promise.all([
        db.getShipment(shipmentId),
        db.getDeliveriesByShipment(shipmentId),
        db.getPackagesByShipment(shipmentId),
        db.getEventsByShipment(shipmentId)
    ]);
    if (!shipment) {
        return null;
    }
    const states = buildShipmentState(deliveries, packages, events);
    return { shipment, deliveries: states, summary: buildShipmentSummary(states) };
}

// --- Consegna ---

/** @returns {Promise<import("../domain/projection.js").DeliveryState|null>} */
export async function loadDelivery(shipmentId, deliveryId) {
    const [delivery, packages, events] = await Promise.all([
        db.getDelivery(shipmentId, deliveryId),
        db.getPackagesByDelivery(shipmentId, deliveryId),
        db.getEventsByDelivery(shipmentId, deliveryId)
    ]);
    return delivery ? buildDeliveryState(delivery, packages, events) : null;
}

/**
 * Registra la lettura di un collo. Nessun evento se il codice non appartiene
 * alla consegna o se il collo è già scaricato: la UI decide il feedback.
 *
 * @returns {Promise<{outcome: string, packageId?: string, wasRejected?: boolean}>}
 *   wasRejected = il collo era rifiutato e la lettura lo riporta a scaricato.
 */
export async function scanPackage(shipmentId, deliveryId, code) {
    const state = await _requireDelivery(shipmentId, deliveryId);
    if (state.isClosed) {
        return { outcome: ScanOutcome.CLOSED };
    }
    const pkg = findPackageByCode(code, state.packages);
    if (!pkg) {
        return { outcome: ScanOutcome.NOT_EXPECTED };
    }
    if (pkg.scanned) {
        return { outcome: ScanOutcome.ALREADY_SCANNED, packageId: pkg.packageId };
    }
    await db.appendEvent(_event(EventType.PACKAGE_SCANNED, shipmentId, deliveryId, {
        packageId:   pkg.packageId,
        scannedCode: code.trim()
    }));
    return { outcome: ScanOutcome.SCANNED, packageId: pkg.packageId, wasRejected: pkg.rejected };
}

/** Annulla lo scarico di un collo (torna "da scaricare"). */
export async function cancelScan(shipmentId, deliveryId, packageId) {
    const state = await _requireOpenDelivery(shipmentId, deliveryId);
    _requirePackage(state, packageId);
    await db.appendEvent(_event(EventType.PACKAGE_SCAN_CANCELLED, shipmentId, deliveryId, { packageId }));
}

/**
 * Rifiuto di un singolo collo con i motivi scelti. La voce speciale
 * "scansione errata" vince su tutte e annulla solo lo scarico.
 *
 * @returns {Promise<"rejected"|"cancelled">}
 */
export async function rejectPackage(shipmentId, deliveryId, packageId, reasons) {
    _requireReasons(reasons);
    if (reasons.includes(WRONG_SCAN_CODE)) {
        await cancelScan(shipmentId, deliveryId, packageId);
        return "cancelled";
    }
    const state = await _requireOpenDelivery(shipmentId, deliveryId);
    _requirePackage(state, packageId);
    await db.appendEvent(_event(EventType.PACKAGE_REJECTED, shipmentId, deliveryId, {
        packageId,
        reasons: [...reasons]
    }));
    return "rejected";
}

/**
 * @typedef {object} SignatureInput
 * @property {import("../domain/model.js").SignatureData} signature
 * @property {string} [signerName]  Nome di chi firma, facoltativo.
 */

/**
 * Si può fotografare un collo rifiutato che è sul posto: non uno rifiutato
 * come mancante, che non c'è da fotografare.
 * @param {{rejected: boolean, rejectReasons: string[]}} pkg  stato del collo (Projection)
 */
export function canPhotographPackage(pkg) {
    return Boolean(pkg && pkg.rejected && !(pkg.rejectReasons || []).includes(MISSING_CODE));
}

/**
 * Foto di un collo rifiutato, a documentazione del rifiuto. Come le firme è
 * un evento dell'outbox: resta sul dispositivo, si consulta nella consegna e
 * parte verso il backend con gli altri esiti alla chiusura.
 *
 * @param {import("../domain/model.js").PhotoData} photo
 */
export async function addPackagePhoto(shipmentId, deliveryId, packageId, photo) {
    if (!photo || typeof photo.image !== "string" || !photo.image.startsWith("data:image/")) {
        throw _domainError("INVALID_PHOTO", "Foto non valida");
    }
    const state = await _requireOpenDelivery(shipmentId, deliveryId);
    const pkg = _requirePackage(state, packageId);
    if (!canPhotographPackage(pkg)) {
        throw _domainError("PHOTO_NOT_ALLOWED", `Il collo ${packageId} non è rifiutato: niente foto da allegare`);
    }
    await db.appendEvent(_event(EventType.PACKAGE_PHOTO_TAKEN, shipmentId, deliveryId, {
        packageId,
        photo: { image: photo.image, width: photo.width, height: photo.height }
    }));
}

/**
 * Elimina una foto, solo a consegna aperta. L'outbox resta append-only:
 * l'eliminazione è un evento che annulla la foto (come l'annullo di uno
 * scarico). Una foto eliminata prima della chiusura non viene inviata (sync.js).
 *
 * @param {string} photoEventId  eventId della foto (da getPhotos)
 */
export async function removePackagePhoto(shipmentId, deliveryId, photoEventId) {
    await _requireOpenDelivery(shipmentId, deliveryId);
    const photo = (await getPhotos(shipmentId, deliveryId)).find((p) => p.eventId === photoEventId);
    if (!photo) {
        throw _domainError("PHOTO_NOT_FOUND", "Foto non trovata o già eliminata");
    }
    await db.appendEvent(_event(EventType.PACKAGE_PHOTO_REMOVED, shipmentId, deliveryId, {
        packageId: photo.packageId,
        photoEventId
    }));
}

/** Foto dei colli della consegna (non eliminate), dalla più vecchia. */
export async function getPhotos(shipmentId, deliveryId) {
    const events = await db.getEventsByDelivery(shipmentId, deliveryId);
    const removed = new Set(events
        .filter((e) => e.type === EventType.PACKAGE_PHOTO_REMOVED)
        .map((e) => e.photoEventId));
    return events
        .filter((e) => e.type === EventType.PACKAGE_PHOTO_TAKEN && e.photo && !removed.has(e.eventId))
        .sort(byOccurredAt)
        .map((e) => ({
            eventId:    e.eventId,
            packageId:  e.packageId,
            photo:      e.photo,
            occurredAt: e.occurredAt
        }));
}

function _signedEvent(shipmentId, deliveryId, signerRole, { signature, signerName }) {
    const extra = { signerRole, signature };
    const name = (signerName || "").trim();
    if (name) {
        extra.signerName = name;
    }
    return _event(EventType.DELIVERY_SIGNED, shipmentId, deliveryId, extra);
}

/**
 * Chiude la consegna con la firma del destinatario. Conferma e firma sono
 * scritte nella stessa transazione: o entrambe o nessuna.
 *
 * @param {SignatureInput} consignee
 */
export async function confirmDelivery(shipmentId, deliveryId, consignee) {
    const state = await _requireOpenDelivery(shipmentId, deliveryId);
    if (!state.isConfirmable) {
        throw _domainError("NOT_CONFIRMABLE", "Ci sono ancora colli da scaricare o rifiutare");
    }
    await db.appendEvents([
        _event(EventType.DELIVERY_CONFIRMED, shipmentId, deliveryId),
        _signedEvent(shipmentId, deliveryId, SignerRole.CONSIGNEE, consignee)
    ]);
}

/**
 * Rifiuto totale della consegna con doppia firma (autista + destinatario),
 * alternativo alla conferma. I tre eventi sono scritti in un'unica transazione.
 *
 * @param {string[]} reasons
 * @param {{driver: SignatureInput, consignee: SignatureInput}} signatures
 */
export async function rejectDelivery(shipmentId, deliveryId, reasons, { driver, consignee }) {
    _requireReasons(reasons);
    if (reasons.includes(WRONG_SCAN_CODE)) {
        throw _domainError("INVALID_REASON", "Motivo non valido per il rifiuto della consegna");
    }
    await _requireOpenDelivery(shipmentId, deliveryId);
    await db.appendEvents([
        _event(EventType.DELIVERY_REJECTED, shipmentId, deliveryId, { reasons: [...reasons] }),
        _signedEvent(shipmentId, deliveryId, SignerRole.DRIVER, driver),
        _signedEvent(shipmentId, deliveryId, SignerRole.CONSIGNEE, consignee)
    ]);
}

/** Firme acquisite per la consegna, in ordine cronologico. */
export async function getSignatures(shipmentId, deliveryId) {
    const events = await db.getEventsByDelivery(shipmentId, deliveryId);
    return events
        .filter((e) => e.type === EventType.DELIVERY_SIGNED && e.signature)
        .sort(byOccurredAt)
        .map((e) => ({
            signerRole: e.signerRole,
            signerName: e.signerName || "",
            signature:  e.signature,
            occurredAt: e.occurredAt
        }));
}

/**
 * Traccia delle operazioni sulla consegna, in ordine cronologico. Dati grezzi:
 * etichette e icone sono compito della UI.
 */
export async function getTrace(shipmentId, deliveryId) {
    const events = await db.getEventsByDelivery(shipmentId, deliveryId);
    return events
        .slice()
        .sort(byOccurredAt)
        .map((e) => ({
            eventId:    e.eventId,
            type:       e.type,
            occurredAt: e.occurredAt,
            packageId:  e.packageId,
            reasons:    e.reasons,
            signerRole: e.signerRole,
            signerName: e.signerName,
            syncStatus: e.syncStatus
        }));
}
