/**
 * Feedback acustico della scansione colli. Tre suoni decisi dalla logica di
 * business (non dal decoder hardware, da silenziare sul palmare):
 *   - ok             → collo atteso, scaricato
 *   - notExpected    → codice che non appartiene alla consegna
 *   - alreadyScanned → collo già scaricato
 *
 * Web Audio API: ogni file viene scaricato una volta e decodificato; la
 * riproduzione da buffer ha latenza minima. L'AudioContext nasce sospeso
 * (autoplay policy): init() arma lo sblocco al primo gesto dell'utente.
 * Singleton per tutta la durata dell'app.
 */

const SOUND_FILES = {
    ok:             "audio/scan-ok.wav",
    notExpected:    "audio/scan-error.wav",
    alreadyScanned: "audio/scan-warn.wav"
};

let _ctx = null;
const _buffers = {};
let _loading = null;
let _armed = false;

function _ensureContext() {
    if (!_ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        _ctx = new AC();
    }
    return _ctx;
}

function _resume() {
    if (_ctx && _ctx.state === "suspended") {
        _ctx.resume();
    }
}

function _armAutoUnlock() {
    if (_armed) {
        return;
    }
    _armed = true;
    const onGesture = () => {
        _resume();
        window.removeEventListener("pointerdown", onGesture, true);
        window.removeEventListener("keydown", onGesture, true);
    };
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
}

async function _loadOne(ctx, kind) {
    const url = import.meta.env.BASE_URL + SOUND_FILES[kind];
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`audio: caricamento fallito ${url} (${res.status})`);
    }
    const data = await res.arrayBuffer();
    return new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
}

/** Pre-carica i suoni e arma lo sblocco. Idempotente, fire-and-forget. */
export function initAudio() {
    if (_loading) {
        return _loading;
    }
    const ctx = _ensureContext();
    _armAutoUnlock();
    _loading = Promise.all(
        Object.keys(SOUND_FILES).map((kind) =>
            _loadOne(ctx, kind).then((buf) => { _buffers[kind] = buf; })
        )
    ).then(() => undefined, (err) => {
        console.warn(err);
    });
    return _loading;
}

/**
 * Riproduce un suono. Non lancia mai: se l'audio non è pronto non suona,
 * senza interrompere la scansione.
 * @param {"ok"|"notExpected"|"alreadyScanned"} kind
 */
export function playSound(kind) {
    const buf = _buffers[kind];
    if (!_ctx || !buf) {
        return;
    }
    _resume();
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    src.connect(_ctx.destination);
    src.start(0);
}
