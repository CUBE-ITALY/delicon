<!--
  Consegna: lettura dei colli, rifiuto del singolo collo, conferma con firma
  del destinatario, consultazione delle firme.

  Lo scanner del palmare in modalità tastiera scrive nel campo e invia Invio:
  il campo resta sempre a fuoco finché la consegna è aperta e non ci sono
  dialog. Le letture vengono elaborate una alla volta, nell'ordine.
-->
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRouter } from "vue-router";
import AppHeader from "../ui/AppHeader.vue";
import Icon from "../ui/Icon.vue";
import StatusChip from "../ui/StatusChip.vue";
import CodeText from "../ui/CodeText.vue";
import Tally from "../ui/Tally.vue";
import SignatureDialog from "../components/SignatureDialog.vue";
import SignatureViewDialog from "../components/SignatureViewDialog.vue";
import CameraScanView from "../components/CameraScanView.vue";
import PhotoCaptureView from "../components/PhotoCaptureView.vue";
import PhotoViewDialog from "../components/PhotoViewDialog.vue";
import ReasonsDialog from "../components/ReasonsDialog.vue";
import { t } from "../i18n/index.js";
import * as service from "../services/deliveryService.js";
import { ScanOutcome, canPhotographPackage } from "../services/deliveryService.js";
import { getPackageRejectReasons, getUnscannedPackageRejectReasons } from "../config/rejectReasons.js";
import { manualScanner } from "../platform/scanner.js";
import { isCameraScanAvailable, ensureCameraPermission, openAppSettings } from "../platform/cameraScanner.js";
import { initAudio, playSound } from "../platform/audioFeedback.js";
import { syncVersion } from "../app/outbox.js";
import { syncAfterClosing } from "../app/deliveryFeedback.js";
import { ask } from "../ui/feedback.js";
import { useSoftKeyboard } from "../ui/softKeyboard.js";
import { statusView, syncView, streetLine, cityLine, reasonLabels } from "../ui/format.js";
import { DeliveryStatus } from "../domain/model.js";

const props = defineProps({
    shipmentId: { type: String, required: true },
    deliveryId: { type: String, required: true }
});

const router = useRouter();

const loading = ref(true);
const state = ref(null);
const scanValue = ref("");
const scanInput = ref(null);
// Tastiera a schermo solo su richiesta: lo scanner scrive nel campo senza.
const {
    enabled: keyboardOn,
    inputMode: scanInputMode,
    toggle: toggleKeyboard,
    reset: resetKeyboard,
    onBlur: onScanBlur
} = useSoftKeyboard(scanInput);
const feedback = ref(null);        // { tone, icon, text }
const lastPackageId = ref(null);

const step = ref(null);            // null | "signature" | "reasons" | "signatures" | "photo" | "photos"
const busy = ref(false);
const reasonsPackageId = ref(null);
const reasonsForScanned = ref(true); // collo già scaricato (con "scansione errata") o no (con "mancante")
const signatures = ref([]);
const photoPackage = ref(null);    // collo che si sta fotografando
const photos = ref([]);            // foto mostrate da "Foto"

// Lettura con la fotocamera (solo app nativa con fotocamera)
const cameraAvailable = ref(false);
const cameraOn = ref(false);

const isOpen = computed(() => state.value && !state.value.isClosed);

// Cosa si sta firmando: mostrato nel dialog di firma.
const signingSummary = computed(() => {
    const s = state.value;
    if (!s) {
        return null;
    }
    const lines = [{
        text: s.scannedCount === 1
            ? t("signature.summaryDeliveredOne")
            : t("signature.summaryDelivered", { count: s.scannedCount }),
        tone: "success"
    }];
    s.packages.filter((p) => p.rejected).forEach((p) => lines.push({
        text: t("signature.summaryRejectedPackage", { id: p.packageId, reasons: reasonLabels(p.rejectReasons) }) +
            (p.photoCount ? " · " + t("photo.count", { count: p.photoCount }) : ""),
        tone: "danger"
    }));
    return {
        title: t("signature.summaryConfirm", { name: s.consignee.name, note: s.deliveryNoteNumber }),
        lines
    };
});

