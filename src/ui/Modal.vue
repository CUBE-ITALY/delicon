<!--
  Finestra modale accessibile, a pannello che sale dal basso (a portata di
  pollice): titolo, contenuto scorrevole, azioni in fondo. Spigoli vivi.
  Esc o tocco sullo sfondo chiudono solo se dismissible.
  `wide` resta per compatibilità: il pannello è già largo quanto la pagina.
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import { pushModal } from "./modalStack.js";
import CodeText from "./CodeText.vue";

const props = defineProps({
    title:       { type: String, required: true },
    dismissible: { type: Boolean, default: true },
    busy:        { type: Boolean, default: false },
    wide:        { type: Boolean, default: false }
});

const emit = defineEmits(["close"]);
const panel = ref(null);
const titleId = "modal-title-" + Math.random().toString(36).slice(2, 8);

function requestClose() {
    if (props.dismissible && !props.busy) {
        emit("close");
    }
}

function onKeydown(e) {
    if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
    }
}

let previousOverflow = "";
// Il tasto indietro di Android chiude il dialog in cima alla pila.
const removeFromStack = pushModal(requestClose);

onMounted(async () => {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    await nextTick();
    // Focus sul pannello: lo scanner in modalità tastiera non scrive più nel
    // campo sottostante mentre il dialog è aperto.
    panel.value && panel.value.focus();
});

onBeforeUnmount(() => {
    removeFromStack();
    document.body.style.overflow = previousOverflow;
});
</script>

<template>
    <Teleport to="body">
        <div class="modal-scrim" @click.self="requestClose" @keydown="onKeydown">
            <section
                ref="panel"
                class="modal"
                :class="{ 'modal--wide': wide }"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="titleId"
                :aria-busy="busy"
                tabindex="-1"
            >
                <header class="modal__header">
                    <h2 :id="titleId" class="modal__title"><CodeText :text="title" /></h2>
                </header>
                <div class="modal__body">
                    <slot />
                </div>
                <footer v-if="$slots.actions" class="modal__actions">
                    <slot name="actions" />
                </footer>
            </section>
        </div>
    </Teleport>
</template>

<style scoped>
.modal-scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--scrim);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-top: calc(24px + env(safe-area-inset-top));
}

.modal {
    width: 100%;
    max-width: var(--page-max);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--sheet);
    border-top: 3px solid var(--ink);
    padding-bottom: env(safe-area-inset-bottom);
    outline: none;
    animation: sheet-in 0.18s ease-out;
}

.modal__header {
    padding: 14px var(--gutter) 10px;
}

.modal__title {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: var(--fs-xl);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
}

.modal__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px var(--gutter) 14px;
}

.modal__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px var(--gutter) 14px;
    border-top: 1px solid var(--hair);
}

.modal__actions :deep(.btn) {
    flex: 1 1 0;
}

/* L'azione principale è un po' più larga delle altre */
.modal__actions :deep(.btn-primary) {
    flex-grow: 1.4;
}

@keyframes sheet-in {
    from { transform: translateY(24px); opacity: 0; }
    to   { transform: none; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .modal { animation: none; }
}
</style>
