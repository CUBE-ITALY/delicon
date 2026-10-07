/**
 * Tasto indietro di Android:
 *   1. se c'è un dialog aperto, lo chiude (se non è occupato);
 *   2. altrimenti risale di un livello: consegna → trasporto → home;
 *   3. dalla home manda l'app in background, senza chiuderla (l'operatore
 *      la ritrova dov'era).
 */

import { onBackButton, minimizeApp } from "../platform/nativeApp.js";
import { closeTopModal } from "../ui/modalStack.js";

export function initBackButton(router) {
    onBackButton(() => {
        if (closeTopModal()) {
            return;
        }
        const route = router.currentRoute.value;
        if (route.name === "delivery") {
            router.replace({ name: "shipment", params: { shipmentId: route.params.shipmentId } });
        } else if (route.name === "shipment") {
            router.replace({ name: "home" });
        } else {
            minimizeApp();
        }
    });
}
