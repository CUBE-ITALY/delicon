/**
 * Tema chiaro/scuro. Di default segue il sistema; la scelta manuale
 * dell'operatore (es. al sole) viene ricordata sul device. Nell'app nativa
 * allinea anche le icone della barra di stato.
 */

import { ref } from "vue";
import { setSystemBarsForTheme } from "../platform/nativeApp.js";

const STORAGE_KEY = "delicon.theme";

const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

function readStored() {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return value === "light" || value === "dark" ? value : null;
    } catch {
        return null;
    }
}

/** Tema effettivo: "light" | "dark". */
export const theme = ref(readStored() || (darkQuery && darkQuery.matches ? "dark" : "light"));

function apply() {
    if (readStored()) {
        document.documentElement.setAttribute("data-theme", theme.value);
    } else {
        document.documentElement.removeAttribute("data-theme"); // decide il CSS col tema di sistema
    }
    setSystemBarsForTheme(theme.value === "dark");
}

export function initTheme() {
    apply();
    // Senza scelta manuale si segue il sistema anche quando cambia a app aperta.
    if (darkQuery) {
        darkQuery.addEventListener("change", (e) => {
            if (!readStored()) {
                theme.value = e.matches ? "dark" : "light";
                apply();
            }
        });
    }
}

export function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
    try {
        localStorage.setItem(STORAGE_KEY, theme.value);
    } catch {
        /* storage non disponibile: la scelta vale per la sessione */
    }
    document.documentElement.setAttribute("data-theme", theme.value);
    setSystemBarsForTheme(theme.value === "dark");
}
