// Per aggirare le limitazioni CORS questo ApiManager non si occupera piu di fare direttamente le chiamate (fetch) al backend
// ma diventera una sorta di "controller" che ricieve le richieste dall'engine (es. dammi la configurazione) e le gira, sotto
// forma di messaggi, al background.js, che si occupera di fare le fetch effettive. 

// Questo funzione poiche i content script (es. ApiManager) non hanno i permessi per fare richieste cross-origin, mentre 
// il background.js si, dal momento che è considerato parte dell'estensionen.

const ApiManager = {
    participantId: null,
    telemetryQueue: [],
    syncInterval: null,
    onExperimentStartCallback: null,

    // funzione per inizializzare l'ApiManager (ovviamente da lanciare all'inizio dell'estensione)
    async init() {

        // prova a recuperare l'ID ed il link al pre survey dal local storage
        const data = await chrome.storage.local.get(['participantId', 'preSurveyLink']);

        // se esiste, usalo; altrimenti, registra un nuovo partecipante
        if (data.participantId) {
            this.participantId = data.participantId;
            Log.adapter(`ApiManager: ParticipantID recuperato: ${this.participantId}`);

            // recupera lo stato dell'utente dal backend per capire se è già compilato il questionario
            const statusData = await this.getStatus();

            // se lo stato dell'utente è ENROLLED significa che non ha ancora compilato il questionario
            if (statusData && statusData.status === "ENROLLED") {
                Log.adapter("ApiManager: Utente in stato ENROLLED. Apertura pre-survey.");
                if (data.preSurveyLink) {
                    chrome.runtime.sendMessage({ action: "OPEN_TAB", url: data.preSurveyLink });
                }
                else {
                    Log.error("ApiManager", "Link del pre-survey non trovato nello storage locale.");
                }

            } else {
                Log.adapter(`ApiManager: Stato utente confermato: ${statusData?.status}`);
            }

        } else {
            await this.enrollParticipant();
        }
    },


// -------------------------------------------- POST /participants: enrollParticipant --------------------------------------------
    async enrollParticipant() {

        try {
            
            // NON facciamo piu la chiamata al backend. Ci limitiamo a mandare un messaggio al background.js, e ci pensera lui
            const response = await chrome.runtime.sendMessage({ action: "ENROLL" });
            
            // se l'enrollment è andato a buon fine, salva l'ID del partecipante e memorizzalo nello storage locale
            if (response && response.success) {
                this.participantId = response.data.participantId;
                const surveyLink = response.data.preSurveyLink;

                // aggiorniamo l'id ed il link del questionario nella memoria del browser
                await chrome.storage.local.set({ participantId: this.participantId, preSurveyLink: surveyLink });
                Log.adapter(`ApiManager: Enrollment completato. ID: ${this.participantId}`);

                // diciamo al background.js di aprire un'altra tab con il questionario
                if (surveyLink) {
                    chrome.runtime.sendMessage({ action: "OPEN_TAB", url: surveyLink });
                    Log.adapter("ApiManager: Richiesta apertura questionario inviata al background.");
                }

                return true;
                
            } else {
                Log.error("ApiManager", "Errore enrollment dal Background", response?.error);
                return false;
            }

        } catch (error) {
            Log.error("ApiManager", "Errore durante l'enrollment", error);
            return false;
        }
    },


// -------------------------------------------- GET /config: getConfig --------------------------------------------
    async getConfig() {

        try {
            // stessa cosa di prima, NON facciamo piu la chiamata al backend ma mandiamo un messaggio al background.js
            const response = await chrome.runtime.sendMessage({ action: "GET_CONFIG" });

            // se la risposta c'è ed ha avuto successo, restituisci i dati della configurazione
            if (response && response.success) {
                Log.adapter("ApiManager: Configurazione scaricata via Background.");
                return response.data;

            } else {
                Log.error("ApiManager", "Impossibile scaricare configurazione", response?.error);
                return null;
            }

        } catch (error) {
            Log.error("ApiManager", "Impossibile scaricare il config.json", error);
            return null;
        }
    },

// --------------------------------- GET participants/{participantId}/status: getStatus ---------------------------------
    async getStatus() {

        try {
            const response = await chrome.runtime.sendMessage({ 
                action: "GET_STATUS", 
                participantId: this.participantId 
            });
            
            console.log("🔍 [ApiManager] Risposta grezza dal background:", response);

            if (response && response.success) {
                return response.data;

            } else {
                console.error("❌ [ApiManager] Il background ha restituito un errore:", response?.error);
                return null;
            }
            
        } catch (e) { 
            console.error("❌ [ApiManager] Eccezione di rete o di Chrome:", e);
            return null; 
        }
    },

// ------------------------------------ PUT participants/{participantId}/status: updateStatus ------------------------------------

    // DELEGATO A adapters/utils/FormWatcher.js !!!!!!!!!!!!!!!!!!!!!!

// ---------------------------------- POST participants/{participantId}/telemetry: sendTelemetry ----------------------------------
    addEventToQueue(event_fqn, metadata = {}) {

        // creiamo un oggetto di Telmetria (in accordo con l'API)
        const telemetryEvent = {
            event_fqn,
            timestamp: new Date().toISOString(),
            metadata
        };
        this.telemetryQueue.push(telemetryEvent);
        Log.adapter(`ApiManager: Evento aggiunto in coda: ${event_fqn}`);
    },


    // funzione per sincronizzare la coda di telemetria con il backend a intervalli regolari
    startTelemetrySync(interval_ms = 10000) {

        // se esiste già un intervallo di sincronizzazione, lo cancelliamo per evitare duplicati
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        // impostiamo un nuovo intervallo, al termine del quale:
        this.syncInterval = setInterval(async () => {

            // se la coda è vuota o non abbiamo un participantId (all'avvio), usciamo subito dalla funzione (non facciamo nulla). 
            if (this.telemetryQueue.length === 0 || !this.participantId) return;

            // altrimenti, creiamo il payload da inviare al backend (contiene tutti gli eventi attualmente in coda)
            const payload = { events: [...this.telemetryQueue] };
            try {

                // NON facciamo piu la chiamata al backend ma inviamo un messaggio al background.js
                const response = await chrome.runtime.sendMessage({ 
                    action: "SYNC_TELEMETRY", 
                    participantId: this.participantId,
                    payload: payload
                });

                // se l'invio è andato a buon fine svuota la coda, altrimenti lancia un errore
                if (response && response.success) {
                    this.telemetryQueue = []; 
                    Log.adapter("ApiManager: Coda telemetria sincronizzata col server.");

                } else {
                    Log.error("ApiManager", "Sync rifiutato dal server.", response?.error);
                }

            } catch (error) {
                Log.error("ApiManager", "Sync fallito. Dati mantenuti in coda.");
            }
        }, interval_ms);
    },

// -------------------------------------------- WEBSOCKET CONNECT --------------------------------------------
    async connectWebSocket() {
        await chrome.runtime.sendMessage({ 
            action: "CONNECT_WEBSOCKET", 
            participantId: this.participantId 
        });

        // ------------------------------------ HEARTBEAT PING PONG ------------------------------------
        // EDIT: inseriamo un hearbeat costante ogni 20sec per evitare che Chrome mi uccida l'estensione :,)
        if (this.awakeInterval) clearInterval(this.awakeInterval);
        this.awakeInterval = setInterval(() => {
            chrome.runtime.sendMessage({ action: "PING" });
            Log.heart_beat("Ping inviato per tenere sveglio il Background.");
        }, 20000);
    }
};

// --- ASCOLTATORE MESSAGGI DAL BACKGROUND ---
// Quando il background riceve il segnale dal WebSocket, avvisa questa tab
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_EXPERIMENT") {
        Log.adapter(`ApiManager: Ricevuto segnale di avvio esperimento! Gruppo: ${request.group}`);
        
        // Se l'Engine ha registrato la sua callback, chiamiamola!
        if (ApiManager.onExperimentStartCallback) {
            ApiManager.onExperimentStartCallback(request.group);
        }
    }
});