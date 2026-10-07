<!--
  Icone SVG in linea (nessun font o CDN: l'app deve funzionare offline).
  Disegnate per Delicon: griglia 24×24, tratto 2,5px con terminali squadrati
  e angoli vivi, colore ereditato dal testo. Un tracciato { d, fill: true }
  viene riempito invece che tracciato.
-->
<script setup>
import { computed } from "vue";

const props = defineProps({
    name: { type: String, required: true },
    size: { type: [Number, String], default: 22 }
});

const CIRCLE = "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z";
const CLOUD = "M7 19a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.5 11 4 4 0 0 1 18 19H7z";

const ICONS = {
    "chevron-left":  ["M20 12H5.5", "M11.5 5.5L5 12l6.5 6.5"],
    "chevron-right": ["M9.5 5.5L16 12l-6.5 6.5"],
    check:           ["M5 12.5l4.5 4.5L19 7"],
    x:               ["M6.5 6.5l11 11", "M17.5 6.5l-11 11"],
    ban:             [CIRCLE, "M6 6l12 12"],
    clock:           [CIRCLE, "M12 7.5V12l3.5 2.5"],
    pen:             ["M15 4.5l4.5 4.5L8.5 20H4v-4.5L15 4.5z", "M12.5 7l4.5 4.5"],
    box:             ["M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z", "M3.5 7.5L12 12l8.5-4.5", "M12 12v9"],
    truck:           ["M2.5 6H14v10H2.5z", "M14 9.5h4l3.5 3.5v3H14", "M5 16v3h3v-3", "M16 16v3h3v-3"],
    barcode:         ["M4 5v14", "M7.5 5v14", "M11 5v14", "M14 5v14", "M17 5v14", "M20 5v14"],
    alert:           ["M12 4.5v9.5", "M12 18v1.5"],
    "cloud-up":      [CLOUD, "M12 16.5v-5", "M9.5 14L12 11.5l2.5 2.5"],
    "cloud-check":   [CLOUD, "M9.5 14.5l2 2 3.5-3.5"],
    "cloud-off":     [CLOUD, "M3.5 3.5l17 17"],
    undo:            ["M9 14L4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
    download:        ["M12 3.5V15", "M6.5 9.5L12 15l5.5-5.5", "M4 20h16"],
    eraser:          ["M7 20h13", "M15.5 4.5l4 4L10 18H6.5L3 14.5 15.5 4.5z"],
    keyboard:        ["M2.5 6h19v12h-19z", "M6.5 10h1", "M11.5 10h1", "M16.5 10h1", "M7.5 14h9"],
    contrast:        ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", { d: "M12 4a8 8 0 0 1 0 16z", fill: true }],
    sun:             ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2",
                      "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
    moon:            ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"]
};

const paths = computed(() => (ICONS[props.name] || []).map((p) => (typeof p === "string" ? { d: p, fill: false } : p)));
</script>

<template>
    <svg
        class="icon"
        :width="size"
        :height="size"
        viewBox="0 0 24 24"
        stroke-width="2.5"
        stroke-linecap="square"
        stroke-linejoin="miter"
        aria-hidden="true"
        focusable="false"
    >
        <path
            v-for="(p, i) in paths"
            :key="i"
            :d="p.d"
            :fill="p.fill ? 'currentColor' : 'none'"
            :stroke="p.fill ? 'none' : 'currentColor'"
        />
    </svg>
</template>

<style scoped>
.icon {
    flex: none;
    display: block;
}
</style>
