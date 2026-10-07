/**
 * Funzioni di presentazione: etichette, toni ed icone per stati e motivi.
 * Unico punto in cui il dominio diventa testo e colore.
 */

import { t, getLocale } from "../i18n/index.js";
import { DeliveryStatus, SyncState, SignerRole } from "../domain/model.js";
import { reasonLabelKey } from "../config/rejectReasons.js";

const STATUS_TONE = {
    [DeliveryStatus.NOT_STARTED]:               "neutral",
    [DeliveryStatus.IN_PROGRESS]:               "info",
    [DeliveryStatus.CONFIRMED]:                 "warning",
    [DeliveryStatus.CONFIRMED_WITH_EXCEPTIONS]: "warning",
    [DeliveryStatus.PENDING_SYNC]:              "success",
    [DeliveryStatus.SYNCED]:                    "success",
    [DeliveryStatus.REJECTED]:                  "danger"
};

const STATUS_ICON = {
    [DeliveryStatus.NOT_STARTED]:               "box",
    [DeliveryStatus.IN_PROGRESS]:               "barcode",
    [DeliveryStatus.CONFIRMED]:                 "alert",
    [DeliveryStatus.CONFIRMED_WITH_EXCEPTIONS]: "alert",
    [DeliveryStatus.PENDING_SYNC]:              "check",
    [DeliveryStatus.SYNCED]:                    "check",
    [DeliveryStatus.REJECTED]:                  "ban"
};

/** @returns {{label: string, tone: string, icon: string}} */
export function statusView(status) {
    return {
        label: t("status." + status),
        tone:  STATUS_TONE[status] || "neutral",
        icon:  STATUS_ICON[status] || "box"
    };
}

// "pending" = marcatore tratteggiato: salvato sul dispositivo, non ancora inviato.
const SYNC_VIEW = {
    [SyncState.PENDING]: { tone: "pending", icon: "cloud-up" },
    [SyncState.ERROR]:   { tone: "danger",  icon: "cloud-off" },
    [SyncState.SYNCED]:  { tone: "success", icon: "cloud-check" }
};

/** @returns {{label: string, tone: string, icon: string}|null} null = niente da mostrare */
export function syncView(syncState) {
    const view = SYNC_VIEW[syncState];
    return view ? { ...view, label: t("sync." + syncState) } : null;
}

/**
 * Consegne di un trasporto per la barra a tacche: chiuse (ok), rifiutate (ko),
 * e quante sono ancora da inviare o in errore di invio.
 * @param {Array<{status: string, syncState: string, isClosed: boolean}>} deliveries
 */
export function deliveriesTally(deliveries) {
    const list = deliveries || [];
    return {
        ok:         list.filter((d) => d.isClosed && d.status !== DeliveryStatus.REJECTED).length,
        ko:         list.filter((d) => d.status === DeliveryStatus.REJECTED).length,
        total:      list.length,
        toSend:     list.filter((d) => d.syncState === SyncState.PENDING).length,
        sendErrors: list.filter((d) => d.syncState === SyncState.ERROR).length
    };
}

/**
 * Colli di un trasporto per la barra a tacche: scaricati (ok) e rifiutati,
 * singolarmente o con l'intera consegna (ko).
 * @param {Array<{status: string, expectedCount: number, scannedCount: number, rejectedCount: number}>} deliveries
 */
export function packagesTally(deliveries) {
    let ok = 0;
    let ko = 0;
    let total = 0;
    (deliveries || []).forEach((d) => {
        total += d.expectedCount;
        if (d.status === DeliveryStatus.REJECTED) {
            ko += d.expectedCount;
        } else {
            ok += d.scannedCount;
            ko += d.rejectedCount;
        }
    });
    return { ok, ko, total };
}

export function reasonLabel(code) {
    const key = reasonLabelKey(code);
    return key ? t(key) : code;
}

export function reasonLabels(codes) {
    return (codes || []).map(reasonLabel).join(", ");
}

export function signerRoleLabel(role) {
    return role === SignerRole.DRIVER ? t("role.driver") : t("role.consignee");
}

/** Via e civico, senza ripetere il civico se la via lo contiene già. */
export function streetLine(consignee) {
    const street = (consignee && consignee.street) || "";
    const number = (consignee && consignee.houseNumber) || "";
    return number && !street.endsWith(number) ? `${street} ${number}` : street;
}

/** "20121 Milano (MI)" */
export function cityLine(consignee) {
    if (!consignee) {
        return "";
    }
    const city = [consignee.postalCode, consignee.city].filter(Boolean).join(" ");
    return consignee.region ? `${city} (${consignee.region})` : city;
}

export function formatTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) {
        return "";
    }
    return d.toLocaleString(getLocale(), {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
}
