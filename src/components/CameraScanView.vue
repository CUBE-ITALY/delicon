<!--
  Lettura dei colli con la fotocamera: schermata a tutto schermo sopra
  l'immagine della fotocamera (disegnata dietro la pagina, vedi
  platform/cameraScanner.js). Fa da maschera: scura ovunque tranne nel
  mirino, l'unica zona in cui i codici vengono accettati.

  La lettura è continua: ogni codice accettato viene emesso con "code" e
  segue lo stesso flusso dello scanner del palmare; l'esito torna qui con
  la prop feedback. Il tasto indietro di Android chiude la schermata.
-->
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import Icon from "../ui/Icon.vue";
import CodeText from "../ui/CodeText.vue";
import Tally from "../ui/Tally.vue";
import { t } from "../i18n/index.js";
import { pushModal } from "../ui/modalStack.js";
import { startCameraScan, stopCameraScan, isTorchAvailable, toggleTorch } from "../platform/cameraScanner.js";

defineProps({
    subtitle: { type: String, default: "" },
    scanned:  { type: Number, required: true },
    expected: { type: Number, required: true },
    tones:    { type: Array, required: true },     // per Tally
    feedback: { type: Object, default: null },     // { tone, icon, text }
    complete: { type: Boolean, default: false }    // tutti i colli gestiti: "Fine" diventa l'azione successiva
});

const emit = defineEmits(["code", "close", "error"]);

const aim = ref(null);
const starting = ref(true);        // fotocamera in avvio: caricamento al posto del mirino
const torchAvailable = ref(false);
const torchOn = ref(false);

const removeFromStack = pushModal(() => emit("close"));

async function onTorch() {
    try {
        torchOn.value = await toggleTorch();
    } catch {
        torchOn.value = false;
    }
}

onMounted(async () => {
    await nextTick();
    try {
        await startCameraScan({
            onCode: (code) => emit("code", code),
            onError: (message) => emit("error", message),
            getAimRect: () => (aim.value ? aim.value.getBoundingClientRect() : null)
        });
        starting.value = false;
        torchAvailable.value = await isTorchAvailable();
    } catch (err) {
        emit("error", (err && err.message) || String(err));
    }
});

onBeforeUnmount(() => {
    removeFromStack();
    stopCameraScan();
});
</script>

<template>
    <Teleport to="body">
        <div class="camera" role="dialog" aria-modal="true" :aria-label="t('camera.title')">
            <header class="camera__bar">
                <button
                    type="button"
                    class="btn btn-quiet btn-icon"
                    :aria-label="t('app.close')"
                    @mousedown.prevent
                    @click="emit('close')"
                >
                    <Icon name="x" :size="26" />
                </button>
                <div class="camera__titles">
                    <p v-if="subtitle" class="camera__eyebrow"><CodeText :text="subtitle" /></p>
                    <h2 class="camera__title">{{ t('camera.title') }}</h2>
                </div>
                <button
                    v-if="torchAvailable"
                    type="button"
                    class="btn btn-quiet btn-icon camera__torch"
                    :class="{ 'is-on': torchOn }"
                    :aria-pressed="torchOn"
                    :aria-label="torchOn ? t('camera.torchOff') : t('camera.torchOn')"
                    @mousedown.prevent
                    @click="onTorch"
                >
                    <Icon name="flash" :size="24" />
                </button>
            </header>

            <div class="camera__view" :class="{ 'is-starting': starting }">
                <p v-if="starting" class="camera__starting" role="status">
                    <span class="spinner" aria-hidden="true" />
                    {{ t('camera.starting') }}
                </p>
                <div v-show="!starting" ref="aim" class="camera__aim" aria-hidden="true">
                    <span class="camera__corner camera__corner--tl" />
                    <span class="camera__corner camera__corner--tr" />
                    <span class="camera__corner camera__corner--bl" />
                    <span class="camera__corner camera__corner--br" />
                    <span class="camera__line" />
                </div>
                <p v-show="!starting" class="camera__hint">{{ t('camera.hint') }}</p>
            </div>

            <footer class="camera__panel">
                <p
                    v-if="feedback"
                    class="band"
                    :class="'band--' + feedback.tone"
                    role="status"
                    aria-live="assertive"
                >
                    <Icon :name="feedback.icon" />
                    <span><CodeText :text="feedback.text" /></span>
                </p>
                <p v-else class="band camera__ready">{{ t('camera.ready') }}</p>

                <div class="camera__count">
                    <div>
                        <span class="cell-label">{{ t('delivery.packagesTitle') }}</span>
                        <span class="cell-value cell-value--sm">{{ scanned }}<small>/{{ expected }}</small></span>
                    </div>
                    <Tally class="camera__tally" :tones="tones" />
                </div>

                <button
                    type="button"
                    class="btn btn-lg btn-block"
                    :class="{ 'btn-primary': complete }"
                    @mousedown.prevent
                    @click="emit('close')"
                >
                    {{ t('camera.done') }}
                </button>
            </footer>
        </div>
    </Teleport>
