import { describe, it, expect } from "vitest";
import * as service from "../src/services/deliveryService.js";
import * as db from "../src/data/db.js";
import { syncDelivery, syncPending } from "../src/services/sync.js";
import { DeliveryStatus, SyncState } from "../src/domain/model.js";

const DEMO = "0000000873";
const SIGNATURE = { image: "data:image/png;base64,AAAA", strokeCount: 3, pointCount: 40, durationMs: 900 };

async function closeDelivery2() {
    for (const id of ["000000013190", "000000013191", "000000013192"]) {
        await service.scanPackage(DEMO, "0002", id);
    }
    await service.confirmDelivery(DEMO, "0002", { signature: SIGNATURE });
}

describe("sincronizzazione (mock)", () => {
    it("online: la consegna chiusa diventa sincronizzata", async () => {
        await service.downloadShipment(DEMO);
        await closeDelivery2();
        expect(await syncDelivery(DEMO, "0002")).toEqual({ submitted: 5, errored: 0 });
        const d = await service.loadDelivery(DEMO, "0002");
        expect(d.status).toBe(DeliveryStatus.SYNCED);
        expect(d.syncState).toBe(SyncState.SYNCED);
        // Niente più da inviare.
        expect(await syncDelivery(DEMO, "0002")).toEqual({ submitted: 0, errored: 0 });
    });

    it("offline: errore di rete, eventi in attesa; al ritorno della rete il retry li invia", async () => {
        await service.downloadShipment(DEMO);
        await closeDelivery2();
        setOnline(false);
        await expect(syncDelivery(DEMO, "0002")).rejects.toMatchObject({ isNetworkError: true });
        expect((await service.loadDelivery(DEMO, "0002")).status).toBe(DeliveryStatus.PENDING_SYNC);

        // Ancora offline: il giro si ferma alla prima caduta.
        expect(await syncPending()).toEqual({ candidates: 1, synced: 0, errored: 0, failed: 1 });

        setOnline(true);
        expect(await syncPending()).toEqual({ candidates: 1, synced: 1, errored: 0, failed: 0 });
        expect((await service.loadDelivery(DEMO, "0002")).status).toBe(DeliveryStatus.SYNCED);
    });

    it("le consegne aperte non vengono inviate", async () => {
        await service.downloadShipment(DEMO);
        await service.scanPackage(DEMO, "0001", "000000013178");
        expect(await syncDelivery(DEMO, "0001")).toEqual({ submitted: 0, errored: 0 });
        expect(await syncPending()).toEqual({ candidates: 0, synced: 0, errored: 0, failed: 0 });
        const events = await db.getEventsByDelivery(DEMO, "0001");
        expect(events[0].syncStatus).toBe("pending");
    });

    it("il retry riprende anche gli eventi in errore", async () => {
        await service.downloadShipment(DEMO);
        await closeDelivery2();
        const events = await db.getEventsByDelivery(DEMO, "0002");
        await db.updateEventsSyncStatus(events.map((e) => ({ eventId: e.eventId, status: "error", message: "KO" })));
        expect((await service.loadDelivery(DEMO, "0002")).syncState).toBe(SyncState.ERROR);

        expect(await syncPending()).toMatchObject({ candidates: 1, synced: 1 });
        const after = await db.getEventsByDelivery(DEMO, "0002");
        expect(after.every((e) => e.syncStatus === "synced" && !e.syncMessage)).toBe(true);
    });
});
