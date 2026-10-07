/**
 * Sorgente dei codici letti (interfaccia ScannerProvider).
 *
 *   attach(callback) — registra chi riceve i codici letti
 *   detach()         — rimuove la registrazione
 *
 * Implementazione manuale: la UI chiama submitCode(valore) (campo + pulsante
 * "Spara", o lo scanner del palmare in modalità tastiera che digita nel campo
 * e invia Invio) e il codice arriva alla callback come da un vero scanner.
 * Un provider diverso (es. intent DataWedge) può sostituire questo modulo
 * senza toccare le schermate.
 */

let _callback = null;

export const manualScanner = {
    attach(callback) {
        _callback = callback;
    },

    detach() {
        _callback = null;
    },

    /** Solo per l'implementazione manuale: consegna un codice letto. */
    submitCode(value) {
        const code = (value || "").trim();
        if (_callback && code) {
            _callback(code);
        }
    }
};
