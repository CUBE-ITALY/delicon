/**
 * Tastiera a schermo su richiesta, per i campi letti dallo scanner.
 *
 * Lo scanner (DataWedge in modalità tastiera) scrive nel campo a fuoco senza
 * bisogno della tastiera a schermo, che anzi copre metà schermata e, mentre
 * si apre, può far perdere una lettura ravvicinata. Il campo ha quindi
 * inputmode="none": resta a fuoco e riceve i codici, ma la tastiera non
 * compare. Un pulsante nel campo la mostra quando serve digitare a mano;
 * dopo l'invio del codice o all'uscita dal campo si torna senza tastiera.
 */

import { ref, computed, nextTick } from "vue";

/**
 * @param {import("vue").Ref<HTMLInputElement|null>} inputRef campo del codice
 */
export function useSoftKeyboard(inputRef) {
    const enabled = ref(false);
    /** Valore per l'attributo inputmode del campo. */
    const inputMode = computed(() => (enabled.value ? "text" : "none"));

    let refocusing = false;

    // inputmode vale alla presa di fuoco: si toglie e si rimette il fuoco al campo.
    async function refocus() {
        const el = inputRef.value;
        if (!el) {
            return;
        }
        refocusing = true;
        el.blur();
        await nextTick();
        el.focus();
        refocusing = false;
    }

    /** Pulsante nel campo: mostra o nasconde la tastiera. */
    async function toggle() {
        enabled.value = !enabled.value;
        await refocus();
    }

    /** Dopo l'invio di un codice: di nuovo senza tastiera, il fuoco resta nel campo. */
    async function reset() {
        if (!enabled.value) {
            return;
        }
        enabled.value = false;
        if (inputRef.value && document.activeElement === inputRef.value) {
            await refocus();
        }
    }

    /** Da collegare all'evento blur del campo: chi esce dal campo chiude la tastiera. */
    function onBlur() {
        if (!refocusing) {
            enabled.value = false;
        }
    }

    return { enabled, inputMode, toggle, reset, onBlur };
}
