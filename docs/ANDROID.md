# Delicon su Android

App nativa con Capacitor 8 · pacchetto `it.cube.delicon` · nome visualizzato "Delicon".

## Requisiti

| | |
|---|---|
| Node | 20.19+ o 22.12+ |
| Android Studio | con il JDK 21 incluso (`jbr/`) e l'SDK Android 36 |
| Dispositivo | Android 8.0+ (minSdk 26), con debug USB attivo |

## Ciclo di lavoro

```bash
npm install            # solo la prima volta o dopo modifiche a package.json
npm run android:sync   # build web + copia nel progetto Android (= vite build && cap sync android)
npm run android:open   # apre il progetto in Android Studio
```

In Android Studio: scegli il dispositivo collegato e premi **Run ▶**.

Dopo ogni modifica al codice web basta rifare `npm run android:sync` e premere di nuovo Run: non serve riaprire Android Studio.

**Niente service worker nell'APK.** I file dell'app sono dentro il pacchetto e li serve Capacitor: dopo un Run si vede subito la versione nuova. Non servono `pm clear` né cambi di nome della cache come nel PoC.

**I dati restano sul dispositivo** (IndexedDB: trasporti scaricati e outbox degli esiti) tra un'installazione e l'altra. Disinstallare l'app o fare `adb shell pm clear it.cube.delicon` li **cancella, esiti non ancora inviati compresi**.

**JVM di Gradle.** `android/gradle/gradle-daemon-jvm.properties` chiede a Gradle un **JDK 21 di qualunque produttore**: il JDK incluso in Android Studio va bene e non si scarica nulla. Va tenuto nel repository. Senza questo file, Android Studio (dalla versione 2026.1) prova a generarlo richiedendo il proprio JDK JetBrains, che non è scaricabile, e la sincronizzazione fallisce con *"Undefined Toolchain Download Repositories"*. Per rigenerarlo: `cd android && ./gradlew updateDaemonJvm` (senza `--jvm-vendor`).

## Debug

- **Console, rete, dati:** sul PC apri `chrome://inspect/#devices` in Chrome o Edge, poi "inspect" sotto Delicon. In *Application → IndexedDB → delicon* trovi `outbox` (gli eventi) e gli snapshot dei trasporti.
- **Log nativi:** Logcat di Android Studio, filtro `Capacitor`.
- **Ricaricamento automatico (opzionale, da provare):** con il device collegato via USB:
  ```bash
  npm run dev -- --port 5173
  adb reverse tcp:5173 tcp:5173
  npx cap run android --live-reload --host localhost --port 5173
  ```
  L'app sul device carica i file dal PC e si aggiorna a ogni salvataggio. Per tornare alla build normale: `npm run android:sync` e Run.

## Scanner Zebra (DataWedge)

L'app riceve i codici come **tastiera**: lo scanner scrive nel campo attivo e invia Invio. Il profilo DataWedge del PoC è legato al pacchetto `it.lasmobili.deliverycontrol` e **non vale per Delicon**: ne serve uno nuovo.

1. DataWedge → menu → **Nuovo profilo**, es. `Delicon`.
2. **App associate** → aggiungi `it.cube.delicon`, attività `*`.
3. **Ingresso codici a barre:** attivo, con i decoder delle etichette in uso (es. Code 128, GS1-128, EAN-13, DataMatrix).
4. **Uscita tastiera (Keystroke output):** attiva. In *Formattazione dati di base* attiva **"Invia tasto INVIO"**, senza prefisso o suffisso.
5. **Uscita intent:** disattiva.
6. **Suono di lettura dello scanner:** in *Parametri lettore → Decode Audio Feedback* scegli **Nessuno**: i suoni (ok, codice estraneo, già letto) li emette l'app.

Prova: nella schermata di una consegna il campo "Codice collo" è già attivo, quindi una lettura registra subito il collo.

**Tastiera a schermo.** Il campo è a fuoco ma la tastiera **non si apre**: lo scanner non ne ha bisogno, e la sua apertura coprirebbe metà schermata e potrebbe far perdere una lettura ravvicinata. Per digitare un codice a mano si tocca l'icona della tastiera dentro il campo; dopo l'invio la tastiera si richiude. Vale anche per il campo "Numero trasporto" in home.

Se con DataWedge le letture non arrivano nel campo (succede su alcune versioni con certe impostazioni), prova ad attivare nelle impostazioni dell'uscita tastiera l'opzione **Send Characters as Events** ("invia caratteri come eventi").

