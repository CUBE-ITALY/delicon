/**
 * Modello dati canonico di Delicon.
 *
 * I nomi descrivono il significato di business, non il campo tecnico di un
 * sistema sorgente: la corrispondenza con SAP (e con altri sistemi) è
 * documentata in docs/DATA-MODEL.md e vive SOLO negli adattatori backend.
 * Nessun modulo fuori da src/backend/ deve conoscere nomi di campo esterni.
 */

/** Versione dello schema eventi inviato al backend (envelope del batch). */
export const EVENT_SCHEMA_VERSION = 1;

/**
 * Tipi evento dell'outbox (fatti avvenuti, al passato).
 * @readonly
 * @enum {string}
 */
export const EventType = Object.freeze({
    PACKAGE_SCANNED:        "PACKAGE_SCANNED",
    PACKAGE_SCAN_CANCELLED: "PACKAGE_SCAN_CANCELLED",
    PACKAGE_REJECTED:       "PACKAGE_REJECTED",
    PACKAGE_PHOTO_TAKEN:    "PACKAGE_PHOTO_TAKEN",   // foto del collo rifiutato (documentazione)
    PACKAGE_PHOTO_REMOVED:  "PACKAGE_PHOTO_REMOVED", // foto eliminata prima della chiusura
    DELIVERY_CONFIRMED:     "DELIVERY_CONFIRMED",
    DELIVERY_REJECTED:      "DELIVERY_REJECTED",
    DELIVERY_SIGNED:        "DELIVERY_SIGNED"
});

/**
 * Eventi che chiudono una consegna (stato terminale): solo una consegna
 * chiusa viene inviata al backend, altrimenti il dataset sarebbe incompleto.
 */
export const CLOSING_EVENT_TYPES = Object.freeze([
    EventType.DELIVERY_CONFIRMED,
    EventType.DELIVERY_REJECTED
]);

/**
 * Ruolo di chi firma.
 * @readonly
 * @enum {string}
 */
export const SignerRole = Object.freeze({
    DRIVER:    "driver",     // autista / corriere
    CONSIGNEE: "consignee"   // destinatario
});

/**
 * Stato di lavoro di una consegna, derivato dalla Projection (mai persistito).
 * @readonly
 * @enum {string}
 */
export const DeliveryStatus = Object.freeze({
    NOT_STARTED:               "not_started",
    IN_PROGRESS:               "in_progress",
    CONFIRMED:                 "confirmed",                 // confermata, firma mancante
    CONFIRMED_WITH_EXCEPTIONS: "confirmed_with_exceptions", // confermata con colli rifiutati
    PENDING_SYNC:              "pending_sync",              // chiusa e firmata, non ancora inviata
    SYNCED:                    "synced",
    REJECTED:                  "rejected"                   // rifiuto totale
});

/**
 * Stato di sincronizzazione di una consegna, indipendente da DeliveryStatus:
 * permette di mostrare l'invio anche per le consegne con eccezioni.
 * @readonly
 * @enum {string}
 */
export const SyncState = Object.freeze({
    NONE:    "none",     // nessun evento di chiusura da inviare
    PENDING: "pending",  // almeno un evento in attesa di invio
    ERROR:   "error",    // almeno un evento rifiutato dal server
    SYNCED:  "synced"    // tutto inviato
});

/**
 * Stato di sincronizzazione del singolo evento (campo locale, mai inviato).
 * @readonly
 * @enum {string}
 */
export const EventSyncStatus = Object.freeze({
    PENDING: "pending",
    SYNCED:  "synced",
    ERROR:   "error"
});

/**
 * @typedef {object} Shipment  Trasporto (viaggio) assegnato all'operatore.
 * @property {string} shipmentId    Identificativo del trasporto nel sistema sorgente (opaco).
 * @property {string} downloadedAt  ISO 8601, momento del download sul device.
 */

/**
 * @typedef {object} Address
 * @property {string} name          Ragione sociale o nominativo del destinatario.
 * @property {string} street        Via (può includere il civico).
 * @property {string} houseNumber   Numero civico.
 * @property {string} postalCode
 * @property {string} city
 * @property {string} region        Provincia / regione.
 * @property {string} country       Codice paese ISO 3166-1 alpha-2.
 */

/**
 * @typedef {object} Delivery  Consegna a un destinatario, all'interno di un trasporto.
 * @property {string}      shipmentId
 * @property {string}      deliveryId            Chiave della consegna nel trasporto (opaca).
 * @property {number|null} sequence              Ordine di scarico (numerico); null = non definito.
 * @property {string}      deliveryNumber        Numero del documento di consegna.
 * @property {string}      deliveryNoteNumber    Numero del documento di trasporto (DDT).
 * @property {Address}     consignee             Destinatario.
 * @property {number}      expectedPackageCount  Colli attesi.
 */

/**
 * @typedef {object} Package  Collo (unità di movimentazione) di una consegna.
 * @property {string} shipmentId
 * @property {string} deliveryId
 * @property {string} packageId     Identificativo del collo nel sistema sorgente.
 * @property {string} [barcode]     Codice stampato sull'etichetta (es. SSCC). Se assente
 *                                  lo scanner deve leggere packageId.
 * @property {string} lineId        Riga del documento di consegna.
 * @property {string} articleCode   Codice articolo.
 * @property {string} description   Descrizione articolo.
 */

/**
 * @typedef {object} SignatureData  Firma grafometrica acquisita sul device.
 * @property {string} image         data-URL PNG base64.
 * @property {number} strokeCount
 * @property {number} pointCount
 * @property {number} durationMs
 */

/**
 * @typedef {object} PhotoData  Foto scattata sul device (es. collo rifiutato).
 * @property {string} image   data-URL JPEG base64.
 * @property {number} width   Larghezza in pixel.
 * @property {number} height  Altezza in pixel.
 */

/**
 * @typedef {object} OutboxEvent  Evento append-only dell'outbox.
 * @property {string}          eventId      UUID, chiave di idempotenza: mai rigenerato.
 * @property {EventType}       type
 * @property {string}          shipmentId
 * @property {string}          deliveryId
 * @property {string}          occurredAt   ISO 8601 (orologio del device).
 * @property {string}          [packageId]  Eventi PACKAGE_*.
 * @property {string}          [scannedCode] Codice letto dallo scanner (PACKAGE_SCANNED).
 * @property {string[]}        [reasons]    Codici motivo (PACKAGE_REJECTED, DELIVERY_REJECTED).
 * @property {SignerRole}      [signerRole] DELIVERY_SIGNED.
 * @property {string}          [signerName] DELIVERY_SIGNED, facoltativo: nome di chi firma.
 * @property {SignatureData}   [signature]  DELIVERY_SIGNED.
 * @property {PhotoData}       [photo]      PACKAGE_PHOTO_TAKEN.
 * @property {string}          [photoEventId] PACKAGE_PHOTO_REMOVED: eventId della foto eliminata.
 * @property {EventSyncStatus} syncStatus   Locale, rimosso prima dell'invio.
 * @property {string}          [syncMessage] Locale, messaggio d'errore del server.
 */
