// Per aggirare le limitazioni CORS questo ApiManager non si occupera piu di fare direttamente le chiamate (fetch) al backend
// ma diventera una sorta di "controller" che ricieve le richieste dall'engine (es. dammi la configurazione) e le gira, sotto
// forma di messaggi, al background.js, che si occupera di fare le fetch effettive. 

// Questo funzione poiche i content script (es. ApiManager) non hanno i permessi per fare richieste cross-origin, mentre 
// il background.js si, dal momento che è considerato parte dell'estensionen.

const ApiManager = {
    participantId: null,
    telemetryQueue: [],
    syncInterval: null,

    // funzione per inizializzare l'ApiManager (ovviamente da lanciare all'inizio dell'estensione)
    async init() {

        // prova a recuperare l'ID del partecipante dallo storage locale
        const data = await chrome.storage.local.get(['participantId']);

        // se esiste, usalo; altrimenti, registra un nuovo partecipante
        if (data.participantId) {
            this.participantId = data.participantId;
            Log.adapter(`ApiManager: ParticipantID recuperato: ${this.participantId}`);

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
                await chrome.storage.local.set({ participantId: this.participantId });
                
                Log.adapter(`ApiManager: Enrollment completato. ID: ${this.participantId}`);
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


// -------------------------------------------- POST /telemetry: addEventToQueue --------------------------------------------
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
    }
};