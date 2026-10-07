/**
 * Errori del backend riconosciuti dall'app. La UI distingue per proprietà,
 * non per testo del messaggio:
 *   - isNetworkError  → rete/timeout/server temporaneamente non disponibile:
 *                       si può ritentare, gli eventi restano in attesa;
 *   - code NOT_FOUND  → trasporto inesistente;
 *   - code CONFIG     → backend non configurato (endpoint TBD).
 */

export { networkError } from "../platform/httpClient.js";

export function notFoundError(shipmentId) {
    const err = new Error(`Trasporto ${shipmentId} non trovato`);
    err.code = "NOT_FOUND";
    return err;
}

export function configError(message) {
    const err = new Error(message);
    err.code = "CONFIG";
    return err;
}
