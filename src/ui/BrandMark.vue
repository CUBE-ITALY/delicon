<!--
  Logo Delicon: il cubo di Cube Italy (isometrico, faccia superiore lime che
  galleggia sopra il corpo antracite e grigio) con la spunta gialla di Delicon,
  bordata di nero, che esce dal cubo. Stesso disegno di public/favicon.svg e
  dell'icona Android (res/drawable/ic_launcher_foreground.xml).
  Colori fissi del marchio, uguali in entrambi i temi: la tessera ha il suo fondo,
  antracite neutro, abbastanza chiaro da staccare la faccia sinistra del cubo.
-->
<script setup>
defineProps({
    size: { type: [Number, String], default: 30 }
});
</script>

<template>
    <svg
        class="brand-mark"
        :width="size"
        :height="size"
        viewBox="0 0 48 48"
        aria-hidden="true"
        focusable="false"
    >
        <rect width="48" height="48" fill="#3a3d41" />
        <!-- corpo: faccia sinistra, faccia destra, sommità scura visibile sotto la faccia sollevata -->
        <path d="M10 25L22 31.9V44.9L10 38z" fill="#1c1e1f" />
        <path d="M22 31.9L34 25V38L22 44.9z" fill="#5c5f62" />
        <path d="M10 25L22 18.1L34 25L22 31.9z" fill="#0c0d0e" />
        <!-- faccia superiore lime, sollevata -->
        <path d="M9 21.4L22 13.9L35 21.4L22 28.9z" fill="#9ae949" />
        <!-- spunta: bordo nero, poi giallo traffico -->
        <path d="M16.5 21L21.5 26L37 10.5" fill="none" stroke="#151615" stroke-width="4.6" stroke-linecap="square" />
        <path d="M16.5 21L21.5 26L37 10.5" fill="none" stroke="#f5b400" stroke-width="2.6" stroke-linecap="square" />
    </svg>
</template>

<style scoped>
.brand-mark {
    flex: none;
    display: block;
}
</style>
