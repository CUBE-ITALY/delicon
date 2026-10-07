<!--
  Doppia firma del rifiuto totale: autista e destinatario, ciascuno con il
  proprio nome (facoltativo). "Registra rifiuto" si abilita solo quando
  entrambe le firme sono valide.
-->
<script setup>
import { ref, computed } from "vue";
import Modal from "../ui/Modal.vue";
import SignaturePad from "./SignaturePad.vue";
import SigningSummary from "./SigningSummary.vue";
import { t } from "../i18n/index.js";

defineProps({
    busy:    { type: Boolean, default: false },
    summary: { type: Object, default: null }   // { title, lines } per SigningSummary
});

const emit = defineEmits(["cancel", "confirm"]);

const driverPad = ref(null);
const consigneePad = ref(null);
const driverValid = ref(false);
const consigneeValid = ref(false);
const driverName = ref("");
const consigneeName = ref("");
const bothValid = computed(() => driverValid.value && consigneeValid.value);

function clearAll() {
    driverPad.value.clear();
    consigneePad.value.clear();
}

function confirm() {
    if (driverPad.value.isValid() && consigneePad.value.isValid()) {
        emit("confirm", {
            driver:    { signature: driverPad.value.buildPayload(), signerName: driverName.value },
            consignee: { signature: consigneePad.value.buildPayload(), signerName: consigneeName.value }
        });
    }
}
</script>

<template>
    <Modal :title="t('signature.doubleTitle')" :busy="busy" @close="emit('cancel')">
        <SigningSummary v-if="summary" v-bind="summary" />

        <h3 class="pad-label">{{ t('signature.driver') }}</h3>
        <label class="field name" :class="{ 'is-disabled': busy }">
            <span class="field-label">{{ t('signature.nameLabel') }}</span>
            <input
                v-model="driverName"
                class="input"
                type="text"
                autocomplete="off"
                autocapitalize="words"
                :aria-label="t('signature.nameLabel') + ' — ' + t('role.driver')"
                :placeholder="t('signature.namePlaceholder')"
                :disabled="busy"
            >
        </label>
        <SignaturePad
            ref="driverPad"
            height="10rem"
            :aria-label="t('signature.driver')"
            @change="driverValid = $event"
        />

        <h3 class="pad-label">{{ t('signature.consignee') }}</h3>
        <label class="field name" :class="{ 'is-disabled': busy }">
            <span class="field-label">{{ t('signature.nameLabel') }}</span>
            <input
                v-model="consigneeName"
                class="input"
                type="text"
                autocomplete="off"
                autocapitalize="words"
                :aria-label="t('signature.nameLabel') + ' — ' + t('role.consignee')"
                :placeholder="t('signature.namePlaceholder')"
                :disabled="busy"
            >
        </label>
        <SignaturePad
            ref="consigneePad"
            height="10rem"
            :aria-label="t('signature.consignee')"
            @change="consigneeValid = $event"
        />
        <template #actions>
            <button type="button" class="btn btn-quiet clear" :disabled="busy" @click="clearAll">
                {{ t('signature.clear') }}
            </button>
            <button type="button" class="btn" :disabled="busy" @click="emit('cancel')">
                {{ t('app.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="!bothValid || busy" @click="confirm">
                <span v-if="busy" class="spinner" aria-hidden="true" />
                {{ t('signature.send') }}
            </button>
        </template>
    </Modal>
</template>

<style scoped>
/* Titolo di ciascuna firma, con il filetto forte che apre il blocco */
.pad-label {
    margin: 4px 0 8px;
    padding-top: 8px;
    border-top: 2px solid var(--ink);
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-md);
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.pad-label:not(:first-of-type) {
    margin-top: 18px;
}

.name {
    margin-bottom: 8px;
}

.clear {
    flex: 0 0 auto !important;
    padding: 0 10px;
}
</style>
