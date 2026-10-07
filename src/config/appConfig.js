/**
 * Configurazione applicativa, letta una sola volta dalle variabili VITE_*
 * (vedi .env.example). Nessun altro modulo legge import.meta.env: così la
 * configurazione è sostituibile nei test e in un futuro caricamento runtime.
 */

const env = import.meta.env || {};

function _int(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const appConfig = Object.freeze({
    /** "mock" | "rest" */
    backend: env.VITE_BACKEND === "rest" ? "rest" : "mock",

    api: Object.freeze({
        baseUrl:      (env.VITE_API_BASE_URL || "").replace(/\/+$/, ""),
        shipmentPath: env.VITE_API_SHIPMENT_PATH || "/shipments/{shipmentId}",
        eventsPath:   env.VITE_API_EVENTS_PATH || "/shipments/{shipmentId}/events",
        /** "none" | "bearer" | "basic" | "apikey" */
        auth:         (env.VITE_API_AUTH || "none").toLowerCase(),
        credentials:  env.VITE_API_CREDENTIALS || "",
        apiKeyHeader: env.VITE_API_KEY_HEADER || "X-Api-Key",
        timeoutMs:    _int(env.VITE_API_TIMEOUT_MS, 15000)
    }),

    /** Trasporto dimostrativo servito sempre dal mock. */
    demoShipmentId: env.VITE_DEMO_SHIPMENT_ID || "0000000873"
});
