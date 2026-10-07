# Delicon — Contratto API backend

> **Stato: proposta (endpoint TBD).** È il contratto che l'app implementa oggi in `src/backend/restBackend.js`. Indirizzo, path e autenticazione sono configurabili (vedi `.env.example`) e vanno fissati con chi realizza il backend.
> I nomi dei campi sono quelli del modello canonico: vedi [DATA-MODEL.md](DATA-MODEL.md).

## Configurazione lato app

| Variabile | Default | Uso |
|---|---|---|
| `VITE_BACKEND` | `mock` | `mock` (dati demo) oppure `rest` |
| `VITE_API_BASE_URL` | — | Origine del servizio, es. `https://api.example.com` |
| `VITE_API_SHIPMENT_PATH` | `/shipments/{shipmentId}` | Path della lettura trasporto |
| `VITE_API_EVENTS_PATH` | `/shipments/{shipmentId}/events` | Path dell'invio eventi |
| `VITE_API_AUTH` | `none` | `none`, `bearer`, `basic`, `apikey` |
| `VITE_API_CREDENTIALS` | — | Token, `utente:password` o chiave |
| `VITE_API_KEY_HEADER` | `X-Api-Key` | Header per `apikey` |
| `VITE_API_TIMEOUT_MS` | `15000` | Oltre questo limite la richiesta è considerata un errore di rete |
| `VITE_DEMO_SHIPMENT_ID` | `0000000873` | Trasporto servito sempre dal mock, anche con `rest` |

`{shipmentId}` viene sostituito con il valore codificato per URL.

## 1. Lettura trasporto

```
GET {base}{shipmentPath}
Accept: application/json
```

**200** — consegne con colli annidati:

```json
{
  "shipmentId": "0000000873",
  "deliveries": [
    {
      "deliveryId": "0001",
      "sequence": 1,
      "deliveryNumber": "0090012345",
      "deliveryNoteNumber": "603967",
      "consignee": {
        "name": "Mobili Rossi S.r.l.",
        "street": "Via Garibaldi", "houseNumber": "14",
        "postalCode": "20121", "city": "Milano", "region": "MI", "country": "IT"
      },
      "expectedPackageCount": 4,
      "packages": [
        { "packageId": "000000013178", "barcode": "00380123450000000017", "lineId": "000010",
          "articleCode": "ART-735-BI", "description": "Armadio 2 ante – fianchi e schienale" }
      ]
    }
  ]
}
```

| Regola | |
|---|---|
| Obbligatori | `deliveries[]`, `deliveries[].deliveryId`, `packages[].packageId` |
| Opzionali | Tutto il resto. `expectedPackageCount` assente = numero di colli elencati; `sequence` assente = ordine per `deliveryId` |
| `barcode` | Se presente, lo scanner confronta l'etichetta con questo campo invece che con `packageId` |
| Tipi | Gli identificativi sono stringhe opache; `sequence` e `expectedPackageCount` sono numeri (stringhe numeriche accettate) |

Il file completo d'esempio è `src/backend/fixtures/demo-shipment.json`: il mock lo legge con lo stesso parser del backend reale.

**Errori:** `404` = trasporto inesistente. `408`, `425`, `429`, `5xx` o nessuna risposta = errore temporaneo, l'operatore può riprovare. Altri `4xx` = errore mostrato con il messaggio del server.

## 2. Invio eventi

```
POST {base}{eventsPath}
Content-Type: application/json
Accept: application/json
```

```json
{
  "schemaVersion": 1,
  "shipmentId": "0000000873",
  "device": { "deviceId": "3f2a9c1e-…", "appVersion": "0.1.0", "platform": "android" },
  "events": [
    { "eventId": "6f1c…", "type": "PACKAGE_SCANNED", "shipmentId": "0000000873", "deliveryId": "0002",
      "occurredAt": "2026-10-07T08:15:02.117Z", "packageId": "000000013190", "scannedCode": "000000013190" },
    { "eventId": "a93e…", "type": "PACKAGE_REJECTED", "shipmentId": "0000000873", "deliveryId": "0002",
      "occurredAt": "2026-10-07T08:15:40.002Z", "packageId": "000000013192", "reasons": ["WET"] },
    { "eventId": "e71a…", "type": "PACKAGE_PHOTO_TAKEN", "shipmentId": "0000000873", "deliveryId": "0002",
      "occurredAt": "2026-10-07T08:15:58.731Z", "packageId": "000000013192",
      "photo": { "image": "data:image/jpeg;base64,/9j/4AAQ…", "width": 1280, "height": 960 } },
    { "eventId": "0b27…", "type": "DELIVERY_CONFIRMED", "shipmentId": "0000000873", "deliveryId": "0002",
      "occurredAt": "2026-10-07T08:16:10.410Z" },
    { "eventId": "c5d8…", "type": "DELIVERY_SIGNED", "shipmentId": "0000000873", "deliveryId": "0002",
      "occurredAt": "2026-10-07T08:16:10.411Z", "signerRole": "consignee", "signerName": "Laura Bianchi",
      "signature": { "image": "data:image/png;base64,iVBOR…", "strokeCount": 4, "pointCount": 182, "durationMs": 2310 } }
  ]
}
```

