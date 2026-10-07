import { describe, it, expect } from "vitest";
import {
    buildDeliveryState, buildShipmentState, buildShipmentSummary, findPackageByCode
} from "../src/domain/projection.js";
import { EventType, DeliveryStatus, SyncState, SignerRole } from "../src/domain/model.js";

const delivery = {
    shipmentId: "S1", deliveryId: "1", sequence: 1,
    deliveryNumber: "DN1", deliveryNoteNumber: "DDT1",
    consignee: { name: "Cliente" }, expectedPackageCount: 3
};
const packages = ["P1", "P2", "P3"].map((id) => ({
    shipmentId: "S1", deliveryId: "1", packageId: id, lineId: "", articleCode: "", description: ""
}));

let clock = 0;
function ev(type, extra = {}) {
    clock += 1;
    return {
        eventId: "e" + clock, type, shipmentId: "S1", deliveryId: "1",
        occurredAt: new Date(Date.UTC(2026, 0, 1, 8, 0, clock)).toISOString(),
        syncStatus: "pending", ...extra
    };
}

describe("buildDeliveryState", () => {
    it("senza eventi la consegna è da iniziare", () => {
        const s = buildDeliveryState(delivery, packages, []);
        expect(s.status).toBe(DeliveryStatus.NOT_STARTED);
        expect(s.syncState).toBe(SyncState.NONE);
        expect(s.scannedCount).toBe(0);
        expect(s.isConfirmable).toBe(false);
    });

    it("per ogni collo vince l'ultimo evento", () => {
        const events = [
            ev(EventType.PACKAGE_SCANNED, { packageId: "P1" }),
            ev(EventType.PACKAGE_SCAN_CANCELLED, { packageId: "P1" }),
            ev(EventType.PACKAGE_SCANNED, { packageId: "P2" }),
            ev(EventType.PACKAGE_REJECTED, { packageId: "P3", reasons: ["WET"] })
        ];
        // L'ordine di input non conta: si ordina per occurredAt.
        const s = buildDeliveryState(delivery, packages, events.slice().reverse());
        const byId = Object.fromEntries(s.packages.map((p) => [p.packageId, p]));
        expect(byId.P1.scanned).toBe(false);
        expect(byId.P2.scanned).toBe(true);
        expect(byId.P3.rejected).toBe(true);
        expect(byId.P3.rejectReasons).toEqual(["WET"]);
        expect(s.status).toBe(DeliveryStatus.IN_PROGRESS);
    });

    it("confermabile solo se ogni collo è scaricato o rifiutato e almeno uno scaricato", () => {
        const allRejected = packages.map((p) => ev(EventType.PACKAGE_REJECTED, { packageId: p.packageId, reasons: ["WET"] }));
        expect(buildDeliveryState(delivery, packages, allRejected).isConfirmable).toBe(false);

        const mixed = [
            ev(EventType.PACKAGE_SCANNED, { packageId: "P1" }),
            ev(EventType.PACKAGE_SCANNED, { packageId: "P2" }),
            ev(EventType.PACKAGE_REJECTED, { packageId: "P3", reasons: ["TORN"] })
        ];
        expect(buildDeliveryState(delivery, packages, mixed).isConfirmable).toBe(true);
    });

    it("conferma + firma: in attesa di invio, poi sincronizzata", () => {
        const scans = packages.map((p) => ev(EventType.PACKAGE_SCANNED, { packageId: p.packageId }));
        const closing = [
            ev(EventType.DELIVERY_CONFIRMED),
            ev(EventType.DELIVERY_SIGNED, { signerRole: SignerRole.CONSIGNEE, signature: {} })
        ];
        const pending = buildDeliveryState(delivery, packages, [...scans, ...closing]);
        expect(pending.status).toBe(DeliveryStatus.PENDING_SYNC);
        expect(pending.syncState).toBe(SyncState.PENDING);
        expect(pending.isClosed).toBe(true);

        const synced = [...scans, ...closing].map((e) => ({ ...e, syncStatus: "synced" }));
        const s = buildDeliveryState(delivery, packages, synced);
        expect(s.status).toBe(DeliveryStatus.SYNCED);
        expect(s.syncState).toBe(SyncState.SYNCED);
    });

    it("conferma con colli rifiutati: con eccezioni, ma lo stato di invio resta visibile", () => {
        const events = [
            ev(EventType.PACKAGE_SCANNED, { packageId: "P1" }),
            ev(EventType.PACKAGE_SCANNED, { packageId: "P2" }),
            ev(EventType.PACKAGE_REJECTED, { packageId: "P3", reasons: ["DAMAGED"] }),
            ev(EventType.DELIVERY_CONFIRMED),
            ev(EventType.DELIVERY_SIGNED, { signerRole: SignerRole.CONSIGNEE, signature: {} })
        ].map((e) => ({ ...e, syncStatus: "synced" }));
        const s = buildDeliveryState(delivery, packages, events);
        expect(s.status).toBe(DeliveryStatus.CONFIRMED_WITH_EXCEPTIONS);
        expect(s.hasExceptions).toBe(true);
        expect(s.syncState).toBe(SyncState.SYNCED);
    });

    it("rifiuto totale: terminale, con motivi e due firme", () => {
        const events = [
            ev(EventType.PACKAGE_SCANNED, { packageId: "P1" }),
            ev(EventType.DELIVERY_REJECTED, { reasons: ["REFUSED_BY_CONSIGNEE"] }),
            ev(EventType.DELIVERY_SIGNED, { signerRole: SignerRole.DRIVER, signature: {} }),
            ev(EventType.DELIVERY_SIGNED, { signerRole: SignerRole.CONSIGNEE, signature: {} })
        ];
        const s = buildDeliveryState(delivery, packages, events);
        expect(s.status).toBe(DeliveryStatus.REJECTED);
        expect(s.isClosed).toBe(true);
        expect(s.isConfirmed).toBe(false);
        expect(s.rejectReasons).toEqual(["REFUSED_BY_CONSIGNEE"]);
        expect(s.signatures.map((x) => x.signerRole)).toEqual([SignerRole.DRIVER, SignerRole.CONSIGNEE]);
    });

    it("un errore del server su un evento rende visibile lo stato di errore", () => {
        const events = [
            ev(EventType.DELIVERY_REJECTED, { reasons: ["WET"], syncStatus: "error" }),
            ev(EventType.DELIVERY_SIGNED, { signerRole: SignerRole.DRIVER, signature: {}, syncStatus: "synced" })
        ];
        expect(buildDeliveryState(delivery, packages, events).syncState).toBe(SyncState.ERROR);
    });

    it("conferma senza firma resta 'confermata'", () => {
        const scans = packages.map((p) => ev(EventType.PACKAGE_SCANNED, { packageId: p.packageId }));
        const s = buildDeliveryState(delivery, packages, [...scans, ev(EventType.DELIVERY_CONFIRMED)]);
        expect(s.status).toBe(DeliveryStatus.CONFIRMED);
    });
});

