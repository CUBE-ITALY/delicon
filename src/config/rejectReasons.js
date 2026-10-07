/**
 * Catalogo dei motivi di rifiuto (collo e consegna).
 *
 * - code:     codice stabile salvato negli eventi e inviato al backend.
 *             Mai salvare la label: la label cambia con la lingua, il code no.
 * - labelKey: chiave di traduzione.
 *
 * Il catalogo è configurazione di prodotto: ogni cliente può avere il proprio.
 * La corrispondenza con i codici del sistema sorgente sta negli adattatori
 * (vedi docs/DATA-MODEL.md §Motivi di rifiuto).
 */

export const REJECT_REASONS = Object.freeze([
    { code: "DAMAGED",              labelKey: "reason.damaged" },
    { code: "WET",                  labelKey: "reason.wet" },
    { code: "TORN",                 labelKey: "reason.torn" },
    { code: "PALLET_DEFECT",        labelKey: "reason.palletDefect" },
    { code: "REFUSED_BY_CONSIGNEE", labelKey: "reason.refusedByConsignee" },
    { code: "DUPLICATE_ORDER",      labelKey: "reason.duplicateOrder" },
    { code: "UNLOADED_DAMAGED",     labelKey: "reason.unloadedDamaged" },
    { code: "UNLOADED_WET",         labelKey: "reason.unloadedWet" }
]);

/**
 * Voce speciale del rifiuto di un collo GIÀ scaricato: "scansione errata".
 * Non genera un rifiuto, vince su ogni altra selezione e annulla lo scarico.
 * Non viene mai inviata al backend.
 */
export const WRONG_SCAN_CODE = "WRONG_SCAN";

/**
 * Motivo del rifiuto di un collo MAI scaricato: il collo non c'è (non caricato,
 * smarrito). Senza questo motivo un collo assente bloccava la conferma della
 * consegna e restava solo il rifiuto totale.
 */
export const MISSING_CODE = "MISSING";

const WRONG_SCAN_REASON = Object.freeze({ code: WRONG_SCAN_CODE, labelKey: "reason.wrongScan", special: true });
const MISSING_REASON    = Object.freeze({ code: MISSING_CODE,    labelKey: "reason.missing" });

const ALL_REASONS = [WRONG_SCAN_REASON, MISSING_REASON, ...REJECT_REASONS];

/** Motivi validi per il rifiuto totale di una consegna. */
export function getDeliveryRejectReasons() {
    return REJECT_REASONS.map((r) => ({ ...r }));
}

/**
 * Motivi per un collo GIÀ scaricato: la voce speciale in testa (lo sparo
 * errato è il caso più frequente) seguita dai motivi veri.
 */
export function getPackageRejectReasons() {
    return [{ ...WRONG_SCAN_REASON }, ...getDeliveryRejectReasons()];
}

/** Motivi per un collo NON scaricato: "mancante" in testa, poi i motivi veri. */
export function getUnscannedPackageRejectReasons() {
    return [{ ...MISSING_REASON }, ...getDeliveryRejectReasons()];
}

/** @returns {string|null} chiave di traduzione del codice, null se sconosciuto */
export function reasonLabelKey(code) {
    const found = ALL_REASONS.find((r) => r.code === code);
    return found ? found.labelKey : null;
}