// "Via Roma 12 · 65121 Pescara (PE)"
const addressLine = computed(() => {
    const c = state.value && state.value.consignee;
    return c ? [streetLine(c), cityLine(c)].filter(Boolean).join(" · ") : "";
});

// Una tacca per collo, nell'ordine dell'elenco; rifiuto totale = tutti rifiutati.
const packageTones = computed(() => {
    const s = state.value;
    if (!s) {
        return [];
    }
    if (s.status === DeliveryStatus.REJECTED) {
        return s.packages.map(() => "ko");
    }
    return s.packages.map((p) => (p.rejected ? "ko" : p.scanned ? "ok" : ""));
});

async function load() {
    try {
        state.value = await service.loadDelivery(props.shipmentId, props.deliveryId);
    } finally {
        loading.value = false;
    }
}

async function focusScan() {
    await nextTick();
    if (isOpen.value && !step.value && scanInput.value) {
        scanInput.value.focus();
    }
}

function setFeedback(tone, icon, text) {
    feedback.value = { tone, icon, text };
}

async function showError(title, err) {
    await ask({
        title,
        message: (err && err.message) || String(err),
        tone: "danger",
        actions: [{ id: "ok", label: t("app.ok"), primary: true }]
    });
}

// --- Scansione ---

function onSubmit() {
    const value = scanValue.value;
    scanValue.value = "";
    manualScanner.submitCode(value);
    resetKeyboard();
    focusScan();
}

// Le letture arrivano anche a raffica: si elaborano in coda, una alla volta.
let scanQueue = Promise.resolve();
function onCode(code) {
    scanQueue = scanQueue.then(() => handleCode(code)).catch((err) => showError(t("delivery.saveFailed"), err));
}

async function handleCode(code) {
    if (step.value) {
        return; // dialog aperto: la lettura non è per questa schermata
    }
    const res = await service.scanPackage(props.shipmentId, props.deliveryId, code);

    switch (res.outcome) {
        case ScanOutcome.SCANNED:
            playSound("ok");
            lastPackageId.value = res.packageId;
            if (res.wasRejected) {
                setFeedback("warning", "alert", t("delivery.feedback.scannedWasRejected", { id: res.packageId }));
            } else {
                setFeedback("success", "check", t("delivery.feedback.scanned", { id: res.packageId }));
            }
            await load();
            break;

        case ScanOutcome.NOT_EXPECTED:
            playSound("notExpected");
            setFeedback("danger", "x", t("delivery.feedback.notExpected", { code }));
            break;

        case ScanOutcome.ALREADY_SCANNED: {
            playSound("alreadyScanned");
            lastPackageId.value = res.packageId;
            setFeedback("warning", "alert", t("delivery.feedback.alreadyScanned", { id: res.packageId }));
            if (cameraOn.value) {
                break; // con la fotocamera si continua a leggere: basta l'avviso, niente finestra
            }
            const choice = await ask({
                title: t("delivery.alreadyScannedTitle", { id: res.packageId }),
                message: t("delivery.alreadyScannedMessage"),
                tone: "warning",
                actions: [
                    { id: "undo", label: t("delivery.undoScan"), danger: true },
                    { id: "ok", label: t("app.ok"), primary: true }
                ]
            });
            if (choice === "undo") {
                // Prima il motivo: "scansione errata" annulla, gli altri rifiutano il collo.
                openReasons(res.packageId, true);
            } else {
                focusScan();
            }
            break;
        }

        case ScanOutcome.CLOSED:
            setFeedback("neutral", "alert", t("delivery.feedback.closed"));
            break;
    }
}

// --- Azioni sul singolo collo (tocco sulla riga) ---

function openReasons(packageId, scanned) {
    reasonsPackageId.value = packageId;
    reasonsForScanned.value = scanned;
    step.value = "reasons";
}

