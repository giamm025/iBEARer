# iBEARer: in-Browser Experiments on Algorithmic Re-ranking

## 📖 Panoramica del Progetto

[cite_start]**iBEARer** è un'infrastruttura software distribuita (Client/Server) progettata per la conduzione di "Audit Studies" e test A/B sulle piattaforme di social media[cite: 5, 8]. [cite_start]Il sistema permette ai ricercatori di manipolare dinamicamente l'esperienza utente a fini sperimentali (es. re-ranking dei feed, iniezione di contenuti controllati, occultamento di post) aggirando le rigorose policy di sicurezza introdotte dal Google Manifest V3[cite: 2]. 

[cite_start]Nato come esperimento pilota su Reddit [cite: 8][cite_start], il sistema è stato ingegnerizzato come una libreria flessibile e agnostica rispetto alla piattaforma, permettendo l'estensione a futuri ambienti (es. YouTube, X) tramite l'implementazione di Adapter specifici[cite: 6].

---

## ✨ Funzionalità Principali

* [cite_start]**Manipolazione del DOM a Runtime:** Intercetta e modifica i nodi HTML dopo il rendering del browser, superando l'impossibilità di intercettare nativamente le chiamate API JSON nei framework SPA[cite: 3, 4].
* [cite_start]**Rules Engine Dichiarativo:** Il core dell'estensione interpreta file di configurazione (`config.json`) basati su logica dichiarativa, disaccoppiando le regole sperimentali (trigger, operatori, interventi) dal codice sorgente esecutivo[cite: 16, 17, 92].
* [cite_start]**Gestione di A/B Testing Multi-Gruppo:** Assegnazione dinamica e filtrazione lato server delle configurazioni per supportare esperimenti complessi con gruppi di trattamento multipli e gruppi di controllo (sola telemetria)[cite: 59, 60].
* [cite_start]**Telemetria Asincrona e WebSocket:** Architettura di comunicazione bidirezionale in tempo reale tra client e server tramite un'infrastruttura ASGI (Django Channels), accoppiata a un sistema di code bufferizzate lato client per minimizzare il carico di rete[cite: 13, 14, 44].
* **Generazione AI in Tempo Reale:** Modulo integrato per l'iniezione programmatica di contenuti (fake post) generati dinamicamente o contestualizzati tramite Large Language Models (LLM) sui feed degli utenti.
* [cite_start]**Tracciamento Multi-Sessione:** Meccanismi resilienti di mantenimento dello stato (timer su disco locale, `SpaWatcher` per il context reset) in grado di sopravvivere ad aggiornamenti della pagina e micro-disconnessioni[cite: 51, 65, 66, 67].

---

## 🏗️ Architettura del Sistema

[cite_start]Il progetto adotta una chiara separazione delle responsabilità (Separation of Concerns) e sfrutta diversi Design Pattern formali[cite: 92].

### 1. Frontend (Estensione Browser)
[cite_start]Sviluppata in Vanilla JavaScript senza dipendenze pesanti esterne, l'estensione utilizza un'architettura a eventi[cite: 57]:
* **Service Worker (Background):** Agisce come un isolante di sicurezza. [cite_start]Si occupa in via esclusiva di tutte le chiamate di rete (HTTP/WebSocket) aggirando i blocchi CORS e CSRF imposti alle finestre dei domini di terze parti[cite: 38, 39].
* **Motore Centrale (Core Engine):** Coordina il Registry Pattern. [cite_start]Intercetta gli eventi sollevati dagli Observer passivi, valuta gli Operator in base alle regole di ricerca e innesca le classi Intervention[cite: 34, 41, 42].
* [cite_start]**Platform Adapter (Strategy Pattern):** Isola l'interfaccia utente: il core richiama metodi astratti, ignorando l'implementazione specifica delegata a classi concrete (es. `RedditAdapter`)[cite: 70, 71, 95, 96].

### 2. Backend (Server Django REST)
[cite_start]Un server centralizzato che agisce da arbitro per la logica dell'esperimento[cite: 6]:
* [cite_start]**API RESTful:** Basate su Django REST Framework (DRF), gestiscono la validazione rigorosa dei payload della telemetria in ingresso[cite: 40].
* [cite_start]**Filtrazione Sicura:** Il JSON di configurazione viene mantenuto come Singleton nel database[cite: 94]. [cite_start]Quando un client si connette, il backend filtra il payload esponendo solo le regole pertinenti al gruppo sperimentale assegnato[cite: 60, 63].

---

## 🛠️ Stack Tecnologico

| Componente | Tecnologie Utilizzate |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript, Google Chrome Manifest V3 API |
| **Backend** | Python, Django, Django REST Framework (DRF) |
| **Real-Time** | WebSockets, ASGI, Django Channels, Daphne |
| **Integrazioni** | Google Gemini API (LLM Content Generation) |

---

## ⚙️ Configurazione dell'Esperimento

Un ricercatore non ha bisogno di modificare il codice sorgente dell'estensione. [cite_start]L'intero esperimento viene configurato dichiarativamente nel file di backend `config.json` e tradotto programmaticamente dal Rules Engine[cite: 17, 18]:

```json
{
  "experiment": {
    "experiment_name": "nome_esperimento",
    "end_condition": {
        "type": "ACTIVE_MINUTES_ON_PLATFORM",
        "duration": 15
    },
    "groups": ["TREATMENT"]
  },
  "triggers": [
    {
      "id": "trigger_ricerca",
      "event_source": "adapters.reddit.events.SearchSubmittedEvent",
      "conditions": [
        {
          "property": "search_query",
          "operator": "engine.operators.ContainsAny",
          "value": ["keyword1", "keyword2"]
        }
      ],
      "apply_interventions": {
        "inject_fake_post": ["TREATMENT"]
      }
    }
  ]
}
```

---

## 📜 Struttura delle Directory

```text
iBEARer/
├── backend/                  # Server Django e logica API
│   ├── api/
│   │   ├── websockets/       # Consumers ASGI per comunicazione Real-Time
│   │   ├── models.py         # Modelli DB (Participant, TelemetryEvent, Config Singleton)
│   │   └── views.py          # Endpoints REST e DRF
│   └── config.json           # Definizione globale dell'esperimento (Master)
│
├── extension/                # Codice sorgente dell'estensione Chrome
│   ├── adapters/             # Moduli Platform Dependent (es. Reddit, Google Forms)
│   ├── engine/               # Core Engine, Registri, ed Event Listeners
│   ├── services/             # Manager di Telemetria, Survey, Timer e WebSocket
│   ├── utils/                # Utility trasversali (Logger, SPA Watcher)
│   ├── background.js         # Service Worker isolato per il networking
│   └── manifest.json         # Dichiarazione per Google Chrome
```

---

## ⚠️ Disclaimer Etico e di Ricerca
Questo software è stato sviluppato per finalità di ricerca accademica strettamente controllate ("Audit Studies"). La manipolazione dei contenuti, l'A/B testing intrusivo e l'alterazione del DOM sono soggetti all'approvazione formale di un Comitato Etico (IRB). Il tracciamento e la telemetria attiva richiedono il consenso informato preventivo (Pre-Survey) del partecipante.