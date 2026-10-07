<!--
  Firma del destinatario per la conferma della consegna: riepilogo di ciò che
  si firma, nome di chi firma (facoltativo) e area di firma.
-->
<script setup>
import { ref } from "vue";
import Modal from "../ui/Modal.vue";
import SignaturePad from "./SignaturePad.vue";
import SigningSummary from "./SigningSummary.vue";
import { t } from "../i18n/index.js";

defineProps({
    busy:    { type: Boolean, default: false },
    summary: { type: Object, default: null }   // { title, lines } per SigningSummary
});

const emit = defineEmits(["cancel", "confirm"]);

const pad = ref(null);
const valid = ref(false);
const signerName = ref("");

function confirm() {
    // Il pulsante è disabilitato se la firma non è valida, ma si ricontrolla.
    if (pad.value && pad.value.isValid()) {
        emit("confirm", { signature: pad.value.buildPayload(), signerName: signerName.value });
    }
}
</script>

<template>
    <Modal :title="t('signature.title')" :busy="busy" @close="emit('cancel')">
        <SigningSummary v-if="summary" v-bind="summary" />

        <label class="field name" :class="{ 'is-disabled': busy }" for="signer-name">
            <span class="field-label">{{ t('signature.nameLabel') }}</span>
            <input
                id="signer-name"
                v-model="signerName"
                class="input"
                type="text"
                autocomplete="off"
                autocapitalize="words"
                enterkeyhint="done"
                :placeholder="t('signature.namePlaceholder')"
                :disabled="busy"
            >
        </label>

        <p class="instructions">{{ t('signature.instructions') }}</p>
        <SignaturePad
            ref="pad"
            height="14rem"
            :aria-label="t('signature.title')"
            @change="valid = $event"
        />
        <template #actions>
            <button type="button" class="btn btn-quiet clear" :disabled="busy" @click="pad.clear()">
                {{ t('signature.clear') }}
            </button>
            <button type="button" class="btn" :disabled="busy" @click="emit('cancel')">
                {{ t('app.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="!valid || busy" @click="confirm">
                <span v-if="busy" class="spinner" aria-hidden="true" />
                {{ t('signature.confirm') }}
            </button>
        </template>
    </Modal>
</template>

<style scoped>
.instructions {
    margin: 12px 0 6px;
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
}

.clear {
    flex: 0 0 auto !important;
    padding: 0 10px;
}
</style>
