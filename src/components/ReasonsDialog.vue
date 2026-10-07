<!--
  Selezione multipla dei motivi di rifiuto (collo o consegna). La voce
  speciale "scansione errata" esclude le altre: sceglierla toglie le altre
  selezioni e viceversa, così è evidente che annulla solo lo scarico.
-->
<script setup>
import { ref, computed } from "vue";
import Modal from "../ui/Modal.vue";
import Icon from "../ui/Icon.vue";
import { t } from "../i18n/index.js";

const props = defineProps({
    title:   { type: String, required: true },
    reasons: { type: Array, required: true },   // [{ code, labelKey, special? }]
    busy:    { type: Boolean, default: false }
});

const emit = defineEmits(["cancel", "confirm"]);

const selected = ref(new Set());
const hasSelection = computed(() => selected.value.size > 0);

function toggle(reason) {
    const next = new Set(selected.value);
    if (next.has(reason.code)) {
        next.delete(reason.code);
    } else if (reason.special) {
        next.clear();
        next.add(reason.code);
    } else {
        props.reasons.filter((r) => r.special).forEach((r) => next.delete(r.code));
        next.add(reason.code);
    }
    selected.value = next;
}

function confirm() {
    if (hasSelection.value) {
        emit("confirm", props.reasons.map((r) => r.code).filter((c) => selected.value.has(c)));
    }
}
</script>

<template>
    <Modal :title="title" :busy="busy" @close="emit('cancel')">
        <ul class="reasons" role="group" :aria-label="title">
            <li v-for="reason in reasons" :key="reason.code" :class="{ 'is-special': reason.special }">
                <button
                    type="button"
                    class="reason"
                    role="checkbox"
                    :aria-checked="selected.has(reason.code)"
                    :class="{ 'is-selected': selected.has(reason.code) }"
                    @click="toggle(reason)"
                >
                    <span class="box" aria-hidden="true">
                        <Icon v-if="selected.has(reason.code)" name="check" :size="18" />
                    </span>
                    <span>{{ t(reason.labelKey) }}</span>
                </button>
            </li>
        </ul>
        <template #actions>
            <button type="button" class="btn" :disabled="busy" @click="emit('cancel')">
                {{ t('app.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="!hasSelection || busy" @click="confirm">
                {{ t('reasons.confirm') }}
            </button>
        </template>
    </Modal>
</template>

<style scoped>
/* Righe a tutta larghezza del pannello, come le voci di un modulo */
.reasons {
    list-style: none;
    margin: 0 calc(-1 * var(--gutter));
    padding: 0;
    border-top: 1px solid var(--hair);
    border-bottom: 1px solid var(--hair);
}

.reasons li + li {
    border-top: 1px solid var(--hair);
}

/* La voce speciale (scansione errata, collo mancante) è separata dalle altre */
.reasons .is-special {
    border-bottom: 2px solid var(--ink);
}

.reasons .is-special + li {
    border-top: 0;
}

.reason {
    width: 100%;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px var(--gutter);
    border: 0;
    background: transparent;
    text-align: left;
    font-size: var(--fs-md);
    cursor: pointer;
}

.reason:active {
    background: var(--sheet-2);
}

.reason.is-selected {
    background: var(--sheet-2);
    font-weight: 600;
}

.box {
    flex: none;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 2px solid var(--ink);
    background: var(--sheet);
}

.is-selected .box {
    background: var(--ink);
    color: var(--sheet);
}
</style>
