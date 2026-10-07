/**
 * Rilevamento dell'ambiente di esecuzione (browser vs app nativa Capacitor).
 */

import { Capacitor } from "@capacitor/core";

/** true quando l'app gira nella WebView nativa (APK). */
export function isNative() {
    return Capacitor.isNativePlatform();
}
