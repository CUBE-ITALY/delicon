<!--
  Foto di un collo rifiutato: anteprima della fotocamera a tutto schermo con
  una maschera diversa da quella della lettura codici (riquadro grande 4:3,
  sulla forma di un pacco, etichetta "FOTO") e lo scopo dello scatto.

  Scatta → la foto (esattamente il riquadro) resta ferma per la revisione:
  "Rifai" torna all'anteprima, "Usa la foto" la emette con "save".
  Il tasto indietro di Android chiude senza salvare.
-->
<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import Icon from "../ui/Icon.vue";
import CodeText from "../ui/CodeText.vue";
import { t } from "../i18n/index.js";
import { pushModal } from "../ui/modalStack.js";
import { openPhotoCamera, capturePhoto, TRANSPARENT_POSTER } from "../platform/photoCamera.js";

const props = defineProps({
    packageId: { type: String, required: true },
    purpose:   { type: String, default: "" },      // perché si scatta (motivi del rifiuto)
    busy:      { type: Boolean, default: false }
});

const emit = defineEmits(["save", "close", "error"]);

const video = ref(null);
const frame = ref(null);
const ready = ref(false);
const shot = ref(null);            // foto in revisione
const torchAvailable = ref(false);
const torchOn = ref(false);

let camera = null;
const removeFromStack = pushModal(() => {
    if (!props.busy) {
        emit("close");
    }
});

function shoot() {
    if (!ready.value || !camera) {
        return;
    }
    shot.value = capturePhoto(video.value, frame.value);
    video.value.pause();
}

function retake() {
    shot.value = null;
    video.value.play().catch(() => {});
}

async function onTorch() {
    torchOn.value = camera ? await camera.setTorch(!torchOn.value) : false;
}

onMounted(async () => {
    try {
        camera = await openPhotoCamera(video.value);
        torchAvailable.value = camera.torchAvailable;
        ready.value = true;
    } catch (err) {
        emit("error", err);
    }
});

onBeforeUnmount(() => {
    removeFromStack();
    if (camera) {
        camera.stop();
        camera = null;
    }
});
</script>

<template>
    <Teleport to="body">
        <div class="photo" role="dialog" aria-modal="true" :aria-label="t('photo.title')">
            <header class="photo__bar">
                <button
                    type="button"
                    class="btn btn-quiet btn-icon"
                    :aria-label="t('app.close')"
                    :disabled="busy"
                    @click="emit('close')"
                >
                    <Icon name="x" :size="26" />
                </button>
                <div class="photo__titles">
                    <p class="photo__eyebrow"><CodeText :text="t('delivery.alreadyScannedTitle', { id: packageId })" /></p>
                    <h2 class="photo__title">{{ t('photo.title') }}</h2>
                </div>
                <button
                    v-if="torchAvailable && !shot"
                    type="button"
                    class="btn btn-quiet btn-icon photo__torch"
                    :class="{ 'is-on': torchOn }"
                    :aria-pressed="torchOn"
                    :aria-label="torchOn ? t('camera.torchOff') : t('camera.torchOn')"
                    @click="onTorch"
                >
                    <Icon name="flash" :size="24" />
                </button>
            </header>

            <div class="photo__view">
                <video
                    ref="video"
                    class="photo__video"
                    :class="{ 'is-live': ready }"
                    :poster="TRANSPARENT_POSTER"
                    playsinline
                    muted
                />
                <p v-if="!ready" class="photo__starting" role="status">
                    <span class="spinner" aria-hidden="true" />
                    {{ t('camera.starting') }}
                </p>
                <div v-show="ready" ref="frame" class="photo__frame">
                    <span class="photo__tag">{{ t('photo.tag') }}</span>
                    <img v-if="shot" :src="shot.image" class="photo__shot" :alt="t('photo.title')">
                    <span class="photo__corner photo__corner--tl" aria-hidden="true" />
                    <span class="photo__corner photo__corner--tr" aria-hidden="true" />
                    <span class="photo__corner photo__corner--bl" aria-hidden="true" />
                    <span class="photo__corner photo__corner--br" aria-hidden="true" />
                </div>
                <p v-if="purpose && ready" class="photo__purpose">{{ purpose }}</p>
            </div>

            <footer class="photo__panel">
                <template v-if="!shot">
                    <button type="button" class="btn btn-lg" @click="emit('close')">
                        {{ t('app.cancel') }}
                    </button>
                    <button type="button" class="btn btn-primary btn-lg photo__main" :disabled="!ready" @click="shoot">
                        <Icon name="camera" />
                        {{ t('photo.shoot') }}
                    </button>
                </template>
                <template v-else>
                    <button type="button" class="btn btn-lg" :disabled="busy" @click="retake">
                        {{ t('photo.retake') }}
                    </button>
                    <button type="button" class="btn btn-primary btn-lg photo__main" :disabled="busy" @click="emit('save', shot)">
                        <span v-if="busy" class="spinner" aria-hidden="true" />
                        {{ t('photo.use') }}
                    </button>
                </template>
            </footer>
        </div>
    </Teleport>
