# Stile «Spunta»

L'interfaccia di Delicon riprende il **foglio di spunta**, il modulo su cui si contano e si controllano i colli: una riga per collo, una casella da riempire, un'etichetta piccola in ogni riquadro, come sul DDT. I colori sono quelli RAL della serie *traffico*, fatti per essere letti all'aperto.

Le regole qui sotto valgono per ogni schermata nuova. I valori stanno in `src/styles/tokens.css`, le classi condivise in `src/styles/base.css`.

## Regole

1. **Il giallo indica dove agire.** `--signal` (giallo traffico) va solo sull'azione successiva della schermata, con `.btn-primary`: Scarica, Spara, Conferma consegna. Mai per uno stato, mai come decorazione. Una schermata ha al massimo un pulsante giallo visibile alla volta.
2. **Il colore è un esito.** Verde `--ok` scaricato o confermato, rosso `--ko` rifiutato o errore, arancio `--warn` da verificare. Sempre insieme a una forma (casella, quadrato) e a un testo.
3. **Tratteggiato vuol dire provvisorio.** Ciò che è salvato sul dispositivo ma non ancora inviato ha il marcatore tratteggiato (`StatusChip` con tono `pending`).
4. **Il codice si legge dalla fine.** I codici passano da `CodeText`, che attenua gli zeri iniziali.
5. **Ogni dato ha la sua etichetta nella cella.** Etichetta piccola in alto (`.cell-label`), valore grande sotto (`.cell-value`).

## Colori

| Token | Chiaro | Ruolo |
|---|---|---|
| `--ink` | nero traffico RAL 9017 | Testo, contorni, filetti forti |
| `--sheet` | bianco | Fondo dei dati |
| `--paper` | grigio luce RAL 7035, schiarito | Fondo pagina |
| `--head` | nero traffico | Intestazione, scura anche nel tema chiaro |
| `--signal` | giallo traffico RAL 1023 | Azione successiva |
| `--ok` | verde traffico RAL 6024 | Esito positivo |
| `--ko` | rosso traffico RAL 3020 | Rifiuto, errore |
| `--warn` / `--warn-ink` | arancio traffico RAL 2009 | Da verificare: `--warn` solo come fondo, `--warn-ink` per il testo |

I valori sRGB sono approssimati ai RAL e regolati per il contrasto WCAG AA. Il tema scuro ridefinisce gli stessi token: verde, rosso e arancio si schiariscono, il giallo resta uguale.

## Caratteri

Inclusi nel pacchetto (`src/styles/fonts.css`, da `@fontsource`, licenza SIL OFL), solo sottoinsieme latino woff2, circa 113 KB:

- **Barlow** 400 e 600 (`--font`): testo.
- **Barlow Semi Condensed** 500, 600, 700 (`--font-cond`): titoli, etichette in maiuscolo, pulsanti, numeri e codici, sempre con `font-variant-numeric: tabular-nums`.

Per usare un peso nuovo bisogna aggiungerlo in `fonts.css`, altrimenti il browser lo simula.

## Forme

- Spigoli vivi, nessuna ombra, nessun `border-radius`.
- I blocchi si separano con filetti: `--rule` (2px, inchiostro) apre e chiude un blocco, `--hair` (1px) separa righe e celle.
- Gli elenchi vanno da bordo a bordo (`.sheet.rows.bleed`), non sono card staccate.
- Pulsanti solo testo, in maiuscolo stretto. Le icone servono per il tasto indietro, il tema e le caselle di stato, non per decorare i pulsanti.
- I dialog sono pannelli che salgono dal basso (`ui/Modal.vue`).

## Componenti grafici

| Componente | Uso |
|---|---|
| `ui/StatusChip.vue` | Marcatore di stato: quadrato vuoto (da fare), mezzo pieno (in corso), pieno colorato (esito), tratteggiato (da inviare) |
| `ui/CodeText.vue` | Qualsiasi testo con codici: attenua gli zeri iniziali dei numeri di 4 o più cifre |
| `ui/Tally.vue` | Barra a tacche, una tacca per collo o consegna; oltre 24 elementi diventa continua |
| `ui/BrandMark.vue` | Logo (vedi sotto) |
| `ui/Icon.vue` | Icone a tratto squadrato da 2,5px, disegnate per Delicon |
| `.band` (base.css) | Esito di un'azione: fascia a colore pieno |
| `.field` (base.css) | Campo con l'etichetta dentro la cella; `.field__row` + `.field__key` per il pulsante tastiera |
| `ui/softKeyboard.js` | Tastiera a schermo su richiesta per i campi letti dallo scanner |
| `components/CameraScanView.vue` | Lettura con la fotocamera: maschera scura, mirino con gli angoli gialli (il giallo indica dove agire), esito e conteggio in basso; "Fine" diventa giallo quando tutti i colli sono gestiti |

## Logo

Il cubo di Cube Italy con la spunta di Delicon: cubo isometrico con il corpo antracite (`#1C1E1F`) e grigio (`#5C5F62`) e la faccia superiore lime Cube (`#9AE949`) sollevata sopra una fessura scura (`#0C0D0E`); la spunta in giallo traffico, bordata di nero, esce dal cubo verso l'alto a destra. Fondo antracite neutro `#3A3D41`: abbastanza chiaro da staccare la faccia sinistra del cubo, e scuro come il mondo del marchio Cube. I colori sono fissi, uguali nei due temi.

Lo stesso disegno, su griglia 48×48, sta in `src/ui/BrandMark.vue`, `public/favicon.svg` e nell'icona Android (`res/drawable/ic_launcher_foreground.xml`, più `ic_launcher_monochrome.xml` per le icone a tema). Se cambia, va cambiato in tutti e tre.

## Campi letti dallo scanner

La tastiera a schermo non si apre da sola: i campi hanno `inputmode="none"`, restano a fuoco e ricevono i codici dello scanner. Il pulsante con l'icona della tastiera, attenuato, la mostra quando serve digitare; dopo l'invio o all'uscita dal campo si torna senza tastiera (`ui/softKeyboard.js`). Un campo nuovo letto dallo scanner deve seguire lo stesso schema.

## Da evitare

Card arrotondate con ombra, pillole colorate con fondo pastello, icone dentro cerchi colorati, bordo sinistro colorato sulle card, barre di avanzamento arrotondate, un colore di accento su tutti i pulsanti. Sono i segni che rendono un'interfaccia generica, ed è da questi che Spunta si stacca.
