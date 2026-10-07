/**
 * Navigazione. Hash history: funziona identica da server web e dentro la
 * WebView Capacitor, senza configurazione lato server.
 */

import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import ShipmentView from "./views/ShipmentView.vue";
import DeliveryView from "./views/DeliveryView.vue";

export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", name: "home", component: HomeView },
        { path: "/shipments/:shipmentId", name: "shipment", component: ShipmentView, props: true },
        {
            path: "/shipments/:shipmentId/deliveries/:deliveryId",
            name: "delivery",
            component: DeliveryView,
            props: true
        },
        { path: "/:pathMatch(.*)*", redirect: "/" }
    ],
    scrollBehavior: () => ({ top: 0 })
});