/**
 * Tocco su un collo, a consegna aperta:
 *   - da scaricare → può essere rifiutato (es. mancante) senza leggerlo;
 *   - scaricato    → annullare lo scarico (scansione errata) o rifiutarlo;
 *   - rifiutato    → annullare il rifiuto, il collo torna da scaricare.
 */
async function onPackageTap(p) {
    if (!isOpen.value || step.value || cameraOn.value) {
        return;
    }
    if (p.rejected) {
        const choice = await ask({
            title: t("delivery.alreadyScannedTitle", { id: p.packageId }),
            message: t("delivery.packageRejectedMessage", { reasons: reasonLabels(p.rejectReasons) }),
            actions: [
                { id: "restore", label: t("delivery.restorePackage") },
                { id: "ok", label: t("app.ok"), primary: true }
            ]
        });
        if (choice === "restore") {
            await restorePackage(p.packageId);
        } else {
            focusScan();
        }
        return;
    }
    if (p.scanned) {
        const choice = await ask({
            title: t("delivery.alreadyScannedTitle", { id: p.packageId }),
            message: t("delivery.alreadyScannedMessage"),
            actions: [
                { id: "undo", label: t("delivery.undoScan"), danger: true },
                { id: "ok", label: t("app.ok"), primary: true }
            ]
        });
        if (choice === "undo") {
            openReasons(p.packageId, true);
        } else {
            focusScan();
        }
        return;
    }
    const choice = await ask({
        title: t("delivery.alreadyScannedTitle", { id: p.packageId }),
        message: t("delivery.unscannedMessage"),
        actions: [
            { id: "reject", label: t("delivery.rejectPackage"), danger: true },
            { id: "cancel", label: t("app.cancel"), primary: true }
        ]
    });
    if (choice === "reject") {
        openReasons(p.packageId, false);
    } else {
        focusScan();
    }
}

async function restorePackage(packageId) {
    try {
        await service.cancelScan(props.shipmentId, props.deliveryId, packageId);
        setFeedback("neutral", "undo", t("delivery.feedback.restored", { id: packageId }));
        lastPackageId.value = packageId;
        await load();
    } catch (err) {
        await showError(t("delivery.saveFailed"), err);
    }
    focusScan();
}

// --- Rifiuto del collo ---

async function onPackageReasons(codes) {
    const packageId = reasonsPackageId.value;
    busy.value = true;
    try {
        const result = await service.rejectPackage(props.shipmentId, props.deliveryId, packageId, codes);
        setFeedback(
            result === "cancelled" ? "neutral" : "danger",
            result === "cancelled" ? "undo" : "x",
            t(result === "cancelled" ? "delivery.feedback.cancelled" : "delivery.feedback.rejected", { id: packageId })
        );
        lastPackageId.value = packageId;
        step.value = null;
        await load();
    } catch (err) {
        await showError(t("delivery.saveFailed"), err);
    } finally {
        busy.value = false;
    }
}

function closeStep() {
    step.value = null;
    reasonsPackageId.value = null;
}

// --- Conferma e firme ---

async function onSignature(consignee) {
    busy.value = true;
    try {
        await service.confirmDelivery(props.shipmentId, props.deliveryId, consignee);
    } catch (err) {
        busy.value = false;
        await showError(t("signature.saveFailed"), err);
        return;
    }
    busy.value = false;
    step.value = null;
    feedback.value = null;   // l'esito dell'ultima lettura non è più pertinente
    lastPackageId.value = null;
    await load();
    // Chiusura locale fatta: ora l'invio, che non la annulla se fallisce.
    await syncAfterClosing(props.shipmentId, props.deliveryId);
    await load();
}

// --- Foto del collo rifiutato ---

function canPhoto(p) {
    return isOpen.value && canPhotographPackage(p);
}

function openPhoto(p) {
    if (!canPhoto(p) || step.value || cameraOn.value) {
        return;
    }
    photoPackage.value = p;
    step.value = "photo";
}

