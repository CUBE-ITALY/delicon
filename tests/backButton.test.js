import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ handler: null, minimizeApp: vi.fn() }));

vi.mock("../src/platform/nativeApp.js", () => ({
    onBackButton: (h) => { mocks.handler = h; },
    minimizeApp: mocks.minimizeApp
}));

import { initBackButton } from "../src/app/backButton.js";
import { pushModal } from "../src/ui/modalStack.js";

function fakeRouter(name, params = {}) {
    return { currentRoute: { value: { name, params } }, replace: vi.fn() };
}

describe("tasto indietro", () => {
    beforeEach(() => mocks.minimizeApp.mockClear());

    it("chiude prima il dialog in cima alla pila", () => {
        const router = fakeRouter("delivery", { shipmentId: "S", deliveryId: "1" });
        initBackButton(router);
        const closeBottom = vi.fn();
        const closeTop = vi.fn();
        const removeBottom = pushModal(closeBottom);
        const removeTop = pushModal(closeTop);

        mocks.handler();
        expect(closeTop).toHaveBeenCalledOnce();
        expect(closeBottom).not.toHaveBeenCalled();
        expect(router.replace).not.toHaveBeenCalled();

        removeTop();
        removeBottom();
    });

    it("senza dialog risale: consegna → trasporto → home → background", () => {
        let router = fakeRouter("delivery", { shipmentId: "S", deliveryId: "1" });
        initBackButton(router);
        mocks.handler();
        expect(router.replace).toHaveBeenCalledWith({ name: "shipment", params: { shipmentId: "S" } });

        router = fakeRouter("shipment", { shipmentId: "S" });
        initBackButton(router);
        mocks.handler();
        expect(router.replace).toHaveBeenCalledWith({ name: "home" });

        router = fakeRouter("home");
        initBackButton(router);
        mocks.handler();
        expect(router.replace).not.toHaveBeenCalled();
        expect(mocks.minimizeApp).toHaveBeenCalledOnce();
    });
});
