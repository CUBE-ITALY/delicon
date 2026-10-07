<!--
  Foto dei colli della consegna, come le firme. Finché la consegna è aperta
  (editable) ogni foto si può eliminare; dopo la conferma solo consultazione.
-->
<script setup>
import { computed } from "vue";
import Modal from "../ui/Modal.vue";
import CodeText from "../ui/CodeText.vue";
import Icon from "../ui/Icon.vue";
import { t } from "../i18n/index.js";
import { formatTime, reasonLabels } from "../ui/format.js";

const props = defineProps({
    photos:   { type: Array, required: true },   // deliveryService.getPhotos
    packages: { type: Array, required: true },   // stato dei colli (Projection), per descrizione e motivi
    editable: { type: Boolean, default: false },  // consegna aperta: si può eliminare
    busy:     { type: Boolean, default: false }
});

const emit = defineEmits(["close", "remove"]);

const items = computed(() => props.photos.map((p) => {
    const pkg = props.packages.find((x) => x.packageId === p.packageId);
    const detail = [pkg && pkg.description, pkg && pkg.rejected ? `${t("delivery.packageRejected")}: ${reasonLabels(pkg.rejectReasons)}` : ""]
        .filter(Boolean)
        .join(" · ");
    return { ...p, detail };
}));
</script>

<template>
    <Modal :title="t('photo.viewTitle')" wide @close="emit('close')">
        <p v-if="items.length === 0" class="muted">{{ t('photo.none') }}</p>
        <figure v-for="item in items" :key="item.eventId" class="shot">
            <figcaption class="shot__caption">
                <span class="shot__id"><CodeText :text="t('delivery.alreadyScannedTitle', { id: item.packageId })" /></span>
                <span class="shot__time">{{ formatTime(item.occurredAt) }}</span>
            </figcaption>
            <p v-if="item.detail" class="shot__detail">{{ item.detail }}</p>
            <img :src="item.photo.image" :alt="t('photo.title')" class="shot__image">
            <div v-if="editable" class="shot__actions">
                <button type="button" class="btn btn-danger" :disabled="busy" @click="emit('remove', item)">
                    <Icon name="x" :size="20" />
                    {{ t('photo.remove') }}
                </button>
            </div>
        </figure>
        <template #actions>
            <button type="button" class="btn btn-primary" @click="emit('close')">{{ t('app.close') }}</button>
        </template>
    </Modal>
</template>

<style scoped>
.shot {
    margin: 0 0 18px;
}

.shot__caption {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
    border-top: 2px solid var(--ink);
    font-weight: 600;
}

.shot__id {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-lg);
    font-variant-numeric: tabular-nums;
}

.shot__time {
    flex: none;
    font-family: var(--font-cond);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
}

.shot__detail {
    margin-bottom: 6px;
    font-size: var(--fs-sm);
    color: var(--ink-2);
    overflow-wrap: anywhere;
}

.shot__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
}

.shot__image {
    display: block;
    width: 100%;
    border: 2px solid var(--ink);
    background: var(--sheet-2);
}
</style>