async function onPhotoSave(photo) {
    const p = photoPackage.value;
    busy.value = true;
    try {
        await service.addPackagePhoto(props.shipmentId, props.deliveryId, p.packageId, photo);
    } catch (err) {
        busy.value = false;
        await showError(t("photo.saveFailed"), err);
        return;
    }
    busy.value = false;
    lastPackageId.value = p.packageId;
    setFeedback("success", "camera", t("delivery.feedback.photoSaved", { id: p.packageId }));
    closePhoto();
    await load();
}

function closePhoto() {
    photoPackage.value = null;
    step.value = null;
}

async function onPhotoError(err) {
    closePhoto();
    if (err && err.kind === "permission") {
        await askCameraPermission();
    } else {
        await showError(t("camera.errorTitle"), err);
    }
}

async function showPhotos() {
    photos.value = await service.getPhotos(props.shipmentId, props.deliveryId);
    step.value = "photos";
}

// Solo a consegna aperta (la galleria mostra il pulsante solo allora).
async function onRemovePhoto(item) {
    const choice = await ask({
        title: t("photo.removeTitle"),
        message: t("photo.removeMessage", { id: item.packageId }),
        tone: "warning",
        actions: [
            { id: "remove", label: t("photo.remove"), danger: true },
            { id: "cancel", label: t("app.cancel"), primary: true }
        ]
    });
    if (choice !== "remove") {
        return;
    }
    busy.value = true;
    try {
        await service.removePackagePhoto(props.shipmentId, props.deliveryId, item.eventId);
    } catch (err) {
        busy.value = false;
        await showError(t("photo.removeFailed"), err);
        return;
    }
    busy.value = false;
    lastPackageId.value = item.packageId;
    setFeedback("neutral", "x", t("delivery.feedback.photoRemoved", { id: item.packageId }));
    photos.value = await service.getPhotos(props.shipmentId, props.deliveryId);
    await load();
    if (photos.value.length === 0) {
        closeStep();   // galleria vuota: si torna alla consegna
    }
}

async function showSignatures() {
    signatures.value = await service.getSignatures(props.shipmentId, props.deliveryId);
    step.value = "signatures";
}

function goBack() {
    router.replace({ name: "shipment", params: { shipmentId: props.shipmentId } });
}

function packageView(p) {
    if (p.rejected) {
        const reasons = reasonLabels(p.rejectReasons);
        return { tone: "danger", icon: "x", label: reasons ? `${t("delivery.packageRejected")}: ${reasons}` : t("delivery.packageRejected") };
    }
    if (p.scanned) {
        return { tone: "success", icon: "check", label: t("delivery.packageScanned") };
    }
    return { tone: "neutral", icon: "", label: t("delivery.packageToScan") };
}

// --- Fotocamera ---

async function openCamera() {
    const allowed = await ensureCameraPermission().catch(() => false);
    if (!allowed) {
        await askCameraPermission();
        return;
    }
    feedback.value = null;   // la schermata di lettura parte da "Pronto a leggere"
    cameraOn.value = true;
}

/** Permesso della fotocamera negato: spiega e propone le impostazioni. */
async function askCameraPermission() {
    const choice = await ask({
        title: t("camera.permissionTitle"),
        message: t("camera.permissionMessage"),
        tone: "warning",
        actions: [
            { id: "settings", label: t("camera.openSettings") },
            { id: "ok", label: t("app.close"), primary: true }
        ]
    });
    if (choice === "settings") {
        openAppSettings();
    }
    focusScan();
}

function closeCamera() {
    cameraOn.value = false;
    focusScan();
}

async function onCameraError(message) {
    cameraOn.value = false;
    await showError(t("camera.errorTitle"), message);
    focusScan();
}

// Il codice letto dalla fotocamera segue lo stesso percorso dello scanner del palmare.
function onCameraCode(code) {
    manualScanner.submitCode(code);
}

onMounted(async () => {
    initAudio();
    manualScanner.attach(onCode);
    await load();
    focusScan();
    cameraAvailable.value = await isCameraScanAvailable();
});

onBeforeUnmount(() => manualScanner.detach());

