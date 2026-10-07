/**
 * Backend REST generico. Gli endpoint sono configurabili (TBD): il contratto
 * atteso è descritto in docs/API.md. Parla solo il modello canonico: un
 * eventuale sistema sorgente con nomi diversi (es. SAP) va adattato lato
 * server o con un adattatore dedicato, non qui.
 */

import { appConfig } from "../config/appConfig.js";
import { EVENT_SCHEMA_VERSION, EventSyncStatus } from "../domain/model.js";
import { request, networkError } from "../platform/httpClient.js";
import { getDeviceInfo } from "../platform/device.js";
import { parseShipmentPayload, toWireEvent } from "./shipmentPayload.js";
import { notFoundError, configError } from "./errors.js";

/** Status HTTP temporanei: l'invio va ritentato più tardi, non è un rifiuto. */
const TRANSIENT_STATUSES = [408, 425, 429, 500, 502, 503, 504];

function _isOk(status) {
    return status >= 200 && status < 300;
}

function _base64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
}

function _authHeaders(api) {
    switch (api.auth) {
        case "bearer":
            return { Authorization: "Bearer " + api.credentials };
        case "basic":
            return { Authorization: "Basic " + _base64Utf8(api.credentials) };
        case "apikey":
            return { [api.apiKeyHeader]: api.credentials };
        default:
            return {};
    }
}

function _url(api, pathTemplate, shipmentId) {
    if (!api.baseUrl) {
        throw configError("Backend non configurato: manca l'indirizzo del servizio (VITE_API_BASE_URL).");
    }
    return api.baseUrl + pathTemplate.replace("{shipmentId}", encodeURIComponent(shipmentId));
}

/** Messaggio leggibile da una risposta d'errore ({ message } o { error: { message } }). */
function _errorMessage(res) {
    const body = res.json || {};
    const msg = body.message || (body.error && body.error.message);
    return msg ? String(msg) : `Errore del server (HTTP ${res.status})`;
}

/**
 * Crea un backend REST. La configurazione è iniettabile per i test.
 * @param {typeof appConfig.api} [api]
 */
export function createRestBackend(api = appConfig.api) {
    return {

        async downloadShipment(shipmentId) {
            const res = await request({
                method:  "GET",
                url:     _url(api, api.shipmentPath, shipmentId),
                headers: { Accept: "application/json", ..._authHeaders(api) },
                timeoutMs: api.timeoutMs
            });
            if (res.status === 404) {
                throw notFoundError(shipmentId);
            }
            if (TRANSIENT_STATUSES.includes(res.status)) {
                throw networkError(_errorMessage(res));
            }
            if (!_isOk(res.status)) {
                throw new Error(_errorMessage(res));
            }
            return parseShipmentPayload(res.json, shipmentId);
        },

        /**
         * Invia gli eventi di un trasporto. Il server deve deduplicare per eventId:
         * il reinvio dello stesso evento è sempre sicuro.
         *
         * Risolve con un esito per evento:
         *   - 2xx con "results" → esito per evento (accepted/duplicate → synced, rejected → error);
         *   - 2xx senza "results" → tutti synced;
         *   - 4xx → tutti error con il messaggio del server.
         * Rigetta (eventi restano in attesa) per rete, timeout e status temporanei.
         */
        async submitEvents(shipmentId, events) {
            const res = await request({
                method:  "POST",
                url:     _url(api, api.eventsPath, shipmentId),
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ..._authHeaders(api)
                },
                body: {
                    schemaVersion: EVENT_SCHEMA_VERSION,
                    shipmentId,
                    device: getDeviceInfo(),
                    events: events.map(toWireEvent)
                },
                timeoutMs: api.timeoutMs
            });

            if (TRANSIENT_STATUSES.includes(res.status)) {
                throw networkError(_errorMessage(res));
            }
            if (!_isOk(res.status)) {
                const message = _errorMessage(res);
                return {
                    results: events.map((e) => ({
                        eventId: e.eventId, status: EventSyncStatus.ERROR, message
                    }))
                };
            }

            const serverResults = res.json && Array.isArray(res.json.results) ? res.json.results : null;
            if (!serverResults) {
                return {
                    results: events.map((e) => ({ eventId: e.eventId, status: EventSyncStatus.SYNCED }))
                };
            }
            const byId = new Map(serverResults.map((r) => [r.eventId, r]));
            return {
                results: events.map((e) => {
                    const r = byId.get(e.eventId);
                    // Evento non citato nella risposta: si considera accettato (2xx).
                    if (!r || r.status === "accepted" || r.status === "duplicate") {
                        return { eventId: e.eventId, status: EventSyncStatus.SYNCED };
                    }
                    return {
                        eventId: e.eventId,
                        status:  EventSyncStatus.ERROR,
                        message: r.message ? String(r.message) : "Evento rifiutato dal server"
                    };
                })
            };
        }
    };
}

export const restBackend = createRestBackend();
