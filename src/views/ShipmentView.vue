<!--
  Trasporto: avanzamento e consegne in ordine di scarico. Da qui si apre una
  consegna, si consulta la traccia operazioni o si rifiuta una consegna intera
  (motivi → doppia firma).
-->
<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import AppHeader from "../ui/AppHeader.vue";
import StatusChip from "../ui/StatusChip.vue";
import Tally from "../ui/Tally.vue";
import ReasonsDialog from "../components/ReasonsDialog.vue";
import DoubleSignatureDialog from "../components/DoubleSignatureDialog.vue";
import TraceDialog from "../components/TraceDialog.vue";
import { t } from "../i18n/index.js";
import * as service from "../services/deliveryService.js";
import { getDeliveryRejectReasons } from "../config/rejectReasons.js";
import { syncVersion } from "../app/outbox.js";
import { syncAfterClosing } from "../app/deliveryFeedback.js";
import { ask } from "../ui/feedback.js";
import { statusView, syncView, reasonLabels, deliveriesTally, packagesTally } from "../ui/format.js";

const props = defineProps({
    shipmentId: { type: String, required: true }
});

const router = useRouter();

const loading = ref(true);
const data = ref(null);

// Rifiuto totale: consegna scelta → motivi → doppia firma.
const rejectTarget = ref(null);
const rejectReasons = ref([]);
const step = ref(null);          // null | "reasons" | "signatures"
const busy = ref(false);

const trace = ref(null);         // { title, items }

const summary = computed(() => data.value && data.value.summary);

// Intestazione: il numero del trasporto come titolo, "Trasporto · 2 consegne" sopra.
const headerSubtitle = computed(() => {
    const count = data.value ? data.value.deliveries.length : null;
    if (count === null) {
        return t("shipment.headerLabel");
    }
    return count === 1 ? t("shipment.headerSubtitleOne") : t("shipment.headerSubtitle", { count });
});

// Barre a tacche del cartiglio: esito di ogni consegna e di ogni collo.
const tallies = computed(() => {
    const deliveries = data.value ? data.value.deliveries : [];
    const d = deliveriesTally(deliveries);
    return {
        deliveries: { ok: d.ok, ko: d.ko, total: d.total },
        packages:   packagesTally(deliveries)
    };
});

// Cosa si firma nel rifiuto totale: consegna e motivi scelti.
const rejectSigningSummary = computed(() => {
    const d = rejectTarget.value;
    return d ? {
        title: t("signature.summaryConfirm", { name: d.consignee.name, note: d.deliveryNoteNumber }),
        lines: [{ text: t("signature.summaryRejectTotal", { reasons: reasonLabels(rejectReasons.value) }), tone: "danger" }]
    } : null;
});

async function load() {
    try {
        data.value = await service.loadShipment(props.shipmentId);
    } finally {
        loading.value = false;
    }
}

/** Ordine di scarico a due cifre ("01"), "–" se non definito. */
function sequenceLabel(sequence) {
    return sequence == null ? "–" : String(sequence).padStart(2, "0");
}

function goHome() {
    router.replace({ name: "home" });
}

function openDelivery(d) {
    router.push({ name: "delivery", params: { shipmentId: d.shipmentId, deliveryId: d.deliveryId } });
}

function startReject(d) {
    if (d.isClosed) {
        return;
    }
    rejectTarget.value = d;
    step.value = "reasons";
}

function onReasons(codes) {
    rejectReasons.value = codes;
    step.value = "signatures";
}

function cancelReject() {
    step.value = null;
    rejectTarget.value = null;
}

async function onSignatures(signatures) {
    const d = rejectTarget.value;
    busy.value = true;
    try {
        await service.rejectDelivery(d.shipmentId, d.deliveryId, rejectReasons.value, signatures);
    } catch (err) {
        busy.value = false;
        await ask({
            title: t("shipment.rejectFailed"),
            message: (err && err.message) || String(err),
            tone: "danger",
            actions: [{ id: "ok", label: t("app.ok"), primary: true }]
        });
        return;
    }
    busy.value = false;
    cancelReject();
    await load();
    // Chiusura locale fatta: ora l'invio, che non la annulla se fallisce.
    await syncAfterClosing(d.shipmentId, d.deliveryId);
    await load();
}

async function showTrace(d) {
    trace.value = {
        title: t("trace.title", { name: d.consignee.name || d.deliveryId }),
        items: await service.getTrace(d.shipmentId, d.deliveryId)
    };
}

onMounted(load);
watch(() => props.shipmentId, load);
watch(syncVersion, load);
</script>

