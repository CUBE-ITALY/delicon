/**
 * Backend dimostrativo: nessuna comunicazione reale.
 *
 * L'esito dipende solo dalla connessione del device (Wi-Fi o dati):
 *   - online  → il download restituisce i dati demo, l'invio accetta tutti
 *               gli eventi;
 *   - offline → errore di rete, esattamente come il backend reale: gli
 *               eventi restano in attesa e il retry automatico li invierà.
 */

import demoShipment from "./fixtures/demo-shipment.json";
import { parseShipmentPayload } from "./shipmentPayload.js";
import { networkError, notFoundError } from "./errors.js";
import { isOnline } from "../platform/network.js";

const LATENCY_MIN_MS = 400;
const LATENCY_MAX_MS = 1200;

let _latency = () => LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS);

function _delay() {
    return new Promise((resolve) => setTimeout(resolve, _latency()));
}

async function _requireConnection() {
    await _delay();
    if (!(await isOnline())) {
        throw networkError();
    }
}

export const mockBackend = {

    /**
     * @param {string} shipmentId
     * @returns {Promise<{shipment: object, deliveries: object[], packages: object[]}>}
     */
    async downloadShipment(shipmentId) {
        await _requireConnection();
        if (shipmentId !== demoShipment.shipmentId) {
            throw notFoundError(shipmentId);
        }
        return parseShipmentPayload(structuredClone(demoShipment), shipmentId);
    },

    /**
     * @param {string} shipmentId
     * @param {object[]} events
     * @returns {Promise<{results: {eventId: string, status: string}[]}>}
     */
    async submitEvents(shipmentId, events) {
        await _requireConnection();
        return {
            results: events.map((e) => ({ eventId: e.eventId, status: "synced" }))
        };
    }
};

/** Solo test: latenza nulla. */
export function disableMockLatencyForTests() {
    _latency = () => 0;
}
