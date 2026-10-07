<!-- Disegna toast e message box globali (vedi feedback.js). -->
<script setup>
import Modal from "./Modal.vue";
import Icon from "./Icon.vue";
import CodeText from "./CodeText.vue";
import { toastState, messageBoxState } from "./feedback.js";

const TONE_ICON = { success: "check", warning: "alert", danger: "x", neutral: "" };

function choose(actionId) {
    messageBoxState.current && messageBoxState.current.resolve(actionId);
}

function dismiss() {
    const box = messageBoxState.current;
    if (!box) {
        return;
    }
    // Esc / sfondo = azione di uscita (l'ultima non primaria, altrimenti la prima).
    const exit = [...box.actions].reverse().find((a) => !a.primary) || box.actions[0];
    choose(exit.id);
}
</script>

<template>
    <div class="toasts" role="status" aria-live="polite">
        <TransitionGroup name="toast">
            <div v-for="item in toastState.items" :key="item.id" class="toast" :class="'toast--' + item.tone">
                <span class="toast__mark" aria-hidden="true">
                    <Icon v-if="TONE_ICON[item.tone]" :name="TONE_ICON[item.tone]" :size="16" />
                </span>
                <span><CodeText :text="item.message" /></span>
            </div>
        </TransitionGroup>
    </div>

    <Modal
        v-if="messageBoxState.current"
        :title="messageBoxState.current.title"
        @close="dismiss"
    >
        <p class="message" :class="'message--' + messageBoxState.current.tone">
            <span v-if="TONE_ICON[messageBoxState.current.tone]" class="message__mark" aria-hidden="true">
                <Icon :name="TONE_ICON[messageBoxState.current.tone]" :size="18" />
            </span>
            <span><CodeText :text="messageBoxState.current.message" /></span>
        </p>
        <template #actions>
            <button
                v-for="action in messageBoxState.current.actions"
                :key="action.id"
                type="button"
                class="btn"
                :class="{ 'btn-primary': action.primary, 'btn-danger': action.danger }"
                @click="choose(action.id)"
            >
                {{ action.label }}
            </button>
        </template>
    </Modal>
</template>

<style scoped>
/* In alto, sotto l'intestazione: così non copre mai la barra azioni né i
   pulsanti dei dialog (i tocchi lo attraversano comunque). */
.toasts {
    position: fixed;
    left: 0;
    right: 0;
    top: calc(var(--head-h) + 4px + env(safe-area-inset-top));
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 0 var(--gutter);
    pointer-events: none;
}

/* Fascia d'inchiostro con il quadrato dell'esito a sinistra */
.toast {
    display: flex;
    align-items: stretch;
    max-width: calc(var(--page-max) - 2 * var(--gutter));
    width: 100%;
    background: var(--ink);
    color: var(--sheet);
    font-weight: 600;
    line-height: 1.3;
}

.toast > span:last-child {
    padding: 12px 14px;
}

.toast__mark {
    flex: none;
    width: 10px;
    display: grid;
    place-items: center;
    background: var(--ink-2);
    color: var(--on-state);
}

.toast--success .toast__mark,
.toast--warning .toast__mark,
.toast--danger .toast__mark {
    width: 36px;
}

.toast--success .toast__mark { background: var(--ok); }
.toast--warning .toast__mark { background: var(--warn); color: var(--on-warn); }
.toast--danger  .toast__mark { background: var(--ko); }

.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }

.message {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    font-size: var(--fs-md);
    overflow-wrap: anywhere;
}

.message__mark {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-top: -2px;
    color: var(--on-state);
}

.message--success .message__mark { background: var(--ok); }
.message--warning .message__mark { background: var(--warn); color: var(--on-warn); }
.message--danger  .message__mark { background: var(--ko); }
</style>
