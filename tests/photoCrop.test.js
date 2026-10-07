import { describe, it, expect } from "vitest";
import { coverSourceRect, fitWithin } from "../src/platform/photoCrop.js";

describe("coverSourceRect", () => {
    it("video orizzontale in una zona verticale: riquadro centrale → centro del fotogramma", () => {
        // 1920×1080 mostrato in 360×600: scala = 600/1080, larghezza mostrata 1066.7, tagliati 353.3 px per lato
        const r = coverSourceRect({ width: 1920, height: 1080 }, { width: 360, height: 600 },
            { left: 30, top: 187.5, width: 300, height: 225 });
        const scale = 600 / 1080;
        expect(r.x).toBeCloseTo((30 + (1920 * scale - 360) / 2) / scale, 5);
        expect(r.y).toBeCloseTo(187.5 / scale, 5);
        expect(r.width).toBeCloseTo(300 / scale, 5);
        expect(r.height).toBeCloseTo(225 / scale, 5);
        // Il centro del riquadro coincide col centro del fotogramma
        expect(r.x + r.width / 2).toBeCloseTo(960, 5);
        expect(r.y + r.height / 2).toBeCloseTo(540, 5);
    });

    it("senza taglio (stesse proporzioni) è una semplice scala", () => {
        const r = coverSourceRect({ width: 1280, height: 720 }, { width: 640, height: 360 },
            { left: 0, top: 0, width: 640, height: 360 });
        expect(r).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    });

    it("il riquadro non esce dal fotogramma", () => {
        const r = coverSourceRect({ width: 100, height: 100 }, { width: 100, height: 100 },
            { left: -10, top: 90, width: 50, height: 50 });
        expect(r).toEqual({ x: 0, y: 90, width: 50, height: 10 });
    });
});

describe("fitWithin", () => {
    it("riduce in proporzione il lato lungo", () => {
        expect(fitWithin(2400, 1800, 1280)).toEqual({ width: 1280, height: 960 });
        expect(fitWithin(900, 1600, 1280)).toEqual({ width: 720, height: 1280 });
    });

    it("non ingrandisce", () => {
        expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    });
});
