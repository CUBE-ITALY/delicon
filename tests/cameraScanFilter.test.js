import { describe, it, expect } from "vitest";
import { createRepeatFilter, barcodeCenter, isInsideAim, codesInAim } from "../src/platform/cameraScanFilter.js";

describe("createRepeatFilter", () => {
    it("accetta la prima lettura e ignora lo stesso codice finché resta inquadrato", () => {
        const f = createRepeatFilter(2500);
        expect(f.accept("000000013179", 0)).toBe(true);
        expect(f.accept("000000013179", 100)).toBe(false);
        // Rilevato di continuo per 10 secondi: la finestra scorre, non riscatta
        for (let t = 200; t <= 10000; t += 200) {
            expect(f.accept("000000013179", t)).toBe(false);
        }
    });

    it("riaccetta il codice dopo che è rimasto fuori vista oltre la finestra", () => {
        const f = createRepeatFilter(2500);
        f.accept("A", 0);
        expect(f.accept("A", 2400)).toBe(false);
        expect(f.accept("A", 5000)).toBe(true);
    });

    it("codici diversi sono indipendenti", () => {
        const f = createRepeatFilter(2500);
        expect(f.accept("A", 0)).toBe(true);
        expect(f.accept("B", 10)).toBe(true);
    });
});

describe("barcodeCenter / isInsideAim", () => {
    it("converte il centro da pixel fisici a pixel CSS", () => {
        const c = barcodeCenter([[200, 400], [600, 400], [600, 500], [200, 500]], 2);
        expect(c).toEqual({ x: 200, y: 225 });
    });

    it("senza angoli non c'è centro", () => {
        expect(barcodeCenter(undefined, 2)).toBeNull();
        expect(barcodeCenter([], 2)).toBeNull();
    });

    it("rispetta il mirino con la tolleranza", () => {
        const rect = { left: 30, top: 200, width: 300, height: 100 };
        expect(isInsideAim({ x: 180, y: 250 }, rect, 0.15)).toBe(true);
        expect(isInsideAim({ x: 10, y: 250 }, rect, 0.15)).toBe(true);   // dentro la tolleranza (45px)
        expect(isInsideAim({ x: 180, y: 330 }, rect, 0.15)).toBe(false); // sotto (tolleranza 15px)
    });
});

describe("codesInAim", () => {
    const aim = { rect: { left: 0, top: 100, width: 360, height: 120 }, devicePixelRatio: 2, tolerance: 0.15 };

    it("tiene solo i codici col centro nel mirino", () => {
        const codes = codesInAim([
            { rawValue: "DENTRO", cornerPoints: [[100, 260], [600, 260], [600, 340], [100, 340]] },  // centro y=150
            { rawValue: "FUORI", cornerPoints: [[100, 900], [600, 900], [600, 980], [100, 980]] }    // centro y=470
        ], aim);
        expect(codes).toEqual(["DENTRO"]);
    });

    it("senza angoli o senza mirino accetta", () => {
        expect(codesInAim([{ rawValue: "X" }], aim)).toEqual(["X"]);
        expect(codesInAim([{ rawValue: "Y", cornerPoints: [[0, 2000], [1, 2000], [1, 2001], [0, 2001]] }], { ...aim, rect: null }))
            .toEqual(["Y"]);
    });

    it("ignora i valori vuoti e usa displayValue se manca rawValue", () => {
        expect(codesInAim([{ rawValue: "  " }, { displayValue: "000000013179" }], { ...aim, rect: null }))
            .toEqual(["000000013179"]);
    });
});
