/**
 * Integrazione con l'app nativa (Capacitor): tasto indietro hardware, ritorno
 * in primo piano, colore delle icone di sistema. In browser ogni funzione è
 * un no-op, così il resto dell'app non deve distinguere gli ambienti.
 */

import { SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core";
import { App } from "@capacitor/app";
import { isNative } from "./env.js";

/**
 * Registra il gestore del tasto indietro di Android. Con un listener attivo
 * Capacitor non esegue più il comportamento predefinito (indietro nella
 * cronologia del WebView o chiusura dell'app): decide tutto il gestore.
 * @param {() => void} handler
 */
export function onBackButton(handler) {
    if (isNative()) {
        App.addListener("backButton", handler);
    }
}

/** @param {() => void} callback chiamata quando l'app torna in primo piano */
export function onAppResume(callback) {
    if (isNative()) {
        App.addListener("resume", callback);
    }
}

/** Manda l'app in background (come il tasto Home), senza chiuderla. */
export function minimizeApp() {
    if (isNative()) {
        App.minimizeApp();
    }
}

/**
 * Icone delle barre di sistema leggibili sull'app. La barra di stato sta
 * sopra l'intestazione, scura in entrambi i temi: icone sempre chiare.
 * La barra di navigazione sta sopra la pagina: icone chiare sul tema scuro,
 * scure sul tema chiaro.
 * @param {boolean} darkTheme
 */
export function setSystemBarsForTheme(darkTheme) {
    if (isNative()) {
        SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar })
            .catch(() => { /* non critico */ });
        SystemBars.setStyle({ style: darkTheme ? SystemBarsStyle.Dark : SystemBarsStyle.Light, bar: SystemBarType.NavigationBar })
            .catch(() => { /* non critico */ });
    }
}