Tipi evento e campi: vedi [DATA-MODEL.md § Eventi](DATA-MODEL.md#eventi-outbox).

`device` identifica il palmare (`deviceId`: UUID generato alla prima esecuzione, cambia solo se si cancellano i dati dell'app), la versione dell'app e la piattaforma (`android` o `web`). Serve per assistenza, audit e per gestire versioni diverse sul campo.

### Quando l'app invia
- Subito dopo la **chiusura** di una consegna (conferma con firma, oppure rifiuto totale con doppia firma): tutti gli eventi non ancora sincronizzati **di quella consegna**.
- In automatico, per le consegne chiuse rimaste in attesa: all'avvio, al ritorno in primo piano, quando torna la connessione e dopo un download riuscito.
- Le consegne **aperte** non vengono mai inviate: il dataset sarebbe incompleto.

### Requisiti per il server
1. **Idempotenza per `eventId` (obbligatoria).** L'app reinvia lo stesso evento dopo errori di rete o timeout. Un `eventId` già ricevuto va ignorato, senza duplicare dati.
2. **Ordine.** Gli eventi arrivano ordinati per `occurredAt`, ma il server non deve dipendere dall'ordine di arrivo tra invii diversi.
3. **Log grezzo.** È consigliato conservare gli eventi così come arrivano (audit, nuove riduzioni future).

### Risposte

| Risposta | Effetto sull'app |
|---|---|
| `2xx` senza corpo, oppure senza `results` | Tutti gli eventi → sincronizzati |
| `2xx` con `{ "results": [{ "eventId", "status", "message?" }] }` | Per evento: `accepted` o `duplicate` → sincronizzato; `rejected` → in errore con `message`. Gli eventi non citati sono considerati accettati |
| `4xx` (escluso `408`, `425`, `429`) | Tutti gli eventi → in errore, con il messaggio letto da `{ "message" }` o `{ "error": { "message" } }` |
| `408`, `425`, `429`, `5xx`, timeout, nessuna risposta | Nessuna modifica: gli eventi restano in attesa e verranno ritentati |

Gli eventi in errore vengono comunque ritentati ai trigger automatici: un errore corretto lato server si risolve senza intervento sul device.

### Riduzione lato server

Regole che riproducono lo stato mostrato dall'app (`src/domain/projection.js`):

- **Collo** (`shipmentId` + `deliveryId` + `packageId`): vale l'ultimo evento per `occurredAt`. `PACKAGE_SCANNED` → scaricato, `PACKAGE_SCAN_CANCELLED` → da scaricare, `PACKAGE_REJECTED` → rifiutato con `reasons`.
- **Consegna** (`shipmentId` + `deliveryId`): `DELIVERY_REJECTED` → rifiutata, indipendentemente dai colli. Altrimenti con `DELIVERY_CONFIRMED` → confermata, oppure **confermata con eccezioni** se nello stato finale c'è almeno un collo rifiutato.
- **Firma** (`shipmentId` + `deliveryId` + `signerRole`): una per ruolo. `signature.image` è un data-URL PNG base64 da decodificare e archiviare.
- **Foto del collo** (`eventId`): `PACKAGE_PHOTO_TAKEN` non cambia lo stato del collo; ogni evento è una foto da archiviare come allegato del collo (`photo.image`, data-URL JPEG base64). Un collo può averne più di una. Le foto eliminate dall'operatore prima della chiusura non vengono inviate, e nemmeno la loro eliminazione (`PACKAGE_PHOTO_REMOVED` resta sul dispositivo): il server riceve solo le foto valide.

## Punti aperti (TBD)

| Tema | Note |
|---|---|
| **Autenticazione** | Le variabili `VITE_*` finiscono nel bundle: vanno bene per test e demo, **non** per segreti di produzione. Da definire: login per operatore (token a scadenza), credenziali per device (MDM), mTLS… |
| **Identità dell'operatore** | Il palmare è identificato (`device`), l'operatore no: arriverà con l'autenticazione (`operatorId` nella busta) |
| **Dimensione del batch** | Firma ridotta a 1× (pochi KB); ogni foto di collo rifiutato circa 100–250 KB. Una consegna con più colli rifiutati e fotografati può superare il MB: da fissare il limite lato server, o prevedere l'invio delle foto a parte |
| **CORS** | Nell'APK le chiamate partono dal layer nativo (CapacitorHttp): CORS non serve. Serve solo se l'app viene usata da browser |
| **Elenco trasporti assegnati** | Oggi l'operatore digita o scansiona il numero. Un endpoint "trasporti dell'operatore" eviterebbe l'inserimento manuale |
| **Catalogo motivi da backend** | Oggi il catalogo è nella configurazione dell'app; potrebbe essere scaricato insieme al trasporto |
