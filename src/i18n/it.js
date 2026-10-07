/** Testi italiani dell'interfaccia. Le chiavi sono raggruppate per schermata. */
export default {
    app: {
        name: "Delicon",
        back: "Indietro",
        close: "Chiudi",
        cancel: "Annulla",
        ok: "OK",
        retry: "Riprova",
        loading: "Caricamento…",
        themeLight: "Tema chiaro",
        themeDark: "Tema scuro",
        keyboardShow: "Mostra la tastiera",
        keyboardHide: "Nascondi la tastiera"
    },

    home: {
        title: "Scarica trasporto",
        hint: "Leggi il codice del trasporto con lo scanner oppure digitalo.",
        inputLabel: "Numero trasporto",
        inputPlaceholder: "Es. {example}",
        download: "Scarica",
        downloading: "Scaricamento…",
        useDemo: "Usa il trasporto demo {id}",
        onDevice: "Sul dispositivo",
        onDeviceEmpty: "Nessun trasporto scaricato su questo dispositivo.",
        downloadedAt: "Scaricato {when}",
        deliveriesProgress: "Consegne chiuse {closed}/{total}",
        deliveriesUnit: "consegne",
        toSend: "{count} da inviare",
        sendErrors: "{count} con errore di invio",
        required: "Inserisci il numero del trasporto",
        errorTitle: "Download non riuscito",
        errorNotFound: "Il trasporto {id} non esiste.",
        errorNetwork: "Server non raggiungibile. Controlla la connessione e riprova.",
        errorNetworkOffline: "Server non raggiungibile. Il trasporto è già sul dispositivo: puoi aprirlo anche senza rete.",
        about: "Delicon {version} · dispositivo {device}"
    },

    shipment: {
        title: "Trasporto {id}",
        subtitle: "{count} consegne",
        headerLabel: "Trasporto",
        headerSubtitle: "Trasporto · {count} consegne",
        headerSubtitleOne: "Trasporto · 1 consegna",
        progress: "Avanzamento del trasporto",
        deliveriesClosed: "Consegne chiuse",
        deliveriesTitle: "Consegne · ordine di scarico",
        packagesScanned: "Colli scaricati",
        empty: "Nessuna consegna in questo trasporto.",
        notFound: "Trasporto non presente sul dispositivo.",
        packagesCount: "{scanned}/{expected}",
        packagesUnit: "colli",
        trace: "Traccia",
        reject: "Rifiuta",
        rejectReasonsTitle: "Motivi del rifiuto",
        rejectSaved: "Rifiuto registrato.",
        rejectFailed: "Registrazione del rifiuto non riuscita."
    },

    delivery: {
        title: "Consegna {id}",
        subtitle: "Trasporto {id}",
        deliveryNote: "DDT {number}",
        notFound: "Consegna non presente sul dispositivo.",
        scanLabel: "Codice collo",
        scanPlaceholder: "Spara o digita",
        scan: "Spara",
        closedBanner: "Consegna chiusa: non si possono più registrare colli.",
        packagesTitle: "Colli",
        confirm: "Conferma consegna",
        showSignatures: "Firme",
        packageScanned: "Scaricato",
        packageToScan: "Da scaricare",
        packageRejected: "Rifiutato",
        stateLabel: "Stato",
        recipient: "Destinatario",
        deliveryNoteLabel: "DDT",
        alreadyScannedTitle: "Collo {id}",
        alreadyScannedMessage: "Il collo è già stato scaricato.",
        unscannedMessage: "Il collo non è stato scaricato. Se manca o non può essere consegnato, puoi rifiutarlo.",
        packageRejectedMessage: "Il collo è stato rifiutato: {reasons}. Annullando il rifiuto torna da scaricare.",
        packagesHint: "Tocca un collo per rifiutarlo o annullarne lo scarico.",
        undoScan: "Annulla scarico",
        rejectPackage: "Rifiuta collo",
        restorePackage: "Annulla rifiuto",
        packageReasonsTitle: "Collo {id}: motivo",
        feedback: {
            scanned: "Collo {id} scaricato",
            scannedWasRejected: "Collo {id} scaricato: il rifiuto è stato annullato",
            notExpected: "Il codice {code} non appartiene a questa consegna",
            alreadyScanned: "Collo {id} già scaricato",
            closed: "Consegna chiusa: lettura non registrata",
            cancelled: "Scarico del collo {id} annullato",
            rejected: "Collo {id} rifiutato",
            restored: "Rifiuto del collo {id} annullato: torna da scaricare"
        },
        saveFailed: "Registrazione non riuscita."
    },

    reasons: {
        selectAtLeastOne: "Seleziona almeno un motivo.",
        confirm: "Conferma"
    },

    signature: {
        title: "Firma del destinatario",
        instructions: "Firma nel riquadro.",
        nameLabel: "Nome di chi firma",
        namePlaceholder: "Nome e cognome (facoltativo)",
        summaryConfirm: "{name} · DDT {note}",
        summaryDelivered: "{count} colli consegnati",
        summaryDeliveredOne: "1 collo consegnato",
        summaryRejectedPackage: "Collo {id} rifiutato: {reasons}",
        summaryRejectTotal: "Consegna rifiutata: {reasons}",
        clear: "Cancella",
        confirm: "Conferma",
        doubleTitle: "Rifiuto consegna: firme",
        driver: "Firma dell'autista",
        consignee: "Firma del destinatario",
        send: "Registra rifiuto",
        viewTitle: "Firme acquisite",
        none: "Nessuna firma registrata per questa consegna.",
        info: "{strokes} · {points} punti · {seconds} s",
        strokesOne: "1 tratto",
        strokesMany: "{count} tratti",
        saveFailed: "Registrazione della firma non riuscita."
    },

    role: {
        driver: "Autista",
        consignee: "Destinatario"
    },

    trace: {
        title: "Operazioni: {name}",
        empty: "Nessuna operazione registrata.",
        PACKAGE_SCANNED: "Collo {id} scaricato",
        PACKAGE_SCAN_CANCELLED: "Collo {id}: scarico annullato",
        PACKAGE_REJECTED: "Collo {id} rifiutato: {reasons}",
        DELIVERY_CONFIRMED: "Consegna confermata",
        DELIVERY_SIGNED: "Firma acquisita ({role})",
        DELIVERY_REJECTED: "Consegna rifiutata: {reasons}",
        sync: {
            pending: "da inviare",
            synced: "inviato",
            error: "errore di invio"
        }
    },

    status: {
        not_started: "Da scaricare",
        in_progress: "In scarico",
        confirmed: "Firma mancante",
        confirmed_with_exceptions: "Confermata con riserva",
        pending_sync: "Confermata",
        synced: "Confermata",
        rejected: "Rifiutata"
    },

    sync: {
        pending: "Da inviare",
        error: "Errore di invio",
        synced: "Inviata",
        deliverySynced: "Consegna inviata.",
        deliveryErrored: "Consegna salvata. Il server ha rifiutato alcuni dati: da verificare.",
        deliveryOffline: "Consegna salvata sul dispositivo. L'invio verrà ritentato automaticamente.",
        flushedOne: "1 consegna inviata.",
        flushedMany: "{count} consegne inviate."
    },

    reason: {
        wrongScan: "Scansione errata",
        missing: "Collo mancante",
        damaged: "Ammaccato / rigato",
        wet: "Bagnato",
        torn: "Strappato",
        palletDefect: "Difetto pallet",
        refusedByConsignee: "Rifiutato dal cliente",
        duplicateOrder: "Ordine doppio",
        unloadedDamaged: "Scaricato – ammaccato / rigato",
        unloadedWet: "Scaricato – bagnato"
    }
};
