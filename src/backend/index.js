/**
 * Unico punto di selezione del backend: il resto dell'app importa solo questo
 * modulo. Il trasporto demo è servito sempre dal mock, anche quando è
 * configurato il backend REST, così la demo funziona comunque.
 *
 * Interfaccia comune (mock e REST):
 *   downloadShipment(shipmentId) → { shipment, deliveries, packages }
 *   submitEvents(shipmentId, events) → { results: [{ eventId, status, message? }] }
 */

import { appConfig } from "../config/appConfig.js";
import { mockBackend } from "./mockBackend.js";
import { restBackend } from "./restBackend.js";

function _backendFor(shipmentId) {
    if (appConfig.backend === "mock" || shipmentId === appConfig.demoShipmentId) {
        return mockBackend;
    }
    return restBackend;
}

export const backend = {
    downloadShipment(shipmentId) {
        return _backendFor(shipmentId).downloadShipment(shipmentId);
    },

    submitEvents(shipmentId, events) {
        return _backendFor(shipmentId).submitEvents(shipmentId, events);
    }
};