<template>
    <AppHeader
        :title="shipmentId"
        :subtitle="headerSubtitle"
        back
        @back="goHome"
    />

    <main class="page">
        <p v-if="loading" class="muted">{{ t('app.loading') }}</p>

        <section v-else-if="!data" class="sheet bleed empty">
            <p>{{ t('shipment.notFound') }}</p>
            <button type="button" class="btn btn-primary" @click="goHome">{{ t('app.back') }}</button>
        </section>

        <template v-else>
            <!-- Cartiglio: avanzamento del trasporto -->
            <section class="sheet bleed cells stats" :aria-label="t('shipment.progress')">
                <div class="cell">
                    <span class="cell-label">{{ t('shipment.deliveriesClosed') }}</span>
                    <span class="cell-value">{{ summary.deliveriesClosed }}<small>/{{ summary.deliveriesTotal }}</small></span>
                    <Tally class="stat__tally" v-bind="tallies.deliveries" />
                </div>
                <div class="cell">
                    <span class="cell-label">{{ t('shipment.packagesScanned') }}</span>
                    <span class="cell-value">{{ summary.packagesScanned }}<small>/{{ summary.packagesExpected }}</small></span>
                    <Tally class="stat__tally" v-bind="tallies.packages" />
                </div>
            </section>

            <h2 class="section-title">
                <span>{{ t('shipment.deliveriesTitle') }}</span>
                <span class="num">{{ data.deliveries.length }}</span>
            </h2>
            <p v-if="data.deliveries.length === 0" class="hint">{{ t('shipment.empty') }}</p>

            <ul v-else class="sheet rows bleed deliveries">
                <li v-for="d in data.deliveries" :key="d.deliveryId">
                    <article class="delivery" :class="{ 'is-closed': d.isClosed }">
                        <button type="button" class="delivery__main" @click="openDelivery(d)">
                            <span class="seq" aria-hidden="true">{{ sequenceLabel(d.sequence) }}</span>
                            <span class="delivery__body">
                                <span class="delivery__name">{{ d.consignee.name }}</span>
                                <span class="delivery__meta">
                                    {{ d.consignee.city }} · {{ t('delivery.deliveryNote', { number: d.deliveryNoteNumber }) }}
                                </span>
                                <span class="marks">
                                    <StatusChip v-bind="statusView(d.status)" />
                                    <StatusChip v-if="syncView(d.syncState)" v-bind="syncView(d.syncState)" />
                                </span>
                            </span>
                            <span class="count">
                                <strong>{{ d.scannedCount }}/{{ d.expectedCount }}</strong>
                                <small>{{ t('shipment.packagesUnit') }}</small>
                            </span>
                        </button>
                        <div class="delivery__actions">
                            <button
                                type="button"
                                class="btn"
                                :class="{ 'btn-attention': d.hasExceptions }"
                                @click="showTrace(d)"
                            >
                                {{ t('shipment.trace') }}
                            </button>
                            <button
                                type="button"
                                class="btn btn-danger"
                                :disabled="d.isClosed"
                                @click="startReject(d)"
                            >
                                {{ t('shipment.reject') }}
                            </button>
                        </div>
                    </article>
                </li>
            </ul>
        </template>
    </main>

    <ReasonsDialog
        v-if="step === 'reasons'"
        :title="t('shipment.rejectReasonsTitle')"
        :reasons="getDeliveryRejectReasons()"
        @cancel="cancelReject"
        @confirm="onReasons"
    />
    <DoubleSignatureDialog
        v-if="step === 'signatures'"
        :busy="busy"
        :summary="rejectSigningSummary"
        @cancel="cancelReject"
        @confirm="onSignatures"
    />
    <TraceDialog
        v-if="trace"
        :title="trace.title"
        :items="trace.items"
        @close="trace = null"
    />
</template>

<style scoped>
.empty {
    padding: 16px var(--gutter);
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
}

.stats {
    grid-template-columns: 1fr 1fr;
}

.stat__tally {
    margin-top: 8px;
}

.delivery__main {
    width: 100%;
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: start;
    gap: 0 10px;
    padding: 12px var(--gutter) 12px 8px;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.delivery__main:active {
    background: var(--sheet-2);
}

/* Numero d'ordine di scarico, come la colonna "n." di una distinta */
.seq {
    padding-top: 2px;
    text-align: center;
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-xl);
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.delivery.is-closed .seq {
    color: var(--ink-2);
}

.delivery__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.delivery__name {
    font-weight: 600;
    font-size: 1.125rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
}

.delivery__meta {
    font-size: 0.875rem;
    color: var(--ink-2);
}

.marks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 7px;
}

/* Azioni della consegna: striscia di due comandi sotto la riga */
.delivery__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 1px solid var(--hair);
}

.delivery__actions .btn {
    min-height: 48px;
    border: 0;
    background: transparent;
    font-size: var(--fs-sm);
}

.delivery__actions .btn + .btn {
    border-left: 1px solid var(--hair);
}

.delivery__actions .btn:active:not(:disabled) {
    background: var(--sheet-2);
}

.delivery__actions .btn:disabled {
    opacity: 1;
    color: var(--dim);
}

.btn-attention {
    color: var(--warn-ink);
}
</style>
