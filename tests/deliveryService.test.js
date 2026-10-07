import { describe, it, expect } from "vitest";
import * as service from "../src/services/deliveryService.js";
import * as db from "../src/data/db.js";
import { ScanOutcome } from "../src/services/deliveryService.js";
import { DeliveryStatus, EventType, SignerRole } from "../src/domain/model.js";
import { WRONG_SCAN_CODE, MISSING_CODE } from "../src/config/rejectReasons.js";

const DEMO = "0000000873";
const SIGNATURE = { image: "data:image/png;base64,AAAA", strokeCount: 3, pointCount: 40, durationMs: 900 };

async function scanAll(deliveryId, ids) {
    for (const id of ids) {
        const r = await service.scanPackage(DEMO, deliveryId, id);
        expect(r.outcome).toBe(ScanOutcome.SCANNED);
    }
}

describe("download del trasporto", () => {
    it("scarica il demo e lo ricostruisce in ordine di scarico", async () => {
        expect(await service.downloadShipment(" 0000000873 ")).toBe(DEMO);
        const shipment = await service.loadShipment(DEMO);
        expect(shipment.deliveries.map((d) => d.deliveryId)).toEqual(["0001", "0002"]);
        expect(shipment.summary).toEqual({
            deliveriesClosed: 0, deliveriesTotal: 2, packagesScanned: 0, packagesExpected: 7
        });
        expect((await service.listShipments()).map((s) => s.shipmentId)).toEqual([DEMO]);
    });

    it("trasporto inesistente → NOT_FOUND", async () => {
        await expect(service.downloadShipment("9999")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("senza connessione → errore di rete", async () => {
        setOnline(false);
        await expect(service.downloadShipment(DEMO)).rejects.toMatchObject({ isNetworkError: true });
    });

    it("il re-download conserva gli eventi registrati", async () => {
        await service.downloadShipment(DEMO);
        await service.scanPackage(DEMO, "0001", "000000013178");
        await service.downloadShipment(DEMO);
        const d = await service.loadDelivery(DEMO, "0001");
        expect(d.scannedCount).toBe(1);
    });
});

describe("scansione colli", () => {
    it("distingue scaricato, già scaricato e non atteso", async () => {
        await service.downloadShipment(DEMO);
        expect((await service.scanPackage(DEMO, "0001", "000000013178")).outcome).toBe(ScanOutcome.SCANNED);
        expect((await service.scanPackage(DEMO, "0001", "000000013178")).outcome).toBe(ScanOutcome.ALREADY_SCANNED);
        // Collo di un'altra consegna: non atteso qui.
        expect((await service.scanPackage(DEMO, "0001", "000000013190")).outcome).toBe(ScanOutcome.NOT_EXPECTED);
        const events = await db.getEventsByDelivery(DEMO, "0001");
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: EventType.PACKAGE_SCANNED, packageId: "000000013178", scannedCode: "000000013178" });
    });

    it("'scansione errata' annulla lo scarico, gli altri motivi rifiutano il collo", async () => {
        await service.downloadShipment(DEMO);
        await service.scanPackage(DEMO, "0001", "000000013178");
        expect(await service.rejectPackage(DEMO, "0001", "000000013178", [WRONG_SCAN_CODE, "WET"])).toBe("cancelled");
        let d = await service.loadDelivery(DEMO, "0001");
        expect(d.packages[0]).toMatchObject({ scanned: false, rejected: false });

        expect(await service.rejectPackage(DEMO, "0001", "000000013178", ["WET"])).toBe("rejected");
        d = await service.loadDelivery(DEMO, "0001");
        expect(d.packages[0]).toMatchObject({ rejected: true, rejectReasons: ["WET"] });

        // Rileggere un collo rifiutato lo riporta a scaricato, segnalandolo.
        const r = await service.scanPackage(DEMO, "0001", "000000013178");
        expect(r).toMatchObject({ outcome: ScanOutcome.SCANNED, wasRejected: true });
    });

    it("rifiuto senza motivi non è ammesso", async () => {
        await service.downloadShipment(DEMO);
        await expect(service.rejectPackage(DEMO, "0001", "000000013178", [])).rejects.toMatchObject({ code: "REASONS_REQUIRED" });
    });
});

describe("chiusura della consegna", () => {
    it("non si conferma con colli ancora da scaricare", async () => {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190"]);
        await expect(service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE })).rejects.toMatchObject({ code: "NOT_CONFIRMABLE" });
    });

    it("conferma + firma del destinatario, poi niente più scansioni", async () => {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190", "000000013191", "000000013192"]);
        await service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE });

        const d = await service.loadDelivery(DEMO, "0002");
        expect(d.status).toBe(DeliveryStatus.PENDING_SYNC);
        expect(d.signatures).toEqual([{ signerRole: SignerRole.CONSIGNEE }]);
        expect((await service.scanPackage(DEMO, "0002", "000000013190")).outcome).toBe(ScanOutcome.CLOSED);
        await expect(service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE })).rejects.toMatchObject({ code: "DELIVERY_CLOSED" });

        const sigs = await service.getSignatures(DEMO, "0002");
        expect(sigs[0].signature).toEqual(SIGNATURE);
    });

    it("rifiuto totale con doppia firma", async () => {
        await service.downloadShipment(DEMO);
        await service.rejectDelivery(DEMO, "0001", ["REFUSED_BY_CONSIGNEE"], { driver: { signature: SIGNATURE, signerName: " Mario Verdi " }, consignee: { signature: SIGNATURE } });
        const d = await service.loadDelivery(DEMO, "0001");
        expect(d.status).toBe(DeliveryStatus.REJECTED);
        expect(d.signatures.map((s) => s.signerRole)).toEqual([SignerRole.DRIVER, SignerRole.CONSIGNEE]);

        const trace = await service.getTrace(DEMO, "0001");
        expect(trace.map((t) => t.type)).toEqual([
            EventType.DELIVERY_REJECTED, EventType.DELIVERY_SIGNED, EventType.DELIVERY_SIGNED
        ]);

        // Nome di chi firma: ripulito dagli spazi, assente se non indicato.
        const sigs = await service.getSignatures(DEMO, "0001");
        expect(sigs.map((s) => s.signerName)).toEqual(["Mario Verdi", ""]);
        const events = await db.getEventsByDelivery(DEMO, "0001");
        const consigneeEvent = events.find((e) => e.signerRole === SignerRole.CONSIGNEE);
        expect("signerName" in consigneeEvent).toBe(false);
    });

    it("'scansione errata' non è un motivo di rifiuto totale", async () => {
        await service.downloadShipment(DEMO);
        await expect(service.rejectDelivery(DEMO, "0001", [WRONG_SCAN_CODE], { driver: { signature: SIGNATURE }, consignee: { signature: SIGNATURE } }))
            .rejects.toMatchObject({ code: "INVALID_REASON" });
    });
});

