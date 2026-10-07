import { describe, it, expect, vi, afterEach } from "vitest";
import { createRestBackend } from "../src/backend/restBackend.js";

const API = {
    baseUrl: "https://api.example.test",
    shipmentPath: "/shipments/{shipmentId}",
    eventsPath: "/shipments/{shipmentId}/events",
    auth: "bearer",
    credentials: "tok123",
    apiKeyHeader: "X-Api-Key",
    timeoutMs: 1000
};

function mockFetch(status, body) {
    const fn = vi.fn(async () => new Response(
        body === undefined ? "" : JSON.stringify(body),
        { status, headers: { "Content-Type": "application/json" } }
    ));
    globalThis.fetch = fn;
    return fn;
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const EVENTS = [
    { eventId: "a", type: "DELIVERY_CONFIRMED", shipmentId: "S 1", deliveryId: "1", occurredAt: "t1", syncStatus: "pending" },
    { eventId: "b", type: "DELIVERY_SIGNED", shipmentId: "S 1", deliveryId: "1", occurredAt: "t2", syncStatus: "error", syncMessage: "x" }
];

describe("downloadShipment", () => {
    it("chiama l'endpoint configurato e appiattisce consegne e colli", async () => {
        const fetchFn = mockFetch(200, {
            shipmentId: "S 1",
            deliveries: [{
                deliveryId: "1", sequence: "2", consignee: { name: "Cliente" },
                packages: [{ packageId: "P1", barcode: "SSCC1" }, { packageId: "P2" }]
            }]
        });
        const data = await createRestBackend(API).downloadShipment("S 1");

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://api.example.test/shipments/S%201");
        expect(init.headers.Authorization).toBe("Bearer tok123");
        expect(data.shipment.shipmentId).toBe("S 1");
        expect(data.deliveries[0]).toMatchObject({ deliveryId: "1", sequence: 2, expectedPackageCount: 2 });
        expect(data.packages.map((p) => p.barcode)).toEqual(["SSCC1", undefined]);
    });

    it("404 → NOT_FOUND, 503 → errore di rete, fetch fallita → errore di rete", async () => {
        const backend = createRestBackend(API);
        mockFetch(404, { message: "no" });
        await expect(backend.downloadShipment("X")).rejects.toMatchObject({ code: "NOT_FOUND" });
        mockFetch(503, {});
        await expect(backend.downloadShipment("X")).rejects.toMatchObject({ isNetworkError: true });
        globalThis.fetch = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
        await expect(backend.downloadShipment("X")).rejects.toMatchObject({ isNetworkError: true });
    });

    it("senza indirizzo configurato → errore di configurazione", async () => {
        await expect(createRestBackend({ ...API, baseUrl: "" }).downloadShipment("X"))
            .rejects.toMatchObject({ code: "CONFIG" });
    });

    it("autenticazione basic e api key", async () => {
        let fetchFn = mockFetch(200, { deliveries: [] });
        await createRestBackend({ ...API, auth: "basic", credentials: "utente:pàss" }).downloadShipment("X");
        expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Basic " + Buffer.from("utente:pàss").toString("base64"));

        fetchFn = mockFetch(200, { deliveries: [] });
        await createRestBackend({ ...API, auth: "apikey", credentials: "k" }).downloadShipment("X");
        expect(fetchFn.mock.calls[0][1].headers["X-Api-Key"]).toBe("k");
    });
});

describe("submitEvents", () => {
    it("invia schemaVersion e gli eventi senza campi locali", async () => {
        const fetchFn = mockFetch(200, {});
        const res = await createRestBackend(API).submitEvents("S 1", EVENTS);

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://api.example.test/shipments/S%201/events");
        expect(init.method).toBe("POST");
        const body = JSON.parse(init.body);
        expect(body.schemaVersion).toBe(1);
        expect(body.shipmentId).toBe("S 1");
        expect(body.device).toMatchObject({ appVersion: "0.1.0", platform: "web" });
        expect(body.device.deviceId).toMatch(/^[0-9a-f-]{36}$/);
        expect(body.events[1]).toEqual({ eventId: "b", type: "DELIVERY_SIGNED", shipmentId: "S 1", deliveryId: "1", occurredAt: "t2" });
        expect(res.results.map((r) => r.status)).toEqual(["synced", "synced"]);
    });

    it("esiti per evento: accepted/duplicate → synced, rejected → error", async () => {
        mockFetch(200, { results: [
            { eventId: "a", status: "duplicate" },
            { eventId: "b", status: "rejected", message: "firma mancante" }
        ] });
        const res = await createRestBackend(API).submitEvents("S 1", EVENTS);
        expect(res.results).toEqual([
            { eventId: "a", status: "synced" },
            { eventId: "b", status: "error", message: "firma mancante" }
        ]);
    });

    it("4xx → tutti in errore col messaggio del server; 5xx → rigetta (si ritenta)", async () => {
        mockFetch(422, { error: { message: "payload non valido" } });
        const res = await createRestBackend(API).submitEvents("S 1", EVENTS);
        expect(res.results.every((r) => r.status === "error" && r.message === "payload non valido")).toBe(true);

        mockFetch(500, {});
        await expect(createRestBackend(API).submitEvents("S 1", EVENTS)).rejects.toMatchObject({ isNetworkError: true });
    });
});
