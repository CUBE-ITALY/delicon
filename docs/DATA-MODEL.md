# Delicon — Modello dati canonico e mappature

Questo documento è il **dizionario** di Delicon: definisce i nomi usati nel codice, nel database locale, negli eventi e nell'API, e per ciascuno indica il **campo corrispondente nei sistemi sorgente**. Oggi c'è la colonna SAP, ricavata dal PoC `deliverycontrol`. Per portare Delicon su un altro sistema si aggiunge una colonna e si scrive l'adattatore che la implementa.

## Principi

1. **Nomi di business, non tecnici.** `deliveryNoteNumber`, non `XABLN`. Chi legge il codice capisce il significato senza conoscere il sistema sorgente.
2. **Gli identificativi sono opachi.** Il core non fa ipotesi su lunghezza, zeri iniziali o formato (`"0001"`, `"1"` e `"A-1"` sono tutti validi). Normalizzazioni come l'ALPHA di SAP vivono **solo** nell'adattatore.
3. **La mappatura vive ai bordi.** Solo `src/backend/` (o il server che implementa [API.md](API.md)) conosce i nomi esterni. Il resto dell'app parla solo questo modello.
4. **I codici sono stabili, le etichette no.** Motivi di rifiuto e stati si salvano come codice; il testo dipende dalla lingua.

## Entità

### Trasporto — `Shipment`

| Campo canonico | Tipo | Significato | SAP (PoC `zui_transport_scan`) | Note |
|---|---|---|---|---|
| `shipmentId` | string | Identificativo del trasporto | `tknum` (VTTK-TKNUM) | SAP usa ALPHA a 10 cifre (`0000000873`); l'adattatore normalizza |
| `downloadedAt` | ISO 8601 | Momento del download sul device | — | Solo locale |

### Consegna — `Delivery`

| Campo canonico | Tipo | Significato | SAP | Note |
|---|---|---|---|---|
| `shipmentId` | string | Trasporto di appartenenza | `tknum` | |
| `deliveryId` | string | Chiave della consegna **nel trasporto** | `tpnum` (VTTP-TPNUM, posizione nel trasporto) | In alternativa `vbeln`, se univoco nel trasporto |
| `sequence` | number \| null | Ordine di scarico | `traid` | ⚠️ Nel PoC `traid` arriva come testo (`"001"`) ed è usato come sequenza. In SAP standard VTTK-TRAID è l'ID del mezzo: **origine da verificare**. L'adattatore lo converte in numero |
| `deliveryNumber` | string | Numero del documento di consegna | `vbeln` (LIKP-VBELN) | |
| `deliveryNoteNumber` | string | Numero del documento di trasporto (DDT) | `xabln` (LIKP-XABLN) | |
| `consignee.name` | string | Destinatario | `name1` (ADRC-NAME1) | |
| `consignee.street` | string | Via | `street` (ADRC-STREET) | Nei dati SAP a volte include già il civico |
| `consignee.houseNumber` | string | Civico | `house_num1` (ADRC-HOUSE_NUM1) | |
| `consignee.postalCode` | string | CAP | — (ADRC-POST_CODE1) | Non esposto oggi dal servizio PoC |
| `consignee.city` | string | Località | `city1` (ADRC-CITY1) | |
| `consignee.region` | string | Provincia / regione | `region` (ADRC-REGION) | |
| `consignee.country` | string | Paese ISO 3166-1 alpha-2 | — (ADRC-COUNTRY) | Non esposto oggi |
| `expectedPackageCount` | number | Colli attesi | `colli` (campo custom DEL_CTL_HD) | Se assente valgono i colli elencati |

### Collo — `Package`

| Campo canonico | Tipo | Significato | SAP | Note |
|---|---|---|---|---|
| `shipmentId`, `deliveryId` | string | Consegna di appartenenza | `tknum`, `tpnum` | |
| `packageId` | string | Identificativo del collo | `venum` (VEKP-VENUM, HU interna, CHAR 10) | È l'ID che va negli eventi |
| `barcode` | string (opz.) | Codice stampato sull'etichetta | `exidv` (VEKP-EXIDV, spesso SSCC) — **da confermare** | Se presente, lo scanner confronta questo campo; altrimenti `packageId`. Risolve il nodo "barcode → VENUM" del PoC |
| `lineId` | string | Riga del documento di consegna | `posnr` (LIPS-POSNR) | |
| `articleCode` | string | Codice articolo | `matnr` | |
| `description` | string | Descrizione articolo | `arktx` | |

## Eventi (outbox)

Ogni azione dell'operatore diventa un evento **append-only**. Lo stato si ricostruisce sempre dagli eventi (vedi `src/domain/projection.js`).

### Campi comuni

| Campo canonico | Significato | SAP `ingestBatch` (PoC) |
|---|---|---|
| `eventId` | UUID, chiave di idempotenza: mai rigenerato | `eventId` |
| `type` | Tipo evento (tabella sotto) | `type` |
| `shipmentId` | Trasporto | `tknum` |
| `deliveryId` | Consegna | `tpnum` |
| `occurredAt` | ISO 8601, orologio del device (strettamente crescente nella sessione) | `ts` |
| `syncStatus`, `syncMessage` | **Solo locali**, mai inviati | (nel PoC finivano per errore nel payload) |

