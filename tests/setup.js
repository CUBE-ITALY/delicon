import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { vi, beforeEach } from "vitest";
import { closeForTests } from "../src/data/db.js";
import { disableMockLatencyForTests } from "../src/backend/mockBackend.js";

// Connessione del device controllabile dai test: setOnline(true|false).
globalThis.__deviceOnline = true;
globalThis.setOnline = (value) => { globalThis.__deviceOnline = value; };

vi.mock("@capacitor/network", () => ({
    Network: {
        getStatus: async () => ({
            connected: globalThis.__deviceOnline,
            connectionType: globalThis.__deviceOnline ? "wifi" : "none"
        }),
        addListener: async () => ({ remove: async () => {} })
    }
}));

disableMockLatencyForTests();

beforeEach(async () => {
    // Database pulito per ogni test.
    await closeForTests();
    globalThis.indexedDB = new IDBFactory();
    globalThis.__deviceOnline = true;
});