watch(() => [props.shipmentId, props.deliveryId], async () => {
    feedback.value = null;
    lastPackageId.value = null;
    await load();
    focusScan();
});
watch(syncVersion, load);
watch(step, (value) => {
    if (!value) {
        focusScan();
    }
});
</script>

<template>
    <AppHeader
        :title="t('delivery.title', { id: deliveryId })"
        :subtitle="t('delivery.subtitle', { id: shipmentId })"
        back
        @back="goBack"
    />

    <main class="page">
        <p v-if="loading" class="muted">{{ t('app.loading') }}</p>

        <section v-else-if="!state" class="sheet bleed empty">
            <p>{{ t('delivery.notFound') }}</p>
            <button type="button" class="btn btn-primary" @click="goBack">{{ t('app.back') }}</button>
        </section>

        <template v-else>
            <!-- Cartiglio: destinatario, documento, colli, stato -->
            <section class="sheet bleed summary">
                <div class="cells">
                    <div class="cell">
                        <span class="cell-label">{{ t('delivery.recipient') }}</span>
                        <h2 class="summary__name">{{ state.consignee.name }}</h2>
                        <p class="summary__addr">{{ addressLine }}</p>
                    </div>
                </div>
                <div class="cells summary__facts">
                    <div class="cell">
                        <span class="cell-label">{{ t('delivery.deliveryNoteLabel') }}</span>
                        <span class="cell-value cell-value--sm">{{ state.deliveryNoteNumber }}</span>
                    </div>
                    <div class="cell">
                        <span class="cell-label">{{ t('delivery.packagesTitle') }}</span>
                        <span class="cell-value cell-value--sm">{{ state.scannedCount }}<small>/{{ state.expectedCount }}</small></span>
                    </div>
                    <div class="cell">
                        <span class="cell-label">{{ t('delivery.stateLabel') }}</span>
                        <span class="marks">
                            <StatusChip v-bind="statusView(state.status)" />
                            <StatusChip v-if="syncView(state.syncState)" v-bind="syncView(state.syncState)" />
                        </span>
                    </div>
                </div>
                <div class="cells">
                    <div class="cell summary__tally">
                        <Tally :tones="packageTones" />
                    </div>
                </div>
            </section>

            <!-- Lettura colli: resta visibile mentre si scorre l'elenco -->
            <section class="scan bleed">
                <form v-if="isOpen" class="scan__form" novalidate @submit.prevent="onSubmit">
                    <label class="field scan__field" for="scan-input">
                        <span class="field-label">{{ t('delivery.scanLabel') }}</span>
                        <span class="field__row">
                            <input
                                id="scan-input"
                                ref="scanInput"
                                v-model="scanValue"
                                class="input mono"
                                type="text"
                                :inputmode="scanInputMode"
                                autocomplete="off"
                                autocapitalize="off"
                                spellcheck="false"
                                enterkeyhint="done"
                                :placeholder="t('delivery.scanPlaceholder')"
                                @blur="onScanBlur"
                            >
                            <button
                                v-if="cameraAvailable"
                                type="button"
                                class="field__key field__key--strong"
                                :aria-label="t('camera.open')"
                                @pointerdown.prevent
                                @mousedown.prevent
                                @click="openCamera"
                            >
                                <Icon name="scan" :size="22" />
                            </button>
                            <button
                                type="button"
                                class="field__key"
                                :class="{ 'is-on': keyboardOn }"
                                :aria-pressed="keyboardOn"
                                :aria-label="keyboardOn ? t('app.keyboardHide') : t('app.keyboardShow')"
                                @pointerdown.prevent
                                @mousedown.prevent
                                @click="toggleKeyboard"
                            >
                                <Icon name="keyboard" :size="22" />
                            </button>
                        </span>
                    </label>
                    <button type="submit" class="btn btn-primary btn-lg scan__btn">
                        {{ t('delivery.scan') }}
                    </button>
                </form>
                <p v-else class="closed-banner">
                    <Icon name="check" />
                    {{ t('delivery.closedBanner') }}
                </p>

                <p v-if="feedback" class="band feedback" :class="'band--' + feedback.tone" role="status" aria-live="assertive">
                    <Icon :name="feedback.icon" />
                    <span><CodeText :text="feedback.text" /></span>
                </p>
            </section>

            <!-- Colli: una casella di spunta per collo -->
            <h2 class="section-title">
                <span>{{ t('delivery.packagesTitle') }}</span>
                <span class="num">{{ state.packages.length }}</span>
            </h2>
            <p v-if="isOpen" class="hint">{{ t('delivery.packagesHint') }}</p>
            <ul class="sheet rows bleed pkg-list">
                <li
                    v-for="p in state.packages"
                    :key="p.packageId"
                    class="pkg"
                    :class="{ 'is-scanned': p.scanned, 'is-rejected': p.rejected, 'is-last': p.packageId === lastPackageId }"
                >
                    <div class="pkg__row">
                        <button type="button" class="pkg__main" :disabled="!isOpen" @click="onPackageTap(p)">
                            <span class="pkg__box" :class="'pkg__box--' + packageView(p).tone" aria-hidden="true">
                                <Icon v-if="packageView(p).icon" :name="packageView(p).icon" :size="24" />
                            </span>
                            <span class="pkg__body">
                                <span class="pkg__id"><CodeText :text="p.packageId" /></span>
                                <span class="pkg__desc">{{ p.description }}</span>
                                <span class="pkg__status" :class="p.rejected ? 'text-danger' : 'visually-hidden'">{{ packageView(p).label }}</span>
                            </span>
                        </button>
                        <!-- Foto del collo rifiutato, a documentazione del rifiuto -->
                        <button
                            v-if="canPhoto(p)"
                            type="button"
                            class="pkg__photo"
                            :aria-label="t('photo.take', { id: p.packageId })"
                            @click="openPhoto(p)"
                        >
                            <Icon name="camera" :size="24" />
                            <span v-if="p.photoCount" class="pkg__photo-count">{{ p.photoCount }}</span>
                        </button>
                    </div>
                </li>
            </ul>
        </template>
    </main>

    <!-- Azioni -->
    <footer v-if="state && (state.isSigned || !state.isClosed || state.photoCount > 0)" class="action-bar">
        <div class="action-bar__inner">
            <button v-if="state.photoCount > 0" type="button" class="btn btn-lg action-bar__photos" @click="showPhotos">
                <Icon name="camera" />
                <span class="num">{{ state.photoCount }}</span>
                <span class="visually-hidden">{{ t('photo.show') }}</span>
            </button>
            <button v-if="state.isSigned" type="button" class="btn btn-lg" @click="showSignatures">
                {{ t('delivery.showSignatures') }}
            </button>
            <button
                v-if="!state.isClosed"
                type="button"
                class="btn btn-primary btn-lg action-bar__primary"
                :disabled="!state.isConfirmable"
                @click="step = 'signature'"
            >
                {{ t('delivery.confirm') }}
            </button>
        </div>
    </footer>

    <SignatureDialog
        v-if="step === 'signature'"
        :busy="busy"
        :summary="signingSummary"
        @cancel="closeStep"
        @confirm="onSignature"
    />
    <ReasonsDialog
        v-if="step === 'reasons'"
        :title="t('delivery.packageReasonsTitle', { id: reasonsPackageId })"
        :reasons="reasonsForScanned ? getPackageRejectReasons() : getUnscannedPackageRejectReasons()"
        :busy="busy"
        @cancel="closeStep"
        @confirm="onPackageReasons"
    />
    <SignatureViewDialog
        v-if="step === 'signatures'"
        :signatures="signatures"
        @close="closeStep"
    />
    <PhotoCaptureView
        v-if="step === 'photo' && photoPackage"
        :package-id="photoPackage.packageId"
        :purpose="t('photo.purpose', { reasons: reasonLabels(photoPackage.rejectReasons) })"
        :busy="busy"
        @save="onPhotoSave"
        @close="closePhoto"
        @error="onPhotoError"
    />
    <PhotoViewDialog
        v-if="step === 'photos'"
        :photos="photos"
        :packages="state ? state.packages : []"
        :editable="Boolean(isOpen)"
        :busy="busy"
        @close="closeStep"
        @remove="onRemovePhoto"
    />
    <CameraScanView
        v-if="cameraOn && state && isOpen"
        :subtitle="t('delivery.title', { id: deliveryId })"
        :scanned="state.scannedCount"
        :expected="state.expectedCount"
        :tones="packageTones"
        :feedback="feedback"
        :complete="state.isConfirmable"
        @code="onCameraCode"
        @close="closeCamera"
        @error="onCameraError"
    />
