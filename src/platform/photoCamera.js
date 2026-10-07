/**
 * Fotocamera per scattare foto (es. collo rifiutato), dalla pagina con
 * getUserMedia: funziona senza rete, l'anteprima è un <video> nella pagina e
 * la maschera la disegna l'app. Nell'APK il permesso CAMERA lo chiede
 * Capacitor alla prima apertura.
 *
 * Il plugin ML Kit della lettura codici non scatta foto: qui non serve.
 */

import { coverSourceRect, fitWithin } from "./photoCrop.js";

/**
 * Poster trasparente: senza, il WebView di Android mostra nel <video> un
 * riquadro grigio con un'icona finché non arriva il primo fotogramma.
 */
export const TRANSPARENT_POSTER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Attende che il video mostri davvero un fotogramma (la fotocamera "a freddo" può metterci un attimo). */
function waitForFirstFrame(video, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const done = () => {
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(done, timeoutMs);
        const check = () => {
            if (video.videoWidth > 0 && video.readyState >= 2) {
                if (typeof video.requestVideoFrameCallback === "function") {
                    video.requestVideoFrameCallback(() => done());
                } else {
                    requestAnimationFrame(() => done());
                }
            } else {
                video.addEventListener("loadeddata", check, { once: true });
            }
        };
        check();
    });
}

/** Lato lungo massimo della foto salvata e qualità JPEG: ~100–250 KB a foto. */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.75;

/**
 * Errore di apertura con un tipo comprensibile dall'interfaccia.
 * kind: "permission" (accesso negato) | "unavailable" (nessuna fotocamera, già in uso…)
 */
function cameraError(err) {
    const name = err && err.name;
    const e = new Error((err && err.message) || String(err));
    e.kind = name === "NotAllowedError" || name === "SecurityError" ? "permission" : "unavailable";
    return e;
}

/**
 * Apre la fotocamera posteriore e la collega al video.
 * @param {HTMLVideoElement} video
 * @returns {Promise<{ stop: () => void, torchAvailable: boolean, setTorch: (on: boolean) => Promise<boolean> }>}
 */
export async function openPhotoCamera(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw cameraError({ name: "NotFoundError", message: "Fotocamera non disponibile" });
    }
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
    } catch (err) {
        throw cameraError(err);
    }

    video.poster = TRANSPARENT_POSTER;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "");
    await video.play();
    await waitForFirstFrame(video);

    const [track] = stream.getVideoTracks();
    const capabilities = track && typeof track.getCapabilities === "function" ? track.getCapabilities() : {};

    return {
        stop() {
            stream.getTracks().forEach((t) => t.stop());
            video.srcObject = null;
        },
        torchAvailable: Boolean(capabilities.torch),
        async setTorch(on) {
            try {
                await track.applyConstraints({ advanced: [{ torch: on }] });
                return on;
            } catch {
                return false;
            }
        }
    };
}

/**
 * Scatta: ritaglia dal fotogramma corrente esattamente il riquadro visibile
 * e lo salva in JPEG.
 *
 * @param {HTMLVideoElement} video  mostrato con object-fit: cover
 * @param {HTMLElement} frame       riquadro a schermo
 * @returns {import("../domain/model.js").PhotoData}
 */
export function capturePhoto(video, frame) {
    const viewBox = video.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    const source = coverSourceRect(
        { width: video.videoWidth, height: video.videoHeight },
        { width: viewBox.width, height: viewBox.height },
        {
            left:   frameBox.left - viewBox.left,
            top:    frameBox.top - viewBox.top,
            width:  frameBox.width,
            height: frameBox.height
        }
    );
    const size = fitWithin(source.width, source.height, MAX_SIDE);

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d").drawImage(
        video,
        source.x, source.y, source.width, source.height,
        0, 0, size.width, size.height
    );
    return {
        image:  canvas.toDataURL("image/jpeg", JPEG_QUALITY),
        width:  size.width,
        height: size.height
    };
}
