/**
 * Invio subito dopo la chiusura di una consegna, con l'avviso giusto per
 * l'operatore. La chiusura locale è già avvenuta: un invio fallito non la
 * annulla, gli esiti restano sul device e il retry automatico li reinvia.
 */

import { syncDelivery } from "../services/sync.js";
import { toast } from "../ui/feedback.js";
import { t } from "../i18n/index.js";

export async function syncAfterClosing(shipmentId, deliveryId) {
    try {
        const summary = await syncDelivery(shipmentId, deliveryId);
        if (summary.submitted === 0) {
            return;
        }
        if (summary.errored > 0) {
            toast(t("sync.deliveryErrored"), "warning");
        } else {
            toast(t("sync.deliverySynced"), "success");
        }
    } catch {
        toast(t("sync.deliveryOffline"), "neutral");
    }
}
