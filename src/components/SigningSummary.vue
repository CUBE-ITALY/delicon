<!--
  Riepilogo di ciò che si sta firmando, mostrato sopra la firma: chi firma
  deve vedere cosa sottoscrive (colli consegnati, colli o consegna rifiutati).
-->
<script setup>
import CodeText from "../ui/CodeText.vue";

defineProps({
    title: { type: String, required: true },
    lines: { type: Array, required: true }   // [{ text, tone? }]
});
</script>

<template>
    <section class="signing-summary">
        <p class="signing-summary__title"><CodeText :text="title" /></p>
        <ul class="signing-summary__lines">
            <li v-for="(line, i) in lines" :key="i" :class="'line--' + (line.tone || 'neutral')">
                <span><CodeText :text="line.text" /></span>
            </li>
        </ul>
    </section>
</template>

<style scoped>
.signing-summary {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
    padding: 8px 12px 10px;
    border: 2px solid var(--ink);
}

.signing-summary__title {
    font-weight: 600;
    overflow-wrap: anywhere;
}

.signing-summary__lines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

/* Quadrato pieno dell'esito davanti a ogni riga */
.signing-summary__lines li {
    display: flex;
    gap: 8px;
    font-size: var(--fs-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
}

.signing-summary__lines li::before {
    content: "";
    flex: none;
    width: 11px;
    height: 11px;
    margin-top: 0.3em;
    border: 2px solid currentColor;
}

.line--success { color: var(--ok); }
.line--danger  { color: var(--ko); }
.line--warning { color: var(--warn-ink); }
.line--neutral { color: var(--ink-2); }

.line--success::before,
.line--danger::before,
.line--warning::before { background: currentColor; }
</style>
