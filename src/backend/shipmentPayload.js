/**
 * Conversione tra il formato di scambio con il backend (docs/API.md) e il
 * modello canonico salvato sul device. Condiviso da mock e backend REST, così
 * i dati demo seguono esattamente lo stesso contratto del servizio reale.
 */

function _str(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function _intOrNull(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function _invalid(message) {
    const err = new Error("Risposta del server non valida: " + message);
    err.code = "INVALID_PAYLOAD";
    return err;
}

/**
 * Converte la risposta "GET trasporto" (consegne con colli annidati) nei tre
 * insiemi piatti salvati su IndexedDB.
 *
 * @param {any} json  Corpo della risposta.
 * @param {string} requestedId  Trasporto richiesto (fallback se il corpo non lo riporta).
 * @returns {{shipment: object, deliveries: object[], packages: object[]}}
 */
export function parseShipmentPayload(json, requestedId) {
    if (!json || typeof json !== "object" || !Array.isArray(json.deliveries)) {
        throw _invalid("manca l'elenco deliveries");
    }
    const shipmentId = _str(json.shipmentId) || _str(requestedId);
    if (!shipmentId) {
        throw _invalid("manca shipmentId");
    }

    const deliveries = [];
    const packages   = [];

    json.deliveries.forEach((d, i) => {
        const deliveryId = _str(d && d.deliveryId);
        if (!deliveryId) {
            throw _invalid(`consegna #${i + 1} senza deliveryId`);
        }
        const c = d.consignee || {};
        const pkgs = Array.isArray(d.packages) ? d.packages : [];

        deliveries.push({
            shipmentId,
            deliveryId,
            sequence:             _intOrNull(d.sequence),
            deliveryNumber:       _str(d.deliveryNumber),
            deliveryNoteNumber:   _str(d.deliveryNoteNumber),
            consignee: {
                name:        _str(c.name),
                street:      _str(c.street),
                houseNumber: _str(c.houseNumber),
                postalCode:  _str(c.postalCode),
                city:        _str(c.city),
                region:      _str(c.region),
                country:     _str(c.country)
            },
            // Se il backend non dichiara i colli attesi, valgono quelli elencati.
            expectedPackageCount: _intOrNull(d.expectedPackageCount) ?? pkgs.length
        });

        pkgs.forEach((p, j) => {
            const packageId = _str(p && p.packageId);
            if (!packageId) {
                throw _invalid(`collo #${j + 1} della consegna ${deliveryId} senza packageId`);
            }
            const pkg = {
                shipmentId,
                deliveryId,
                packageId,
                lineId:      _str(p.lineId),
                articleCode: _str(p.articleCode),
                description: _str(p.description)
            };
            const barcode = _str(p.barcode);
            if (barcode) {
                pkg.barcode = barcode;
            }
            packages.push(pkg);
        });
    });

    return {
        shipment: { shipmentId, downloadedAt: new Date().toISOString() },
        deliveries,
        packages
    };
}

/** Campi locali dell'outbox che non vanno mai inviati. */
const LOCAL_EVENT_FIELDS = ["syncStatus", "syncMessage"];

/** Copia dell'evento pronta per l'invio (senza campi locali). */
export function toWireEvent(event) {
    const wire = { ...event };
    LOCAL_EVENT_FIELDS.forEach((f) => delete wire[f]);
    return wire;
}
