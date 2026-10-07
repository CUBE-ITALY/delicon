<!--
  Barra a tacche: una tacca per collo o per consegna, colorata secondo
  l'esito (verde fatto, rosso rifiutato, vuota da fare). Oltre `max`
  elementi le tacche diventerebbero illeggibili: la barra diventa continua,
  con le stesse proporzioni.

  Si passa l'esito di ogni elemento (tones: ["ok", "ko", "", …]) oppure i
  conteggi (ok, ko, total). Solo visiva: i numeri sono sempre scritti accanto.
-->
<script setup>
import { computed } from "vue";

const props = defineProps({
    tones: { type: Array, default: null },
    ok:    { type: Number, default: 0 },
    ko:    { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    max:   { type: Number, default: 24 }
});

const segments = computed(() => {
    if (props.tones) {
        return props.tones;
    }
    const ok = Math.max(0, props.ok);
    const ko = Math.max(0, Math.min(props.ko, props.total - ok));
    const rest = Math.max(0, props.total - ok - ko);
    return [...Array(ok).fill("ok"), ...Array(ko).fill("ko"), ...Array(rest).fill("")];
});

const continuous = computed(() => segments.value.length > props.max);

// Barra continua: un tratto per esito, largo quanto il suo conteggio.
const spans = computed(() => {
    const n = { ok: 0, ko: 0, "": 0 };
    segments.value.forEach((tone) => { n[tone || ""] += 1; });
    return [["ok", n.ok], ["ko", n.ko], ["", n[""]]].filter(([, count]) => count > 0);
});
</script>

<template>
    <div class="tally" :class="{ 'tally--continuous': continuous }" aria-hidden="true">
        <template v-if="continuous">
            <i v-for="[tone, count] in spans" :key="tone" :class="tone" :style="{ flexGrow: count }" />
        </template>
        <template v-else>
            <i v-for="(tone, i) in segments" :key="i" :class="tone" />
        </template>
    </div>
</template>

<style scoped>
.tally {
    display: flex;
    gap: 3px;
    height: 8px;
}

.tally i {
    flex: 1 1 0;
    min-width: 0;
    background: var(--empty);
}

.tally--continuous {
    gap: 0;
}

.tally i.ok { background: var(--ok); }
.tally i.ko { background: var(--ko); }
</style>