</template>

<style scoped>
/* Sopra la pagina (resa trasparente), sotto dialog e avvisi */
.camera {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
}

.camera__bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: var(--head-h);
    padding: calc(4px + env(safe-area-inset-top)) 4px 6px;
    background: var(--head);
    color: var(--on-head);
}

.camera__bar .btn-quiet {
    color: var(--on-head);
}

.camera__bar .btn-quiet:active:not(:disabled),
.camera__torch.is-on {
    background: rgba(255, 255, 255, 0.14);
}

.camera__torch.is-on {
    color: var(--signal);
}

.camera__titles {
    flex: 1;
    min-width: 0;
    padding: 0 6px;
}

.camera__eyebrow {
    font-family: var(--font-cond);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--on-head-2);
}

.camera__title {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 1.625rem;
    line-height: 1.1;
}

/* Zona dell'immagine: trasparente nel mirino, scura intorno */
.camera__view {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
}

/* Mirino largo e basso, sulla forma di un codice a barre lineare.
   L'ombra enorme è la maschera scura intorno. */
.camera__aim {
    position: relative;
    width: min(86%, 520px);
    aspect-ratio: 3 / 1;
    box-shadow: 0 0 0 200vmax rgba(11, 12, 11, 0.62);
}

/* Angoli gialli: il giallo indica dove agire */
.camera__corner {
    position: absolute;
    width: 26px;
    height: 26px;
    border: 0 solid var(--signal);
}

.camera__corner--tl { top: -3px; left: -3px; border-top-width: 5px; border-left-width: 5px; }
.camera__corner--tr { top: -3px; right: -3px; border-top-width: 5px; border-right-width: 5px; }
.camera__corner--bl { bottom: -3px; left: -3px; border-bottom-width: 5px; border-left-width: 5px; }
.camera__corner--br { bottom: -3px; right: -3px; border-bottom-width: 5px; border-right-width: 5px; }

.camera__line {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 50%;
    height: 2px;
    background: var(--signal);
    opacity: 0.7;
}

/* Fotocamera in avvio: fondo nero e caricamento, niente anteprima a metà */
.camera__view.is-starting {
    background: #000000;
}

.camera__starting {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #f2f3ee;
    font-weight: 600;
}

.camera__hint {
    position: relative;
    max-width: 30ch;
    padding: 0 16px;
    text-align: center;
    color: #f2f3ee;
    font-weight: 600;
    /* Leggibile anche sopra un'immagine chiara della fotocamera */
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

/* Pannello in basso: esito dell'ultima lettura, conteggio, chiusura */
.camera__panel {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px var(--gutter) calc(14px + env(safe-area-inset-bottom));
    background: var(--sheet);
    border-top: var(--rule) solid var(--ink);
}

.camera__ready {
    background: var(--sheet-2);
    color: var(--ink-2);
}

.camera__count {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: end;
    gap: 16px;
}

.camera__tally {
    margin-bottom: 6px;
}
</style>
