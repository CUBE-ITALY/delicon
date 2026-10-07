<!--
  Home: download di un trasporto (scanner in modalità tastiera o digitazione)
  ed elenco dei trasporti già sul dispositivo, apribili anche senza rete.
-->
<script setup>
import { ref, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import AppHeader from "../ui/AppHeader.vue";
import Icon from "../ui/Icon.vue";
import StatusChip from "../ui/StatusChip.vue";
import CodeText from "../ui/CodeText.vue";
import Tally from "../ui/Tally.vue";
import { t } from "../i18n/index.js";
import { appConfig } from "../config/appConfig.js";
import * as service from "../services/deliveryService.js";
import { flushOutbox, syncVersion } from "../app/outbox.js";
import { ask } from "../ui/feedback.js";
import { useSoftKeyboard } from "../ui/softKeyboard.js";
import { formatDateTime, deliveriesTally } from "../ui/format.js";
import { APP_VERSION, getDeviceId } from "../platform/device.js";

// Per l'assistenza: versione e prime cifre dell'identificativo del palmare.
const deviceTag = getDeviceId().slice(0, 8);

const router = useRouter();

const shipmentInput = ref("");
const input = ref(null);
// Tastiera a schermo solo su richiesta: lo scanner scrive nel campo senza.
const {
    enabled: keyboardOn,
    inputMode: shipmentInputMode,
    toggle: toggleKeyboard,
    reset: resetKeyboard,
    onBlur: onShipmentBlur
} = useSoftKeyboard(input);
const invalid = ref(false);
const downloading = ref(false);
const shipments = ref([]);

async function loadShipments() {
    const list = await service.listShipments();
    // Avanzamento di ciascun trasporto: ricostruito dagli eventi, solo lettura locale.
    shipments.value = await Promise.all(list.map(async (s) => {
        const state = await service.loadShipment(s.shipmentId);
        return {
            ...s,
            summary: state ? state.summary : null,
            tally:   state ? deliveriesTally(state.deliveries) : null
        };
    }));
}

function openShipment(shipmentId) {
    router.push({ name: "shipment", params: { shipmentId } });
}

function errorMessage(err, id) {
    if (err && err.code === "NOT_FOUND") {
        return t("home.errorNotFound", { id });
    }
    if (err && err.isNetworkError) {
        return shipments.value.some((s) => s.shipmentId === id)
            ? t("home.errorNetworkOffline")
            : t("home.errorNetwork");
    }
    return (err && err.message) || String(err);
}

async function download() {
    const id = shipmentInput.value.trim();
    if (!id) {
        invalid.value = true;
        input.value.focus();
        return;
    }
    invalid.value = false;
    resetKeyboard();

    // Ripete finché il download riesce o l'operatore rinuncia.
    for (;;) {
        downloading.value = true;
        try {
            const savedId = await service.downloadShipment(id);
            downloading.value = false;
            // Download riuscito = backend raggiungibile ora: buon momento per
            // inviare eventuali esiti rimasti in attesa.
            flushOutbox();
            shipmentInput.value = "";
            openShipment(savedId);
            return;
        } catch (err) {
            downloading.value = false;
            const retryable = !(err && err.code === "NOT_FOUND");
            const choice = await ask({
                title: t("home.errorTitle"),
                message: errorMessage(err, id),
                tone: "danger",
                actions: retryable
                    ? [{ id: "cancel", label: t("app.cancel") }, { id: "retry", label: t("app.retry"), primary: true }]
                    : [{ id: "ok", label: t("app.ok"), primary: true }]
            });
            if (choice !== "retry") {
                await nextTick();
                input.value && input.value.select();
                return;
            }
        }
    }
}

function useDemo() {
    shipmentInput.value = appConfig.demoShipmentId;
    download();
}

onMounted(async () => {
    input.value.focus();
    await loadShipments();
});

watch(syncVersion, loadShipments);
</script>

<template>
    <AppHeader :title="t('app.name')" brand />

    <main class="page">
        <h2 class="section-title">{{ t('home.title') }}</h2>
        <p class="hint">{{ t('home.hint') }}</p>

        <form class="download" novalidate @submit.prevent="download">
            <label
                class="field"
                :class="{ 'is-invalid': invalid, 'is-disabled': downloading }"
                for="shipment-input"
            >
                <span class="field-label">{{ t('home.inputLabel') }}</span>
                <span class="field__row">
                    <input
                        id="shipment-input"
                        ref="input"
                        v-model="shipmentInput"
                        class="input mono"
                        type="text"
                        :inputmode="shipmentInputMode"
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        enterkeyhint="go"
                        :placeholder="t('home.inputPlaceholder', { example: appConfig.demoShipmentId })"
                        :aria-invalid="invalid"
                        :disabled="downloading"
                        @blur="onShipmentBlur"
                    >
                    <button
                        type="button"
                        class="field__key"
                        :class="{ 'is-on': keyboardOn }"
                        :aria-pressed="keyboardOn"
                        :aria-label="keyboardOn ? t('app.keyboardHide') : t('app.keyboardShow')"
                        :disabled="downloading"
                        @pointerdown.prevent
                        @mousedown.prevent
                        @click="toggleKeyboard"
                    >
                        <Icon name="keyboard" :size="22" />
                    </button>
                </span>
            </label>
            <p v-if="invalid" class="error-text">{{ t('home.required') }}</p>

            <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="downloading">
                <span v-if="downloading" class="spinner" aria-hidden="true" />
                {{ downloading ? t('home.downloading') : t('home.download') }}
            </button>

            <button
                v-if="appConfig.backend === 'mock'"
                type="button"
                class="link"
                :disabled="downloading"
                @click="useDemo"
            >
                {{ t('home.useDemo', { id: appConfig.demoShipmentId }) }}
            </button>
        </form>

        <h2 class="section-title on-device-title">
            <span>{{ t('home.onDevice') }}</span>
            <span v-if="shipments.length" class="num">{{ shipments.length }}</span>
        </h2>
        <p v-if="shipments.length === 0" class="hint">{{ t('home.onDeviceEmpty') }}</p>
        <ul v-else class="sheet rows bleed">
            <li v-for="s in shipments" :key="s.shipmentId">
                <button type="button" class="shipment" @click="openShipment(s.shipmentId)">
                    <span class="shipment__body">
                        <span class="shipment__id"><CodeText :text="s.shipmentId" /></span>
                        <span class="shipment__meta">{{ t('home.downloadedAt', { when: formatDateTime(s.downloadedAt) }) }}</span>
                        <span v-if="s.tally && (s.tally.toSend || s.tally.sendErrors)" class="shipment__marks">
                            <StatusChip v-if="s.tally.toSend" :label="t('home.toSend', { count: s.tally.toSend })" tone="pending" />
                            <StatusChip v-if="s.tally.sendErrors" :label="t('home.sendErrors', { count: s.tally.sendErrors })" tone="danger" />
                        </span>
                    </span>
                    <span
                        v-if="s.summary"
                        class="count"
                        :aria-label="t('home.deliveriesProgress', { closed: s.summary.deliveriesClosed, total: s.summary.deliveriesTotal })"
                    >
                        <strong>{{ s.summary.deliveriesClosed }}/{{ s.summary.deliveriesTotal }}</strong>
                        <small>{{ t('home.deliveriesUnit') }}</small>
                    </span>
                    <Tally v-if="s.tally" class="shipment__tally" :ok="s.tally.ok" :ko="s.tally.ko" :total="s.tally.total" />
                </button>
            </li>
        </ul>

        <p class="about">{{ t('home.about', { version: APP_VERSION, device: deviceTag }) }}</p>
    </main>
</template>

<style scoped>
.download {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.error-text {
    color: var(--ko);
    font-weight: 600;
    margin-top: -4px;
}

.on-device-title {
    margin-top: 10px;
}

.shipment {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0 12px;
    padding: 12px var(--gutter) 14px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.shipment:active {
    background: var(--sheet-2);
}

.shipment__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.shipment__id {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-xl);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}

.shipment__meta {
    font-size: 0.875rem;
    color: var(--ink-2);
}

.shipment__marks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 6px;
}

.shipment__tally {
    grid-column: 1 / -1;
    margin-top: 10px;
}

.about {
    margin-top: auto;
    padding-top: 24px;
    font-family: var(--font-cond);
    font-weight: 500;
    font-size: var(--fs-xs);
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
}
</style>
