<!-- Firme acquisite per la consegna, in sola lettura. -->
<script setup>
import Modal from "../ui/Modal.vue";
import { t } from "../i18n/index.js";
import { signerRoleLabel, formatTime } from "../ui/format.js";

defineProps({
    signatures: { type: Array, required: true }   // [{ signerRole, signerName, signature, occurredAt }]
});

const emit = defineEmits(["close"]);
</script>

<template>
    <Modal :title="t('signature.viewTitle')" wide @close="emit('close')">
        <p v-if="signatures.length === 0" class="muted">{{ t('signature.none') }}</p>
        <figure v-for="(s, i) in signatures" :key="i" class="signature">
            <figcaption class="signature__role">
                <span>{{ signerRoleLabel(s.signerRole) }}<template v-if="s.signerName">: {{ s.signerName }}</template></span>
                <span class="signature__time">{{ formatTime(s.occurredAt) }}</span>
            </figcaption>
            <img :src="s.signature.image" :alt="signerRoleLabel(s.signerRole)" class="signature__image">
            <p class="signature__info">
                {{ t('signature.info', {
                    strokes: s.signature.strokeCount === 1
                        ? t('signature.strokesOne')
                        : t('signature.strokesMany', { count: s.signature.strokeCount }),
                    points: s.signature.pointCount,
                    seconds: ((s.signature.durationMs || 0) / 1000).toFixed(1)
                }) }}
            </p>
        </figure>
        <template #actions>
            <button type="button" class="btn btn-primary" @click="emit('close')">{{ t('app.close') }}</button>
        </template>
    </Modal>
</template>

<style scoped>
.signature {
    margin: 0 0 18px;
}

.signature__role {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    padding-top: 8px;
    border-top: 2px solid var(--ink);
    font-weight: 600;
    overflow-wrap: anywhere;
}

.signature__time {
    flex: none;
    font-family: var(--font-cond);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
}

/* Fondo bianco anche nel tema scuro: è l'immagine salvata */
.signature__image {
    display: block;
    width: 100%;
    border: 2px solid var(--ink);
    background: #ffffff;
}

.signature__info {
    margin-top: 6px;
    font-family: var(--font-cond);
    font-weight: 500;
    font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
}
</style>