describe("collo mancante", () => {
    it("un collo mai letto si rifiuta come mancante e la consegna diventa confermabile", async () => {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190", "000000013191"]);
        expect((await service.loadDelivery(DEMO, "0002")).isConfirmable).toBe(false);

        expect(await service.rejectPackage(DEMO, "0002", "000000013192", [MISSING_CODE])).toBe("rejected");
        const d = await service.loadDelivery(DEMO, "0002");
        expect(d.isConfirmable).toBe(true);
        expect(d.packages[2]).toMatchObject({ scanned: false, rejected: true, rejectReasons: [MISSING_CODE] });

        await service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE, signerName: "Laura Bianchi" });
        expect((await service.loadDelivery(DEMO, "0002")).status).toBe(DeliveryStatus.CONFIRMED_WITH_EXCEPTIONS);
    });

    it("annullare il rifiuto riporta il collo da scaricare", async () => {
        await service.downloadShipment(DEMO);
        await service.rejectPackage(DEMO, "0002", "000000013192", [MISSING_CODE]);
        await service.cancelScan(DEMO, "0002", "000000013192");
        const d = await service.loadDelivery(DEMO, "0002");
        expect(d.packages[2]).toMatchObject({ scanned: false, rejected: false, rejectReasons: [] });
        expect(d.status).toBe(DeliveryStatus.NOT_STARTED);
    });
});

describe("snapshot", () => {
    it("il nuovo snapshot sostituisce il vecchio: le consegne sparite vengono rimosse", async () => {
        const ship = { shipmentId: "S", downloadedAt: "2026-01-01T00:00:00.000Z" };
        const d = (deliveryId) => ({ shipmentId: "S", deliveryId, sequence: null, consignee: {}, expectedPackageCount: 1 });
        const p = (deliveryId) => ({ shipmentId: "S", deliveryId, packageId: "P" + deliveryId });
        await db.replaceShipmentSnapshot(ship, [d("1"), d("2")], [p("1"), p("2")]);
        await db.replaceShipmentSnapshot(ship, [d("2")], [p("2")]);
        expect((await db.getDeliveriesByShipment("S")).map((x) => x.deliveryId)).toEqual(["2"]);
        expect((await db.getPackagesByShipment("S")).map((x) => x.packageId)).toEqual(["P2"]);
    });
});

describe("outbox", () => {
    it("appendEvents è atomico: un eventId duplicato annulla tutto il blocco", async () => {
        const base = { type: EventType.DELIVERY_CONFIRMED, shipmentId: "X", deliveryId: "1", occurredAt: "2026-01-01T00:00:00.000Z" };
        await db.appendEvent({ ...base, eventId: "dup" });
        await expect(db.appendEvents([{ ...base, eventId: "new" }, { ...base, eventId: "dup" }])).rejects.toBeTruthy();
        const events = await db.getEventsByDelivery("X", "1");
        expect(events.map((e) => e.eventId)).toEqual(["dup"]);
    });
});

