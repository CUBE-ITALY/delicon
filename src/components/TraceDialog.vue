<!-- Traccia delle operazioni sulla consegna, ricostruita dagli eventi. -->
<script setup>
import { computed } from "vue";
import Modal from "../ui/Modal.vue";
import Icon from "../ui/Icon.vue";
import { t } from "../i18n/index.js";
import { reasonLabels, signerRoleLabel, formatTime } from "../ui/format.js";
import { EventType } from "../domain/model.js";
import CodeText from "../ui/CodeText.vue";
import StatusChip from "../ui/StatusChip.vue";

const props = defineProps({
    title: { type: String, required: true },
    items: { type: Array, required: true }   // output di deliveryService.getTrace
});

const emit = defineEmits(["close"]);

const VIEW = {
    [EventType.PACKAGE_SCANNED]:        { icon: "check", tone: "success" },
    [EventType.PACKAGE_SCAN_CANCELLED]: { icon: "undo",  tone: "neutral" },
    [EventType.PACKAGE_REJECTED]:       { icon: "x",     tone: "danger" },
    [EventType.DELIVERY_CONFIRMED]:     { icon: "check", tone: "success" },
    [EventType.DELIVERY_SIGNED]:        { icon: "pen",   tone: "info" },
    [EventType.DELIVERY_REJECTED]:      { icon: "ban",   tone: "danger" }
};

const rows = computed(() => props.items.map((e) => ({
    key:  e.eventId,
    time: formatTime(e.occurredAt),
    text: t("trace." + e.type, {
        id:      e.packageId,
        reasons: reasonLabels(e.reasons),
        role:    e.signerName ? `${signerRoleLabel(e.signerRole)}: ${e.signerName}` : signerRoleLabel(e.signerRole)
    }),
    sync: t("trace.sync." + (e.syncStatus || "pending")),
    syncTone: e.syncStatus === "synced" ? "success" : e.syncStatus === "error" ? "danger" : "neutral",
    ...(VIEW[e.type] || { icon: "box", tone: "neutral" })
})));
</script>

<template>
    <Modal :title="title" @close="emit('close')">
        <p v-if="rows.length === 0" class="muted">{{ t('trace.empty') }}</p>
        <ol v-else class="trace">
            <li v-for="row in rows" :key="row.key" class="trace__row">
                <span class="trace__icon" :class="'tone-' + row.tone"><Icon :name="row.icon" :size="18" /></span>
                <div class="trace__body">
                    <p class="trace__text"><CodeText :text="row.text" /></p>
                    <p class="trace__meta">
                        <span class="trace__time">{{ row.time }}</span>
                        <StatusChip :label="row.sync" :tone="row.syncTone === 'neutral' ? 'pending' : row.syncTone" />
                    </p>
                </div>
            </li>
        </ol>
        <template #actions>
            <button type="button" class="btn btn-primary" @click="emit('close')">{{ t('app.close') }}</button>
        </template>
    </Modal>
</template>

<style scoped>
.trace {
    list-style: none;
    margin: 0 calc(-1 * var(--gutter));
    padding: 0;
    border-top: 1px solid var(--hair);
    border-bottom: 1px solid var(--hair);
}

.trace__row {
    display: flex;
    gap: 12px;
    padding: 10px var(--gutter);
}

.trace__row + .trace__row {
    border-top: 1px solid var(--hair);
}

/* Casella dell'operazione: piena per gli esiti, vuota per le correzioni */
.trace__icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 2px solid var(--ink-2);
    color: var(--ink-2);
}

.trace__icon.tone-success { background: var(--ok); border-color: var(--ok); color: var(--on-state); }
.trace__icon.tone-danger  { background: var(--ko); border-color: var(--ko); color: var(--on-state); }
.trace__icon.tone-info    { background: var(--ink); border-color: var(--ink); color: var(--sheet); }

.trace__body {
    min-width: 0;
}

.trace__text {
    font-weight: 600;
    overflow-wrap: anywhere;
}

.trace__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin-top: 2px;
}

.trace__time {
    font-family: var(--font-cond);
    font-weight: 600;
    font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
}
</style>
