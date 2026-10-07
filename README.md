# Delicon

Controllo consegne **offline-first** per palmari di magazzino e corrieri: l'operatore scarica un trasporto, legge i colli, chiude ogni consegna con la firma del destinatario o la rifiuta (parzialmente o totalmente), e l'app invia gli esiti al backend appena c'è connessione.

Nasce dal PoC `deliverycontrol` (SAPUI5 + SAP). È un prodotto **indipendente da SAP**: interfaccia propria, modello dati con nomi di business, backend REST configurabile. Il PoC resta invariato nella cartella accanto.

## Stack

| | |
|---|---|
| UI | Vue 3 + Vite |
| Persistenza | IndexedDB (outbox a eventi + snapshot del trasporto) |
| App nativa | Capacitor 8 (Android) |
| Test | Vitest + fake-indexeddb |
| Linguaggio | JavaScript (ES modules), tipi documentati con JSDoc |

## Comandi

```bash
npm install
npm run dev            # server di sviluppo
npm test               # test automatici
npm run build          # build di produzione in dist/
npm run android:sync   # build + copia nel progetto Android
npm run android:open   # apre Android Studio (poi Run ▶ sul dispositivo)
```

Dettagli su Android, debug e configurazione dello scanner Zebra: [docs/ANDROID.md](docs/ANDROID.md).

## Configurazione

Copiare `.env.example` in `.env`. Senza configurazione l'app usa il **backend dimostrativo** (trasporto demo `0000000873`): l'invio riesce con Wi-Fi o dati attivi e fallisce senza, come farebbe il backend reale.

## Struttura

```
src/
  views/       schermate: Home, Trasporto, Consegna
  components/  componenti di dominio: firma, doppia firma, motivi, firme, traccia
  ui/          componenti generici (header, modale, chip, icone), avvisi, tema, formattazione
  styles/      caratteri, design token (chiaro/scuro) e stili di base: vedi docs/STILE.md
  i18n/        testi dell'interfaccia (italiano)
  app/         collegamento tra servizi e interfaccia (retry outbox, avvisi di invio)
  config/      configurazione applicativa e catalogo motivi di rifiuto
  domain/      modello canonico (model.js) e Projection: funzioni pure
  data/        IndexedDB (snapshot + outbox append-only)
  backend/     mock, REST (endpoint TBD), parser del payload, dati demo
  platform/    ambiente, rete, HTTP, audio, scanner
  services/    comandi dell'app, sincronizzazione, retry automatico
tests/         test automatici
docs/
  DATA-MODEL.md  dizionario dati e mappature verso i sistemi sorgente (SAP)
  API.md         contratto del backend
  ANDROID.md     app nativa: build, debug, scanner Zebra, versione
  STILE.md       stile «Spunta»: colori, caratteri, regole, componenti grafici
android/         progetto nativo Capacitor (versionato)
```

## Principi

- **L'outbox è append-only.** Ogni azione è un evento; lo stato si ricostruisce sempre dagli eventi e non viene mai salvato. L'unica modifica ammessa è lo stato di invio.
- **Comandi composti atomici.** Conferma + firma e rifiuto + due firme vengono scritti in un'unica transazione.
- **Invio idempotente.** Ogni evento ha un `eventId` stabile: i reinvii sono sicuri.
- **Nessun nome di sistema sorgente fuori da `src/backend/`.** Vedi [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Stato

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Fondamenta: logica, dati, backend mock/REST, contratto, test | ✅ |
| 2 | Interfaccia e stile | ✅ |
| 3 | Android (Capacitor, tasto indietro, barra di stato, backup off, versione unica) | ✅ |
| 4 | Rifinitura: collo mancante, riepilogo e nome nella firma, firma leggera, identità del dispositivo, icona e splash, firma di rilascio | ✅ |
| 5 | Stile «Spunta»: foglio di spunta e colori RAL, caratteri Barlow inclusi, nuova icona | ✅ |
| — | Traduzione in inglese (infrastruttura pronta in `src/i18n/`) | secondaria |
