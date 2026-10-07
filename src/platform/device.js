/**
 * Identità del dispositivo e dell'app, inviata insieme agli eventi: il
 * backend sa da quale palmare e con quale versione arriva ogni esito
 * (assistenza, audit, gestione di versioni diverse sul campo).
 *
 * deviceId è un UUID generato alla prima esecuzione e conservato sul device:
 * cambia solo se si cancellano i dati dell'app (insieme all'outbox).
 */

import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "delicon.deviceId";

/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

let _deviceId = null;

function _readOrCreateId() {
    try {
        let id = localStorage.getItem(STORAGE_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
    } catch {
        // Storage non disponibile: identificativo valido per la sola sessione.
        return crypto.randomUUID();
    }
}

export function getDeviceId() {
    if (!_deviceId) {
        _deviceId = _readOrCreateId();
    }
    return _deviceId;
}

/** @returns {{deviceId: string, appVersion: string, platform: string}} */
export function getDeviceInfo() {
    return {
        deviceId:   getDeviceId(),
        appVersion: APP_VERSION,
        platform:   Capacitor.getPlatform()   // "android" | "ios" | "web"
    };
}
