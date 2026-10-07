/**
 * Avvisi globali: toast (messaggio breve che sparisce da solo) e message box
 * (domanda con pulsanti, risolta con l'azione scelta). Gli host che li
 * disegnano sono montati una volta sola in App.vue.
 */

import { reactive } from "vue";

export const toastState = reactive({ items: [] });
let toastSeq = 0;

/**
 * @param {string} message
 * @param {"neutral"|"success"|"warning"|"danger"} [tone]
 */
export function toast(message, tone = "neutral") {
    const id = ++toastSeq;
    toastState.items.push({ id, message, tone });
    // Uno alla volta in vista: i più vecchi lasciano il posto.
    if (toastState.items.length > 2) {
        toastState.items.shift();
    }
    setTimeout(() => {
        const i = toastState.items.findIndex((x) => x.id === id);
        if (i !== -1) {
            toastState.items.splice(i, 1);
        }
    }, 3500);
}

export const messageBoxState = reactive({ current: null });

/**
 * Mostra una domanda e risolve con l'id dell'azione scelta.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {"neutral"|"warning"|"danger"} [options.tone]
 * @param {{id: string, label: string, primary?: boolean, danger?: boolean}[]} options.actions
 * @returns {Promise<string>}
 */
export function ask(options) {
    return new Promise((resolve) => {
        messageBoxState.current = {
            tone: "neutral",
            ...options,
            resolve: (actionId) => {
                messageBoxState.current = null;
                resolve(actionId);
            }
        };
    });
}
