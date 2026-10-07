/**
 * Lettura dei codici con la fotocamera del dispositivo (in alternativa o in
 * aggiunta allo scanner del palmare). Il riconoscimento è dentro l'app
 * (ML Kit incluso nell'APK): funziona anche senza rete.
 */
export const cameraScanConfig = {
    // Simbologie accettate. Le etichette dei colli sono Code 128 (GS1-128
    // compreso). Meno formati = lettura più rapida e meno codici estranei.
    // Valori di BarcodeFormat del plugin: "CODE_128", "EAN_13", "DATA_MATRIX", "QR_CODE"…
    formats: ["CODE_128"],

    // Lo stesso codice resta nell'inquadratura per secondi e viene rilevato
    // molte volte al secondo: si accetta di nuovo solo dopo che è rimasto
    // fuori vista per questo tempo.
    repeatWindowMs: 2500,

    // Si accettano solo i codici col centro dentro il mirino, allargato di
    // questa frazione per lato (tolleranza su allineamento schermo/fotocamera).
    aimTolerance: 0.15
};