</template>

<style scoped>
.page {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
}

.empty {
    padding: 16px var(--gutter);
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
}

.summary__name {
    font-weight: 600;
    font-size: 1.375rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
}

.summary__addr {
    font-size: var(--fs-sm);
    color: var(--ink-2);
}

.summary__facts {
    grid-template-columns: 0.9fr 0.8fr 1.3fr;
}

.marks {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
}

.summary__tally {
    padding-top: 10px;
}

/* Lettura colli: resta visibile mentre si scorre l'elenco */
.scan {
    position: sticky;
    top: calc(var(--head-h) + env(safe-area-inset-top));
    z-index: 5;
    padding: 4px var(--gutter) 6px;
    background: var(--paper);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.scan__form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 104px;
    gap: 8px;
}

.scan__btn {
    min-height: 100%;
    padding: 0 8px;
}

.closed-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
    padding: 10px 14px;
    border: 2px solid var(--ink);
    background: var(--sheet);
    font-weight: 600;
}

/* Riga collo: casella di spunta, codice, descrizione */
.pkg__main {
    width: 100%;
    min-height: 72px;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 9px var(--gutter);
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.pkg__main:disabled {
    cursor: default;
    opacity: 1;
}

.pkg__main:active:not(:disabled) {
    background: var(--sheet-2);
}

/* L'ultimo collo letto o toccato è incorniciato */
.pkg__row {
    display: flex;
    align-items: stretch;
}

.pkg__row .pkg__main {
    flex: 1;
    min-width: 0;
}

/* Pulsante foto a destra della riga, separato da un filetto */
.pkg__photo {
    position: relative;
    flex: none;
    width: 64px;
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid var(--hair);
    background: transparent;
    color: var(--ink);
    cursor: pointer;
}

.pkg__photo:active {
    background: var(--sheet-2);
}

/* Quante foto ha già il collo */
.pkg__photo-count {
    position: absolute;
    top: 10px;
    right: 8px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    display: grid;
    place-items: center;
    background: var(--ink);
    color: var(--sheet);
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 0.8125rem;
    line-height: 1;
}

.action-bar__photos {
    flex: 0 0 auto !important;
    padding: 0 16px;
}

.pkg.is-last .pkg__row {
    box-shadow: inset 0 0 0 3px var(--ink);
}

.pkg__box {
    flex: none;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 2px solid var(--ink-2);
    background: var(--sheet);
}

.pkg__box--success { background: var(--ok); border-color: var(--ok); color: var(--on-state); }
.pkg__box--danger  { background: var(--ko); border-color: var(--ko); color: var(--on-state); }

.pkg__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.pkg__id {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 1.375rem;
    line-height: 1.1;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
}

.pkg__desc {
    font-size: var(--fs-sm);
    line-height: 1.3;
    overflow-wrap: anywhere;
}

.pkg__status {
    margin-top: 3px;
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.action-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    background: var(--sheet);
    border-top: var(--rule) solid var(--ink);
    padding: 10px var(--gutter) calc(14px + env(safe-area-inset-bottom));
}

.action-bar__inner {
    max-width: calc(var(--page-max) - 2 * var(--gutter));
    margin: 0 auto;
    display: flex;
    gap: 8px;
}

.action-bar__inner .btn {
    flex: 1;
}

.action-bar__primary {
    flex: 2 !important;
}
</style>