## Comportamento nativo

| | |
|---|---|
| **Tasto indietro** | Chiude il dialog aperto. Altrimenti risale: consegna → trasporto → home. Dalla home manda l'app in background senza chiuderla |
| **Ritorno in primo piano** | Ritenta l'invio degli esiti in attesa (come all'avvio e quando torna la rete) |
| **Barra di stato** | Icone chiare o scure secondo il tema scelto nell'app |
| **Backup** | Disattivato (`allowBackup=false` + regole di estrazione): firme e dati dei destinatari non finiscono nel backup cloud né nel trasferimento su un altro telefono |
| **Convivenza col PoC** | Pacchetto diverso da `it.lasmobili.deliverycontrol`: si possono installare entrambe, con dati separati |

## Versione

La versione è una sola, in `package.json` (`"version": "0.1.0"`). Il build Android la legge da lì:

- `versionName` = la versione (es. `0.1.0`);
- `versionCode` = `MAJOR*10000 + MINOR*100 + PATCH` (es. `0.1.0` → `100`).

Per una nuova versione si cambia solo `package.json`.

## Icona e schermata di avvio

Sono **vettoriali** (XML Android), senza PNG per densità: si modificano a mano e restano nitide su ogni schermo.

| File | Contenuto |
|---|---|
| `res/drawable/ic_launcher_foreground.xml` | Logo: cubo Cube Italy con la spunta gialla (lo stesso disegno di `public/favicon.svg` e di `src/ui/BrandMark.vue`, vedi `docs/STILE.md`) |
| `res/drawable/ic_launcher_monochrome.xml` | Versione a un colore per le icone a tema di Android 13+ |
| `res/values/ic_launcher_background.xml` | Colore di fondo dell'icona: antracite del logo `#3A3D41` |
| `res/mipmap-anydpi/ic_launcher*.xml` | Icona adattiva: fondo, logo e versione monocromatica |
| `res/drawable/splash.xml` + `values/colors.xml` | Splash fino ad Android 11: fondo nero `#151615`, logo al centro sul suo cerchio antracite |
| `res/values/styles.xml` (`windowSplashScreen*`) | Splash di sistema da Android 12: stesso fondo nero, logo sul cerchio antracite (`windowSplashScreenIconBackgroundColor`) |

## Firma per il rilascio

La build di debug è firmata automaticamente con la chiave di debug di Android Studio, che vale solo per il PC su cui gira. Per distribuire l'app sui palmari dei clienti serve una **chiave di rilascio**, sempre la stessa: Android accetta un aggiornamento solo se è firmato con la chiave della versione installata.

**1. Creare la chiave (una volta sola).** Il JDK di Android Studio include `keytool`:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair `
  -keystore delicon-release.jks -alias delicon -keyalg RSA -keysize 4096 -validity 10000 `
  -dname "CN=Delicon, O=Cube Italy, C=IT"
```

Conserva il file `.jks` e le password **fuori dal repository**, con una copia di sicurezza (es. nel gestore password aziendale). Se la chiave si perde, sui palmari già installati l'app non si aggiorna più: bisogna disinstallarla, e così si perdono i dati locali.

**2. Collegarla al progetto.** Copia `android/keystore.properties.example` in `android/keystore.properties` (ignorato da git) e compila percorso e password.

**3. Generare l'APK firmato:**

```bash
npm run android:sync
cd android && ./gradlew assembleRelease     # Windows: gradlew.bat assembleRelease
```

Il risultato è `android/app/build/outputs/apk/release/app-release.apk` (circa 3 MB). Senza `keystore.properties` la build di rilascio produce un APK **non firmato**, che non si può installare. In alternativa: Android Studio → *Build → Generate Signed App Bundle / APK*.

## Rete e certificati

- **Mock (default):** nessuna chiamata di rete. Conta solo se il device ha Wi-Fi o dati attivi.
- **Backend REST:** le chiamate partono dal layer nativo (CapacitorHttp), quindi nessun problema di CORS. Un server HTTPS con certificato pubblico funziona senza configurazione.
- **Certificato di una CA privata:** serve un `network_security_config.xml` con la CA come trust anchor, limitato al dominio del backend. Delicon **non** eredita il bypass TLS "accetta tutto" del PoC, e non deve averlo.

## Da fare

- Creare la chiave di rilascio definitiva (vedi sopra): la configurazione è pronta, manca solo la chiave.
- Profilo DataWedge distribuibile (file `.db` esportato) per configurare più palmari in un colpo.
