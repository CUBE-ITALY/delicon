/**
 * Persistenza locale su IndexedDB.
 *
 * Due famiglie di store:
 *   - snapshot del trasporto (shipments, deliveries, packages): scritti SOLO
 *     al download, mai durante il lavoro;
 *   - outbox: log di eventi append-only. L'unica mutazione ammessa è
 *     l'aggiornamento di syncStatus/syncMessage dopo un invio.
 */

import { EventSyncStatus } from "../domain/model.js";

const DB_NAME    = "delicon";
const DB_VERSION = 1;

let _dbPromise = null;

function _open() {
    if (_dbPromise) {
        return _dbPromise;
    }
    _dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            db.createObjectStore("shipments", { keyPath: "shipmentId" });

            const deliveries = db.createObjectStore("deliveries", {
                keyPath: ["shipmentId", "deliveryId"]
            });
            deliveries.createIndex("by_shipment", "shipmentId");

            const packages = db.createObjectStore("packages", {
                keyPath: ["shipmentId", "deliveryId", "packageId"]
            });
            packages.createIndex("by_shipment", "shipmentId");
            packages.createIndex("by_delivery", ["shipmentId", "deliveryId"]);

            const outbox = db.createObjectStore("outbox", { keyPath: "eventId" });
            outbox.createIndex("by_shipment", "shipmentId");
            outbox.createIndex("by_delivery", ["shipmentId", "deliveryId"]);
            outbox.createIndex("by_sync_status", "syncStatus");
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror   = () => {
            _dbPromise = null;
            reject(request.error);
        };
    });
    return _dbPromise;
}

/**
 * Esegue fn in una transazione e si risolve al suo completamento. Se fn
 * restituisce una IDBRequest, la Promise si risolve con il suo risultato.
 */
function _tx(storeNames, mode, fn) {
    return _open().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        let result;
        try {
            result = fn(tx);
        } catch (err) {
            tx.abort();
            reject(err);
            return;
        }
        // L'errore della singola richiesta risale alla transazione (che viene
        // annullata): si rigetta con quello, tx.error può essere ancora null.
        let failure = null;
        tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
        tx.onerror    = (event) => { failure = failure || event.target.error; };
        tx.onabort    = () => reject(failure || tx.error || new Error("Transazione annullata"));
    }));
}

/** Legge con una richiesta singola (get/getAll) in una transazione readonly. */
function _read(storeName, makeRequest) {
    return _tx([storeName], "readonly", (tx) => makeRequest(tx.objectStore(storeName)));
}

// --- Snapshot del trasporto ---

/**
 * Sostituisce in modo atomico lo snapshot di un trasporto (re-download).
 * Gli eventi dell'outbox NON vengono toccati: sopravvivono per design.
 *
 * @param {import("../domain/model.js").Shipment}   shipment
 * @param {import("../domain/model.js").Delivery[]} deliveries
 * @param {import("../domain/model.js").Package[]}  packages
 */
export function replaceShipmentSnapshot(shipment, deliveries, packages) {
    return _tx(["shipments", "deliveries", "packages"], "readwrite", (tx) => {
        const shipmentStore = tx.objectStore("shipments");
        const deliveryStore = tx.objectStore("deliveries");
        const packageStore  = tx.objectStore("packages");

        // Prima si leggono le chiavi del vecchio snapshot, poi si cancella e
        // si scrive il nuovo. Le scritture partono solo nella callback
        // dell'ultima lettura: un cursore che cancella in parallelo alle put
        // cancellerebbe anche i record appena inseriti.
        let oldDeliveryKeys = [];
        deliveryStore.index("by_shipment").getAllKeys(shipment.shipmentId).onsuccess = (e) => {
            oldDeliveryKeys = e.target.result;
        };
        packageStore.index("by_shipment").getAllKeys(shipment.shipmentId).onsuccess = (e) => {
            oldDeliveryKeys.forEach((k) => deliveryStore.delete(k));
            e.target.result.forEach((k) => packageStore.delete(k));

            shipmentStore.put(shipment);
            deliveries.forEach((d) => deliveryStore.put(d));
            packages.forEach((p) => packageStore.put(p));
        };
    });
}

export function getShipment(shipmentId) {
    return _read("shipments", (s) => s.get(shipmentId)).then((r) => r ?? null);
}

export function getAllShipments() {
    return _read("shipments", (s) => s.getAll());
}

export function getDeliveriesByShipment(shipmentId) {
    return _read("deliveries", (s) => s.index("by_shipment").getAll(shipmentId));
}

export function getDelivery(shipmentId, deliveryId) {
    return _read("deliveries", (s) => s.get([shipmentId, deliveryId])).then((r) => r ?? null);
}

export function getPackagesByShipment(shipmentId) {
    return _read("packages", (s) => s.index("by_shipment").getAll(shipmentId));
}

export function getPackagesByDelivery(shipmentId, deliveryId) {
    return _read("packages", (s) => s.index("by_delivery").getAll([shipmentId, deliveryId]));
}

// --- Outbox (append-only) ---

/**
 * Accoda più eventi in UNA transazione: o vengono scritti tutti o nessuno.
 * Usato per i comandi composti (conferma + firma, rifiuto + due firme).
 *
 * @param {import("../domain/model.js").OutboxEvent[]} events
 */
export function appendEvents(events) {
    return _tx(["outbox"], "readwrite", (tx) => {
        const store = tx.objectStore("outbox");
        // add (non put): un eventId già presente fa fallire la tx invece di
        // sovrascrivere un evento esistente.
        events.forEach((e) => store.add({ syncStatus: EventSyncStatus.PENDING, ...e }));
    });
}

export function appendEvent(event) {
    return appendEvents([event]);
}

export function getEventsByDelivery(shipmentId, deliveryId) {
    return _read("outbox", (s) => s.index("by_delivery").getAll([shipmentId, deliveryId]));
}

export function getEventsByShipment(shipmentId) {
    return _read("outbox", (s) => s.index("by_shipment").getAll(shipmentId));
}

/** Eventi non ancora sincronizzati (in attesa o rifiutati dal server). */
export function getUnsyncedEvents() {
    return Promise.all([
        _read("outbox", (s) => s.index("by_sync_status").getAll(EventSyncStatus.PENDING)),
        _read("outbox", (s) => s.index("by_sync_status").getAll(EventSyncStatus.ERROR))
    ]).then(([pending, errored]) => pending.concat(errored));
}

/**
 * Aggiorna lo stato di invio di più eventi in una transazione.
 * Unica mutazione ammessa sull'outbox.
 *
 * @param {{eventId: string, status: string, message?: string}[]} results
 */
export function updateEventsSyncStatus(results) {
    return _tx(["outbox"], "readwrite", (tx) => {
        const store = tx.objectStore("outbox");
        results.forEach(({ eventId, status, message }) => {
            const getReq = store.get(eventId);
            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) {
                    return; // evento sconosciuto: il server ha risposto per un id non nostro
                }
                record.syncStatus = status;
                if (message) {
                    record.syncMessage = message;
                } else {
                    delete record.syncMessage;
                }
                store.put(record);
            };
        });
    });
}

/** Solo test: chiude la connessione così il database può essere eliminato. */
export async function closeForTests() {
    if (_dbPromise) {
        const db = await _dbPromise;
        db.close();
        _dbPromise = null;
    }
}

export const DB_NAME_FOR_TESTS = DB_NAME;
