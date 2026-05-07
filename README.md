# BEAR - Browser Extension for Academic Research

Una Chrome Extension modulare e data-driven progettata per condurre esperimenti comportamentali e sociologici su Reddit. 

Il sistema è costruito attorno a un'architettura **completamente agnostica rispetto ai dati**: il flusso dell'esperimento, la durata, i trigger comportamentali e gli interventi visivi (UI) sono interamente pilotati da una configurazione JSON fornita dal backend.

## ✨ Funzionalità Principali

* **Architettura Decoupled:** Il "Cervello" (Core Engine) è separato dalle "Mani e Occhi" (Platform Adapters). Questo permette di scalare il framework su altre piattaforme (es. YouTube, X, Facebook) scrivendo solo un nuovo Adapter.
* **Gestione SPA (Single Page Application):** Uno `SpaWatcher` personalizzato rileva i cambiamenti di URL in applicazioni React come Reddit senza dipendere dal ricaricamento fisico della pagina.
* **Timer Intelligente Multimodale:** Supporta sia timer assoluti (es. "scade tra 7 giorni") sia timer legati al **tempo attivo sulla piattaforma** (si mette in pausa se l'utente cambia scheda o minimizza il browser).
* **Telemetria Precisa:** Coda di invio asincrona tramite `background.js` (per aggirare policy CORS) con meccanismi di retry automatici per non perdere mai un singolo evento di analytics.
* **Survey Lifecycle:** Gestione end-to-end dello stato dell'utente (Enrolled, Pre-Survey, Active, Post-Survey) con Modali UI bloccanti non aggirabili.

---

## 📂 Struttura del Progetto

Il codice è organizzato seguendo il principio di **Separation of Concerns (SoC)**:

\`\`\`text
extension/
├── main.js                 # Entry point, inizializza le classi e avvia l'Engine
├── config.json             # (Caricato dal Backend) Il "DNA" dell'esperimento
│
├── engine/                 # Il Core agnostico
│   ├── core_engine.js      # La State Machine che orchestra l'esperimento
│   ├── interventions/      # Logica di manipolazione DOM (es. injectFakePost, hidePost)
│   └── operators/          # Operatori logici puri (CONTAINS_ANY, EQUALS)
│
├── adapters/               # L'interfaccia con la piattaforma ospite (Reddit/Google Forms)
│   ├── RedditAdapter.js    # Metodi UI specifici (es. creazione Modali bloccanti)
│   ├── google-forms/       # Script per tracciare il completamento dei survey
│   └── observers/          # Sensori sul DOM
│       ├── telemetry/      # Tracciano passivamente azioni per il backend (es. ClickOnLink)
│       └── triggers/       # Generano eventi per il Core Engine (es. SearchSubmitted)
│
├── services/               # Gestori logici di alto livello
│   ├── ApiManager.js       # Comunicazione REST e WebSocket via background.js
│   ├── SurveyManager.js    # Assemblaggio Deep Link e gestione Modali
│   └── TimerManager.js     # Gestione cronometri (Active Time vs Absolute Time)
│
└── utils/                  # Helper trasversali
    ├── SpaWatcher.js       # Intercetta History API
    └── logger.js           # Logging formattato per il debug
\`\`\`

---

## ⚙️ Come funziona: Il Flusso (Data-Driven)

1. **Avvio & Enrollment:** L'`ApiManager` controlla se esiste un `participantId` in memoria. Se assente, contatta il backend per registrarne uno nuovo.
2. **Safe Mode:** Il `core_engine` scarica la configurazione "Safe" per leggere i dati dei questionari e blocca la UI con il Modale del **Pre-Survey**.
3. **Armed Mode:** Una volta completato il Pre-Survey (`FormWatcher`), l'estensione ottiene il Gruppo (es. *TREATMENT1*) e scarica la configurazione completa.
4. **Ascolto Attivo:** Gli `Observer` (Sorgenti di Trigger) ascoltano il DOM. Se avviene un'azione definita nel `config.json` (es. `SearchSubmitted`), notificano l'Engine.
5. **Valutazione & Intervento:** L'Engine valuta le *Conditions* (es. `search_query CONTAINS_ANY ["vaccini", "5g"]`). Se c'è un match, esegue le funzioni *Intervention* assegnate a quel target group (es. `injectFakePost`).
6. **Chiusura:** Il `TimerManager` calcola il raggiungimento dell'obiettivo. Scaduto il tempo, il `SurveyManager` genera il Deep Link personalizzato e blocca Reddit con il Modale del **Post-Survey**.

---

## 🛠️ Estensibilità: Aggiungere nuovi comportamenti

Il framework è progettato per essere "Plug and Play".

* **Aggiungere una nuova Condizione:** Crea un file in `engine/operators/` (es. `STARTS_WITH.js`) ed esponilo globalmente. Usalo direttamente nel `config.json`.
* **Aggiungere un nuovo Intervento:** Crea un file in `engine/interventions/` con la logica desiderata. Mappalo in `config.json` nella sezione `interventions` dichiarando il suo `function_fqn`.
* **Aggiungere un nuovo Tracciamento:** Crea un nuovo Observer estendendo `BaseObserver`, avvialo nel Registro e inserisci il suo nome in `telemetry_settings.track_events` nel JSON di configurazione.

---

## 🚀 Installazione (Developer Mode)

1. Clona questo repository.
2. Apri Google Chrome e vai su `chrome://extensions/`.
3. Attiva la modalità **Sviluppatore** (in alto a destra).
4. Clicca su **Carica estensione non pacchettizzata** (Load unpacked).
5. Seleziona la cartella radice del progetto.
6. Apri la console su Reddit per visionare i log strutturati.
