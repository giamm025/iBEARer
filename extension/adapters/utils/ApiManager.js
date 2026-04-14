const ApiManager = {
    baseUrl: "http://localhost:8000",
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


    // funzione per registrare un nuovo partecipante e ottenere un ID univoco
    async enrollParticipant() {

        try {
            // chiamata al backend
            const response = await fetch(`${this.baseUrl}/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            // trasformiamo la risposta in JSON
            const result = await response.json();

            // salviamo l'ID del partecipante
            this.participantId = result.id;
            await chrome.storage.local.set({ participantId: result.id });

            Log.adapter(`ApiManager: Nuovo Enrollment completato. ID: ${this.participantId}`);

        } catch (error) {
            Log.error("ApiManager", "Errore durante l'enrollment", error);
        }
    },


    // funzione per scaricare la configurazione dal backend
    async getConfig() {

        try {
            // chiamata al backend
            const response = await fetch(`${this.baseUrl}/config`);

            // se la risposta non è OK, lanciamo un errore. Altrimenti, trasformiamo in JSON 
            if (!response.ok) throw new Error("Errore nel download del config");
            const config = await response.json();

            Log.adapter("ApiManager: Configurazione scaricata con successo.");
            return config;

        } catch (error) {
            Log.error("ApiManager", "Impossibile scaricare il config.json", error);
            return null;
        }
    },


    // funzione per inserire un Telemetryevent nella coda (TelemetryBatch)
    addEventToQueue(event_fqn, metadata = {}) {

        // creiamo un oggetto di Telmetria (in accordo con l'API)
        const telemetryEvent = {
            event_fqn,
            timestamp: new Date().toISOString(),
            metadata
        };
        this.telemetryQueue.push(telemetryEvent);
        Log.adapter(`ApiManager: Evento in coda: ${event_fqn}`);
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

                // chiamata al backend
                const response = await fetch(`${this.baseUrl}/participants/${this.participantId}/telemetry`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // se l'invio è andato a buon fine svuota la coda
                if (response.status === 201) {
                    this.telemetryQueue = [];
                    Log.adapter("ApiManager: Telemetria sincronizzata.");
                }

            } catch (error) {
                Log.error("ApiManager", "Sync fallito. Dati mantenuti in coda.");
            }
        }, interval_ms);
    }
};