describe("buildShipmentState", () => {
    it("ordina per sequenza numerica, senza sequenza in fondo", () => {
        const make = (deliveryId, sequence) => ({ ...delivery, deliveryId, sequence });
        const states = buildShipmentState(
            [make("a", 10), make("b", 2), make("c", null), make("d", 1)],
            [], []
        );
        expect(states.map((s) => s.deliveryId)).toEqual(["d", "b", "a", "c"]);
    });

    it("a parità di sequenza ordina per deliveryId in modo naturale", () => {
        const make = (deliveryId) => ({ ...delivery, deliveryId, sequence: null });
        const states = buildShipmentState([make("10"), make("2"), make("1")], [], []);
        expect(states.map((s) => s.deliveryId)).toEqual(["1", "2", "10"]);
    });

    it("il riepilogo conta consegne chiuse e colli", () => {
        const states = buildShipmentState([delivery], packages, [
            ev(EventType.PACKAGE_SCANNED, { packageId: "P1" })
        ]);
        expect(buildShipmentSummary(states)).toEqual({
            deliveriesClosed: 0, deliveriesTotal: 1, packagesScanned: 1, packagesExpected: 3
        });
    });
});

describe("findPackageByCode", () => {
    it("usa l'etichetta se presente, altrimenti packageId", () => {
        const pkgs = [
            { packageId: "100", barcode: "00380000000000000017" },
            { packageId: "200" }
        ];
        expect(findPackageByCode("00380000000000000017", pkgs).packageId).toBe("100");
        expect(findPackageByCode("100", pkgs)).toBeNull();
        expect(findPackageByCode(" 200 ", pkgs).packageId).toBe("200");
        expect(findPackageByCode("", pkgs)).toBeNull();
    });
});
