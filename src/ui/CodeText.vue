<!--
  Testo con codici: gli zeri iniziali di ogni numero lungo (4+ cifre) sono
  attenuati, le cifre significative restano piene. L'operatore confronta le
  ultime cifre con l'etichetta senza contare gli zeri. Il testo resta intero
  (anche per lo screen reader): cambia solo l'aspetto.
    "Collo 000000013192 rifiutato" → Collo [0000000]13192 rifiutato
-->
<script setup>
import { computed } from "vue";

const props = defineProps({
    text: { type: [String, Number], required: true }
});

const parts = computed(() => {
    const s = String(props.text ?? "");
    const out = [];
    const re = /\d{4,}/g;
    let last = 0;
    let m;
    while ((m = re.exec(s))) {
        const run = m[0];
        const zeros = (run.match(/^0+/) || [""])[0];
        // Almeno una cifra piena: "0000" → [000]0
        const dim = zeros.length === run.length ? zeros.slice(0, -1) : zeros;
        if (m.index > last) {
            out.push({ text: s.slice(last, m.index) });
        }
        if (dim) {
            out.push({ text: dim, dim: true });
        }
        out.push({ text: run.slice(dim.length) });
        last = m.index + run.length;
    }
    if (last < s.length) {
        out.push({ text: s.slice(last) });
    }
    return out;
});
</script>

<template>
    <span class="code-text"><template v-for="(p, i) in parts" :key="i"><span v-if="p.dim" class="code-text__zeros">{{ p.text }}</span><template v-else>{{ p.text }}</template></template></span>
</template>

<style scoped>
.code-text__zeros {
    opacity: 0.5;
}
</style>