describe("foto dei colli rifiutati", () => {
    const PHOTO = { image: "data:image/jpeg;base64,/9j/AAAA", width: 1280, height: 960 };

    it("un collo rifiutato si può fotografare: la foto è un evento e non ne cambia lo stato", async () => {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190"]);
        await service.rejectPackage(DEMO, "0002", "000000013190", ["WET"]);
        await service.addPackagePhoto(DEMO, "0002", "000000013190", PHOTO);
        await service.addPackagePhoto(DEMO, "0002", "000000013190", PHOTO);

        const d = await service.loadDelivery(DEMO, "0002");
        expect(d.packages[0]).toMatchObject({ rejected: true, rejectReasons: ["WET"], photoCount: 2 });
        expect(d.photoCount).toBe(2);

        const photos = await service.getPhotos(DEMO, "0002");
        expect(photos).toHaveLength(2);
        expect(photos[0]).toMatchObject({ packageId: "000000013190", photo: PHOTO });
        expect((await service.getTrace(DEMO, "0002")).map((e) => e.type)).toContain(EventType.PACKAGE_PHOTO_TAKEN);
    });

    it("niente foto per colli non rifiutati o rifiutati come mancanti", async () => {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190"]);
        await expect(service.addPackagePhoto(DEMO, "0002", "000000013190", PHOTO))
            .rejects.toMatchObject({ code: "PHOTO_NOT_ALLOWED" });
        await service.rejectPackage(DEMO, "0002", "000000013192", [MISSING_CODE]);
        await expect(service.addPackagePhoto(DEMO, "0002", "000000013192", PHOTO))
            .rejects.toMatchObject({ code: "PHOTO_NOT_ALLOWED" });
        expect(service.canPhotographPackage({ rejected: true, rejectReasons: [MISSING_CODE] })).toBe(false);
        expect(service.canPhotographPackage({ rejected: true, rejectReasons: ["DAMAGED"] })).toBe(true);
    });

    it("niente foto non valide o su consegna chiusa", async () => {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190", "000000013191"]);
        await service.rejectPackage(DEMO, "0002", "000000013192", ["DAMAGED"]);
        await expect(service.addPackagePhoto(DEMO, "0002", "000000013192", { image: "x" }))
            .rejects.toMatchObject({ code: "INVALID_PHOTO" });
        await service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE });
        await expect(service.addPackagePhoto(DEMO, "0002", "000000013192", PHOTO))
            .rejects.toMatchObject({ code: "DELIVERY_CLOSED" });
    });
});

describe("eliminazione delle foto", () => {
    const PHOTO = { image: "data:image/jpeg;base64,/9j/AAAA", width: 1280, height: 960 };

    async function photographed() {
        await service.downloadShipment(DEMO);
        await scanAll("0002", ["000000013190", "000000013191"]);
        await service.rejectPackage(DEMO, "0002", "000000013192", ["DAMAGED"]);
        await service.addPackagePhoto(DEMO, "0002", "000000013192", PHOTO);
        await service.addPackagePhoto(DEMO, "0002", "000000013192", PHOTO);
        return service.getPhotos(DEMO, "0002");
    }

    it("a consegna aperta la foto si elimina: sparisce dalla galleria e dai conteggi", async () => {
        const [first, second] = await photographed();
        await service.removePackagePhoto(DEMO, "0002", first.eventId);

        const photos = await service.getPhotos(DEMO, "0002");
        expect(photos.map((p) => p.eventId)).toEqual([second.eventId]);
        const d = await service.loadDelivery(DEMO, "0002");
        expect(d.packages[2].photoCount).toBe(1);
        expect(d.photoCount).toBe(1);
        expect((await service.getTrace(DEMO, "0002")).map((e) => e.type)).toContain(EventType.PACKAGE_PHOTO_REMOVED);
    });

    it("una foto già eliminata o inesistente → PHOTO_NOT_FOUND", async () => {
        const [first] = await photographed();
        await service.removePackagePhoto(DEMO, "0002", first.eventId);
        await expect(service.removePackagePhoto(DEMO, "0002", first.eventId)).rejects.toMatchObject({ code: "PHOTO_NOT_FOUND" });
        await expect(service.removePackagePhoto(DEMO, "0002", "nessuna")).rejects.toMatchObject({ code: "PHOTO_NOT_FOUND" });
    });

    it("dopo la conferma la foto non si elimina più", async () => {
        const [first] = await photographed();
        await service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE });
        await expect(service.removePackagePhoto(DEMO, "0002", first.eventId)).rejects.toMatchObject({ code: "DELIVERY_CLOSED" });
        expect(await service.getPhotos(DEMO, "0002")).toHaveLength(2);
    });
});