### Tipi evento

| Canonico | Campi specifici | SAP `ingestBatch` (PoC) |
|---|---|---|
| `PACKAGE_SCANNED` | `packageId`, `scannedCode` | `SCAN` + `venum` (`scannedCode` non esiste nel PoC) |
| `PACKAGE_SCAN_CANCELLED` | `packageId` | `CANCEL_SCAN` + `venum` |
| `PACKAGE_REJECTED` | `packageId`, `reasons[]` | `REJECT_PACKAGE` + `venum`, `reasons` |
| `DELIVERY_CONFIRMED` | — | `CONFIRM` |
| `DELIVERY_REJECTED` | `reasons[]` | `REJECT_DELIVERY_TOTAL` + `reasons` |
| `DELIVERY_SIGNED` | `signerRole`, `signerName` (opz.), `signature` | `SIGN` + `signerRole`, `firma` (`signerName` non esiste nel PoC) |

### Firma

| Canonico | SAP `ingestBatch` (PoC) |
|---|---|
| `signerRole: "consignee"` | `signerRole` assente oppure `"destinatario"` |
| `signerRole: "driver"` | `signerRole: "corriere"` |
| `signature.image` (data-URL PNG base64) | `firma.image` |
| `signature.strokeCount` / `pointCount` / `durationMs` | `firma.strokeCount` / `pointCount` / `durationMs` |

Nel modello canonico `signerRole` è **sempre esplicito**, anche per la firma della conferma. `signerName` (nome di chi firma, facoltativo) è assente se non indicato.

L'immagine è salvata a 1 px per px logico dell'area di firma (circa 330×220 px su un palmare), non alla risoluzione fisica dello schermo: pesa pochi KB.

### Busta di invio

| Canonico ([API.md](API.md)) | SAP `ingestBatch` (PoC) |
|---|---|
| `{ schemaVersion, shipmentId, device: { deviceId, appVersion, platform }, events: [...] }` (JSON annidato) | `{ Tknum, EventsJson: "<array serializzato come stringa>" }` |

## Motivi di rifiuto

Catalogo di default in `src/config/rejectReasons.js`, configurabile per cliente.

| Codice Delicon | Codice PoC LAS (`ingestBatch`) | Etichetta IT |
|---|---|---|
| `DAMAGED` | `AMMACCATO_RIGATO` | Ammaccato / rigato |
| `WET` | `BAGNATO` | Bagnato |
| `TORN` | `STRAPPATO` | Strappato |
| `PALLET_DEFECT` | `DIFETTO_PALLET` | Difetto pallet |
| `REFUSED_BY_CONSIGNEE` | `RIFIUTATO_CLIENTE` | Rifiutato dal cliente |
| `DUPLICATE_ORDER` | `ORDINE_DOPPIO` | Ordine doppio |
| `UNLOADED_DAMAGED` | `SCARICATO_AMMACCATO_RIGATO` | Scaricato – ammaccato / rigato |
| `UNLOADED_WET` | `SCARICATO_BAGNATO` | Scaricato – bagnato |
| `WRONG_SCAN` | `SCANSIONE_UTENTE_ERRATA` | Scansione errata — **mai inviato**: annulla lo scarico |
| `MISSING` | — (nuovo, da concordare) | Collo mancante — solo per un collo **mai letto**: permette di chiudere la consegna anche se un collo non c'è |

## Stati derivati (mai persistiti)

| `DeliveryStatus` | PoC | Significato |
|---|---|---|
| `not_started` | `da_scaricare` | Nessun collo lavorato |
| `in_progress` | `in_scarico` | Almeno un collo scaricato o rifiutato |
| `confirmed` | `confermata` | Confermata, firma mancante (caso anomalo) |
| `confirmed_with_exceptions` | `confermata_con_riserva` | Confermata con almeno un collo rifiutato |
| `pending_sync` | `in_outbox` | Chiusa e firmata, non ancora inviata |
| `synced` | `sincronizzata` | Tutte le firme inviate |
| `rejected` | `rifiutata_totalmente` | Rifiuto totale |

`SyncState` (`none` / `pending` / `error` / `synced`) è **nuovo** e indipendente dallo stato: mostra l'invio anche per le consegne rifiutate o con eccezioni, che nel PoC non lo esponevano.

## Fare un porting: checklist

1. **Lettura.** Mappare l'origine dati del cliente sul payload `GET` di [API.md](API.md): campi obbligatori `deliveryId` e `packageId`, il resto è opzionale.
2. **Identificativi.** Stabilire cosa identifica una consegna nel trasporto (`deliveryId`) e cosa è stampato sull'etichetta del collo (`barcode` oppure `packageId`).
3. **Ordine di scarico.** Individuare la sorgente di `sequence` e convertirla in numero.
4. **Scrittura.** Ricevere la busta eventi, deduplicare per `eventId` e ridurre con le regole di [API.md](API.md#riduzione-lato-server).
5. **Motivi.** Concordare il catalogo con il cliente e la tabella codici Delicon ↔ codici del sistema.
6. **Aggiornare questo documento** con la colonna del nuovo sistema.
