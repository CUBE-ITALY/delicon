/**
 * Layer HTTP unico dell'app.
 *
 * In nativo usa CapacitorHttp con chiamata esplicita (MAI il patching globale
 * di fetch/XHR): la richiesta parte dal layer Android e non è soggetta al
 * CORS della WebView. In browser usa fetch.
 *
 * Contratto comune ai due rami:
 *   - risolve SEMPRE con { status, headers, json }, anche per 4xx/5xx
 *     (json = null se il body manca o non è JSON);
 *   - rigetta SOLO per errori di trasporto (rete, TLS, DNS, timeout) con un
 *     Error marcato isNetworkError = true.
 * Nessun log di header o credenziali.
 */

import { CapacitorHttp } from "@capacitor/core";
import { isNative } from "./env.js";

export function networkError(message = "Server non raggiungibile") {
    const err = new Error(message);
    err.isNetworkError = true;
    return err;
}

/**
 * Rete di sicurezza sul timeout: se la richiesta non si risolve entro ms
 * rigetta come errore di rete (caso tipico: VPN o backend giù con pacchetti
 * persi, che resterebbero appesi al lungo timeout TCP di sistema).
 */
function _withTimeout(promise, ms) {
    if (!ms) {
        return promise;
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(networkError("Timeout della richiesta")), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (err)   => { clearTimeout(timer); reject(err); }
        );
    });
}

function _parseJsonSafe(text) {
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function _requestNative({ method, url, headers, body, timeoutMs }) {
    const req = { method, url, headers: headers || {}, data: body };
    if (timeoutMs) {
        req.connectTimeout = timeoutMs;
        req.readTimeout    = timeoutMs;
    }
    return _withTimeout(
        CapacitorHttp.request(req).then(
            (res) => ({
                status:  res.status,
                headers: res.headers || {},
                json:    typeof res.data === "string" ? _parseJsonSafe(res.data) : (res.data ?? null)
            }),
            () => { throw networkError(); }
        ),
        timeoutMs
    );
}

function _requestFetch({ method, url, headers, body, timeoutMs }) {
    const controller = timeoutMs ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    return fetch(url, {
        method,
        headers: headers || {},
        body:    body === undefined || typeof body === "string" ? body : JSON.stringify(body),
        signal:  controller ? controller.signal : undefined
    })
        .then((res) => res.text().then((text) => {
            const headerMap = {};
            res.headers.forEach((value, name) => { headerMap[name] = value; });
            return { status: res.status, headers: headerMap, json: _parseJsonSafe(text) };
        }))
        // Il ramo then non può lanciare per altri motivi: ogni errore qui è
        // un errore di trasporto (incluso l'abort per timeout).
        .catch(() => { throw networkError(); })
        .finally(() => { if (timer) clearTimeout(timer); });
}

/**
 * @param {object} options
 * @param {string} options.method
 * @param {string} options.url
 * @param {object} [options.headers]
 * @param {object|string} [options.body]  Oggetto (serializzato in JSON) o stringa.
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{status: number, headers: object, json: any}>}
 */
export function request(options) {
    return isNative() ? _requestNative(options) : _requestFetch(options);
}

/**
 * Legge un header ignorando maiuscole/minuscole (CapacitorHttp e fetch
 * non normalizzano allo stesso modo).
 */
export function readHeader(headers, name) {
    const wanted = name.toLowerCase();
    const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === wanted);
    return key ? headers[key] : undefined;
}
