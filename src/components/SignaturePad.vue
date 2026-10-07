<!--
  Area di firma su canvas con PointerEvent nativi (dito, penna, mouse).

  Raccoglie i tratti e ne ricava i metadati di validazione (tratti, punti,
  lunghezza percorsa, durata). Non conosce consegne né outbox: emette
  "change" con la validità a ogni fine tratto e su clear.

  I punti sono in px logici, il backing store è scalato per devicePixelRatio:
  il tratto resta nitido e il ridisegno è corretto dopo ogni resize.
  Il foglio è sempre bianco con inchiostro nero, anche col tema scuro: è
  l'immagine che viene salvata.
-->
<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
    height:          { type: String, default: "14rem" },
    lineWidth:       { type: Number, default: 2.5 },
    // Soglie di validazione (vedi isValid)
    minPoints:       { type: Number, default: 15 },
    minStrokes:      { type: Number, default: 1 },
    minStrokeLength: { type: Number, default: 120 },
    ariaLabel:       { type: String, default: "" }
});

const emit = defineEmits(["change"]);

const canvas = ref(null);
let strokes = [];
let current = null;
let drawing = false;
let ctx = null;
let cssWidth = 0;
let cssHeight = 0;
let rect = null;
let observer = null;

// --- Metadati ---

function strokeCount() {
    return strokes.length;
}

function pointCount() {
    return strokes.reduce((sum, s) => sum + s.length, 0);
}

function totalLength() {
    let total = 0;
    strokes.forEach((s) => {
        for (let i = 1; i < s.length; i++) {
            total += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
        }
    });
    return total;
}

function durationMs() {
    let min = Infinity;
    let max = -Infinity;
    strokes.forEach((s) => s.forEach((p) => {
        min = Math.min(min, p.t);
        max = Math.max(max, p.t);
    }));
    return max >= min ? Math.round(max - min) : 0;
}

/** Più severa di "canvas non vuoto": abbastanza tratti, punti e lunghezza. */
function isValid() {
    return strokeCount() >= props.minStrokes &&
           pointCount() >= props.minPoints &&
           totalLength() >= props.minStrokeLength;
}

/**
 * Immagine della firma a 1 px per px logico. Il canvas a schermo è scalato
 * per devicePixelRatio (×2/×3 sui palmari): esportarlo così com'è produrrebbe
 * un PNG 4-9 volte più pesante, che finisce in IndexedDB e nel payload di invio.
 * I tratti vengono quindi ridisegnati su un canvas fuori schermo a scala 1.
 */
function exportImage() {
    if (!cssWidth || !cssHeight) {
        return "";
    }
    const off = document.createElement("canvas");
    off.width = cssWidth;
    off.height = cssHeight;
    const c = off.getContext("2d");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, cssWidth, cssHeight);
    c.lineWidth = props.lineWidth;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#000000";
    strokes.forEach((s) => {
        if (s.length === 0) {
            return;
        }
        c.beginPath();
        c.moveTo(s[0].x, s[0].y);
        s.slice(1).forEach((p) => c.lineTo(p.x, p.y));
        if (s.length === 1) {
            c.lineTo(s[0].x + 0.1, s[0].y + 0.1);
        }
        c.stroke();
    });
    return off.toDataURL("image/png");
}

/** Forma unica del dato firma salvato negli eventi DELIVERY_SIGNED. */
function buildPayload() {
    return {
        image:       exportImage(),
        strokeCount: strokeCount(),
        pointCount:  pointCount(),
        durationMs:  durationMs()
    };
}

function clear() {
    strokes = [];
    current = null;
    drawing = false;
    fillBackground();
    emit("change", false);
}

defineExpose({ clear, isValid, buildPayload });

// --- Canvas ---

function resizeBackingStore() {
    const el = canvas.value;
    if (!el) {
        return;
    }
    const box = el.getBoundingClientRect();
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    if (w === 0 || h === 0) {
        return; // non ancora in layout
    }
    const dpr = window.devicePixelRatio || 1;
    el.width = w * dpr;
    el.height = h * dpr;
    // Reimpostare width azzera lo stato del contesto: si riapplica tutto.
    ctx = el.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = props.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";
    cssWidth = w;
    cssHeight = h;
}

function fillBackground() {
    if (!ctx || !cssWidth) {
        return;
    }
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.restore();
}

function redraw() {
    if (!ctx || !cssWidth) {
        return;
    }
    fillBackground();
    strokes.forEach((s) => {
        if (s.length === 0) {
            return;
        }
        ctx.beginPath();
        ctx.moveTo(s[0].x, s[0].y);
        for (let i = 1; i < s.length; i++) {
            ctx.lineTo(s[i].x, s[i].y);
        }
        if (s.length === 1) {
            ctx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
        }
        ctx.stroke();
    });
}

function point(e) {
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.timeStamp || performance.now() };
}

// --- Pointer ---

function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) {
        return;
    }
    if (!ctx) {
        resizeBackingStore();
        fillBackground();
    }
    try { canvas.value.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    rect = canvas.value.getBoundingClientRect();
    drawing = true;
    const p = point(e);
    current = [p];
    strokes.push(current);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1); // anche un punto singolo lascia un segno
    ctx.stroke();
    e.preventDefault();
}

function onPointerMove(e) {
    if (!drawing) {
        return;
    }
    // Eventi coalizzati: tratto fluido sui digitizer ad alta frequenza.
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (events.length ? events : [e]).forEach((ev) => {
        const p = point(ev);
        current.push(p);
        ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    e.preventDefault();
}

function onPointerUp(e) {
    if (!drawing) {
        return;
    }
    drawing = false;
    try { canvas.value.releasePointerCapture(e.pointerId); } catch { /* ignora */ }
    emit("change", isValid());
    e.preventDefault();
}

onMounted(() => {
    resizeBackingStore();
    fillBackground();
    // Copre rotazione schermo e il layout differito del dialog.
    observer = new ResizeObserver(() => {
        resizeBackingStore();
        redraw();
    });
    observer.observe(canvas.value);
});

onBeforeUnmount(() => {
    if (observer) {
        observer.disconnect();
    }
});
</script>

<template>
    <div class="pad" :style="{ height }">
        <canvas
            ref="canvas"
            class="pad__canvas"
            role="img"
            :aria-label="ariaLabel"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
        />
        <span class="pad__x" aria-hidden="true">×</span>
        <span class="pad__baseline" aria-hidden="true" />
    </div>
</template>

<style scoped>
/* Il fondo resta bianco anche nel tema scuro: è il foglio su cui si firma
   ed è lo stesso dell'immagine salvata. */
.pad {
    position: relative;
    width: 100%;
    border: 2px solid var(--ink);
    overflow: hidden;
    background: #ffffff;
}

.pad__canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none; /* niente scroll o zoom mentre si firma */
    cursor: crosshair;
}

/* Riga guida con la croce dei moduli: solo visiva, non finisce nell'immagine salvata. */
.pad__x {
    position: absolute;
    left: 12px;
    bottom: calc(28% - 4px);
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 1.375rem;
    line-height: 1;
    color: #8e9289;
    pointer-events: none;
}

.pad__baseline {
    position: absolute;
    left: 34px;
    right: 14px;
    bottom: 28%;
    border-bottom: 1.5px dashed #9a9e95;
    pointer-events: none;
}
</style>
