<!--
  Marcatore di stato: quadrato + testo in maiuscolo stretto. La forma cambia
  insieme al colore, così lo stato si legge anche senza distinguere i colori:
    neutral  □ vuoto           (da scaricare)
    info     ◧ mezzo pieno     (in scarico)
    success  ■ verde           (confermata, inviata)
    warning  ■ arancio         (firma mancante, con riserva)
    danger   ■ rosso           (rifiutata, errore di invio)
    pending  ⬚ tratteggiato    (salvata sul dispositivo, da inviare)
  `icon` è accettato per compatibilità con statusView/syncView ma non disegnato.
-->
<script setup>
defineProps({
    label: { type: String, required: true },
    tone:  { type: String, default: "neutral" },
    icon:  { type: String, default: "" }
});
</script>

<template>
    <span class="mark" :class="'mark--' + tone">{{ label }}</span>
</template>

<style scoped>
.mark {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-xs);
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.mark::before {
    content: "";
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
}

.mark--neutral { color: var(--ink-2); }

.mark--info { color: var(--ink); }
.mark--info::before { background: linear-gradient(90deg, currentColor 50%, transparent 50%); }

.mark--success { color: var(--ok); }
.mark--warning { color: var(--warn-ink); }
.mark--danger  { color: var(--ko); }
.mark--success::before,
.mark--warning::before,
.mark--danger::before { background: currentColor; }

.mark--pending { color: var(--ink); }
.mark--pending::before {
    width: 13px;
    height: 13px;
    border-style: dashed;
}
</style>
