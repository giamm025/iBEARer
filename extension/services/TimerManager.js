const TimerManager = {
    activeInterval: null,
    sessionStartTime: null,
    visibilityHandler: null,
    unloadHandler: null,
    absoluteTimeout: null,
    onExpiredCallback: null,
    targetMs: null,

    // metodo principale per avviare il timer dell'intero esperimento
    start(endCondition, onExpiredCallback) {

        // fermiamo eventuali timer già attivi per evitare race condition o timer multipli attivi contemporaneamente
        this.stop();

        // prendiamo tipo di timer e durata
        const type = endCondition.type;
        const duration = endCondition.duration;

        // agiamo di conseguenza al tipo di timer specificato
        switch (type) {

            case "ACTIVE_MINUTES_ON_PLATFORM":
                this.startActiveTimer(duration, onExpiredCallback);
                break;

            case "ABSOLUTE_DAYS":
                this.startAbsoluteTimer(duration, onExpiredCallback);
                break;

            default:
                Log.error("TimerManager", `Implementazione mancante per il tipo di timer: ${type}`);
                break;
        }
    },

    // implementazione per ACTIVEMINUTESONPLATFORM
    startActiveTimer(durationMinutes, onExpired) {

        this.onExpiredCallback = onExpired;

        // trasformiamo i minuti in millisecondi per i nostri calcoli
        this.targetMs = durationMinutes * 60 * 1000;
        if (durationMinutes < 1) { Log.timer_manager(`Timer Attivo (${durationMinutes * 60} sec).`);}
        else                     { Log.timer_manager(`Timer Attivo (${durationMinutes} min).`);}

        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible') this.startTracking();
            else this.stopTracking();
        };
        
        this.unloadHandler = () => this.stopTracking();

        document.addEventListener("visibilitychange", this.visibilityHandler);
        window.addEventListener("beforeunload", this.unloadHandler);
        
        // avvio immediato se siamo gia visibili
        if (document.visibilityState === 'visible') this.startTracking();
    },

    // funzione per avviare (o ri-avviare) lo scorrere del tempo
    startTracking() {

        // se abbiamo già un timer attivo, non facciamo nulla (evitiamo di sovrascrivere sessionStartTime)
        if (this.sessionStartTime) return; 

        // altrimenti avviamo il timer
        Log.timer_manager("▶️ Tracking Avviato (Scheda Visibile)");

        // salviamo il tempo di inizio della sessione (o della ri-attivazione) per poter calcolare il tempo trascorso 
        this.sessionStartTime = Date.now();

        // ogni 10 secondi sincronizziamo il tempo accumulato con quello salvato nel local storage
        this.activeInterval = setInterval(() => this.syncTime(false), 10000);
    },

    // funzione per fermare il timer e salvare il tempo accumulato fino a quel momento
    stopTracking() {

        // se non abbiamo un timer attivo, non facciamo nulla
        if (!this.sessionStartTime) return;

        // altrimenti, fermiamo il timer e salviamo il tempo accumulato fino a quel momento
        Log.timer_manager("⏸️ Tracking In Pausa (Scheda Nascosta)");
        clearInterval(this.activeInterval);
        this.activeInterval = null;
        this.syncTime(true);
    },

    // funzione per sincronizzare il tempo accumulato con quello salvato nel local storage e verificare se abbiamo raggiunto il limite
    async syncTime(isStopping = false) {
        
        // se per qualche motivo non abbiamo un tempo di inizio, non facciamo nulla 
        if (!this.sessionStartTime) return;
        
        // calcoliamo il tempo trascorso dall'ultima volta che abbiamo avviato (o ri-avviato) il timer
        const now = Date.now();
        const elapsed = now - this.sessionStartTime;
        
        // se stiamo fermando il timer puliamo il sessionStartTime, altrimenti lo aggiorniamo al momento attuale 
        if (isStopping) { this.sessionStartTime = null; 
        } else          { this.sessionStartTime = now;  }

        // se non è passato nemmeno un secondo, non perdiamo tempo a sincronizzare con il local storage
        if (elapsed <= 0) return;

        try {

            // recuperiamo il tempo accumulato fino ad ora dal local storage
            const data = await chrome.storage.local.get(['accumulatedTimeMs', 'postSurveyLink']);

            // aggiungiamo il tempo appena trascorso
            const currentTotal = (data.accumulatedTimeMs || 0) + elapsed;
            
            // salviamo il nuovo totale nel local storage
            await chrome.storage.local.set({ accumulatedTimeMs: currentTotal });
            
            // DEBUG: per vedere i secondi che si sommano
            Log.timer_manager(`Salvato: +${Math.round(elapsed/1000)}s | Totale in DB: ${Math.round(currentTotal/1000)}s`);

            // se abbiamo raggiunto o superato il tempo previsto, fermiamo tutto ed apriamo il post-survey
            if (currentTotal >= this.targetMs) {
                Log.timer_manager("TEMPO SCADUTO!");
                this.stop(); 
                this.onExpiredCallback(data.postSurveyLink);
            }

        } catch (error) {
            Log.error("TimerManager", "Errore durante la sincronizzazione del tempo", error);
        }
    },


    // implementazione per ABSOLUTE_DAYS
    startAbsoluteTimer(durationDays, onExpired) {

        this.targetMs = durationDays * 24 * 60 * 60 * 1000;
        this.onExpiredCallback = onExpired;

        chrome.storage.local.get(['experimentStartTime', 'postSurveyLink'], (data) => {
            let startTime = data.experimentStartTime;
            if (!startTime) {
                startTime = Date.now();
                chrome.storage.local.set({ experimentStartTime: startTime });
                Log.timer_manager(`Timer Assoluto avviato (${durationDays} giorni).`);
            }

            const elapsed = Date.now() - startTime;
            const remainingTime = this.targetMs - elapsed;

            if (remainingTime <= 0) {
                onExpired(data.postSurveyLink);
            } else {
                Log.timer_manager(`Timer Assoluto in corso. Mancano ${Math.round(remainingTime / 3600000)} ore.`);
                this.absoluteTimeout = setTimeout(() => {
                    onExpired(data.postSurveyLink);
                }, remainingTime);
            }
        });
    },

    // metodo per fermare il timer (es. se l'Engine viene spento prima del tempo)
    stop() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        if (this.absoluteTimeout) clearTimeout(this.absoluteTimeout);
        if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
        if (this.unloadHandler) window.removeEventListener("beforeunload", this.unloadHandler);

        this.activeInterval = null;
        this.absoluteTimeout = null;
        this.visibilityHandler = null;
        this.unloadHandler = null;
        this.sessionStartTime = null;
    }
}