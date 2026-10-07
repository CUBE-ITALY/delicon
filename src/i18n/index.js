/**
 * Traduzioni minime, senza dipendenze: t("home.title", { id: "873" }).
 * Le chiavi sono percorsi puntati nel dizionario della lingua attiva;
 * i segnaposto {nome} vengono sostituiti dai parametri. Una chiave mancante
 * viene restituita così com'è, per renderla evidente in sviluppo.
 */

import it from "./it.js";

const messages = { it };
let locale = "it";

function lookup(dict, key) {
    return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

export function t(key, params) {
    const value = lookup(messages[locale], key);
    if (typeof value !== "string") {
        return key;
    }
    if (!params) {
        return value;
    }
    return value.replace(/\{(\w+)\}/g, (match, name) =>
        params[name] === undefined || params[name] === null ? match : String(params[name])
    );
}

export function getLocale() {
    return locale;
}