</template>

<style scoped>
/* Sopra la pagina, sotto dialog e avvisi */
.photo {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    background: #000000;
}

.photo__bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: var(--head-h);
    padding: calc(4px + env(safe-area-inset-top)) 4px 6px;
    background: var(--head);
    color: var(--on-head);
}

.photo__bar .btn-quiet {
    color: var(--on-head);
}

.photo__bar .btn-quiet:active:not(:disabled),
.photo__torch.is-on {
    background: rgba(255, 255, 255, 0.14);
}

.photo__torch.is-on {
    color: var(--signal);
}

.photo__titles {
    flex: 1;
    min-width: 0;
    padding: 0 6px;
}

.photo__eyebrow {
    font-family: var(--font-cond);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--on-head-2);
}

.photo__title {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 1.625rem;
    line-height: 1.1;
}

/* Anteprima a tutta zona, tagliata ai lati come la foto salvata (photoCrop.js) */
.photo__view {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
}

.photo__video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000000;
    /* Invisibile finché la fotocamera non manda il primo fotogramma */
    opacity: 0;
    transition: opacity 0.15s ease-out;
}

.photo__video.is-live {
    opacity: 1;
}

.photo__starting {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #f2f3ee;
    font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
    .photo__video { transition: none; }
}

/* Riquadro grande 4:3, sulla forma di un pacco: diverso dal mirino stretto
   della lettura codici. L'ombra enorme è la maschera intorno. */
.photo__frame {
    position: relative;
    width: min(92%, 640px);
    aspect-ratio: 4 / 3;
    box-shadow: 0 0 0 200vmax rgba(11, 12, 11, 0.62);
    outline: 1px solid rgba(255, 255, 255, 0.55);
}

.photo__shot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
}

.photo__tag {
    position: absolute;
    z-index: 1;
    top: -26px;
    left: -3px;
    padding: 2px 8px;
    background: var(--signal);
    color: var(--on-signal);
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 0.8125rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

/* Angoli gialli: il giallo indica dove agire */
.photo__corner {
    position: absolute;
    z-index: 1;
    width: 34px;
    height: 34px;
    border: 0 solid var(--signal);
}

.photo__corner--tl { top: -3px; left: -3px; border-top-width: 5px; border-left-width: 5px; }
.photo__corner--tr { top: -3px; right: -3px; border-top-width: 5px; border-right-width: 5px; }
.photo__corner--bl { bottom: -3px; left: -3px; border-bottom-width: 5px; border-left-width: 5px; }
.photo__corner--br { bottom: -3px; right: -3px; border-bottom-width: 5px; border-right-width: 5px; }

.photo__purpose {
    position: relative;
    max-width: 34ch;
    padding: 0 16px;
    text-align: center;
    color: #f2f3ee;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.photo__panel {
    flex: none;
    display: flex;
    gap: 8px;
    padding: 12px var(--gutter) calc(14px + env(safe-area-inset-bottom));
    background: var(--sheet);
    border-top: var(--rule) solid var(--ink);
}

.photo__panel .btn {
    flex: 1;
}

.photo__main {
    flex: 1.6 !important;
}
</style>
