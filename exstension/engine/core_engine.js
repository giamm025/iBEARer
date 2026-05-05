
class Engine {
    
    constructor() {
        this.config = null;
        this.group = null;
        this.isActive = false;
        this.init();
    }

    // metodo per avviare il motore
    async init() {
        Log.engine("Avvio...");

        // avvia l'API manager (per permettere di effettuare le chiamatae HTTP al backend)
        await ApiManager.init();

        // ci connettiamo con la Web Socket del Backend
        await ApiManager.connectWebSocket();

        // controlliamo lo stato dell'utente per capire se mostrare il pre-survey o se possiamo iniziare
        await this.handleParticipantStatus();
    }


    // metodo per gestire l'esperimento sulla base dello stato del partecipante
    async handleParticipantStatus() {

        // recuperiamo lo stato e il gruppo del partecipante
        let statusData = await ApiManager.getStatus();
        if (!statusData || !statusData.status) {
            Log.error("Engine", "Impossibile recuperare lo stato.");
            return;
        }

        switch (statusData.status) {
            
            case "ENROLLED":
                Log.engine("In attesa del completamento del pre-survey...");
                await this.waitForStatus("PRE-SURVEY-COMPLETED", true);
                await this.handleParticipantStatus();
                break;

            case "PRE-SURVEY-COMPLETED":
                Log.engine("Pre-survey completato. Avvio esperimento...");
                await this.startExperiment(statusData.group);
                break;
            
            case "POST-SURVEY-NOT-COMPLETED":
                Log.engine("🏁 Aggiornamento stato e apertura Post-Survey...");

                // disegniamo il pop-up sullo schermo
                chrome.storage.local.get(['postSurveyLink'], (data) => {
                    if (data.postSurveyLink) {
                        RedditAdapter.showEndExperimentModal(data.postSurveyLink);
                    } else {
                        Log.error("Engine", "Link del Post-Survey non trovato nella memoria locale!");
                    }
                });

                // ci mettiamo in attesa del completamento del post survey
                await this.waitForStatus("POST-SURVEY-COMPLETED", false);
                
                // rimuoviamo il pop-up bloccante
                RedditAdapter.hideEndExperimentModal();

                // gestiamo il nuovo stato (POST-SURVEY-COMPLETED)
                await this.handleParticipantStatus();
                break;

            case "POST-SURVEY-COMPLETED":
                Log.engine("✅ L'utente ha completato tutto l'esperimento. Il motore si disattiva definitivamente. Grazie per aver partecipato!");
                break;

            default:
                Log.error("Engine", `Stato sconosciuto o non gestito: ${statusData.status}`);
                break;
        }
    }
    
    // metodo helper per astrarre la logica di attesa dei questionari
    async waitForStatus(targetStatus, useWebSocket = false) {

        // creiamo una promessa che blocca il motore finche non riceve la notifica (callback) da ApiManager che conferma il completamento del form. 
        return new Promise((resolve) => {
            
            // se Chrome ha ucciso il background.js nel mentre che l'utente stava compilando il pre-survey, non riceveremo mai la callback. 
            // in questo caso, aggiungiamo un listener che aspetta che la pagina torni visibile (cioe l'utente ha completatao il survey ed è
            // tornaro su Reddit). a quel punto ricontrolliamo lo stato, se è PRE-SURVEY-COMPLETED, allora avviamo il mototre
            const onVisibilityChange = async () => {
                if (document.visibilityState === "visible") {
                    let checkData = await ApiManager.getStatus();
                    if (checkData && checkData.status === targetStatus) {
                        document.removeEventListener("visibilitychange", onVisibilityChange);
                        resolve();
                    }
                }
            };
            document.addEventListener("visibilitychange", onVisibilityChange);
        });
    }

    // metodo per avviare l'esperimento: imposta il gruppo, avvia i listeners per gli eventi e per la telemetria, avvisa che il motore è pronto
    async startExperiment(assignedGroup) {
        
        // salviamo il gruppo in una variabile, cosi che anche le altre funzioni (es. executeIntervention) possano usarlo
        this.group = assignedGroup;
        Log.engine(`Gruppo Assegnato: ${this.group}`);

        // otteniamo la configurazione dal backend (lo abbiamo spostato qui perche ora la GET dipende dal gruppo dell'utente)
        const config = await ApiManager.getConfig();
        if (!config) {
            Log.error("Engine", "Avvio interrotto: Configurazione mancante.");
            return;
        }
        this.config = config;

        // avvia i listeners per gli eventi (es. cerca "vaccini" => applica debunking)
        this.initListeners();

        // avvia i listeners per la telemetria (es. clicca sul link => aggiungi telemetria in coda)
        this.initTelemetryObservers();

        // avvia il timer per la telemetria (ogni quanto svuotiamo la coda per inviare la telemetria al DB)
        const syncTime = this.config.telemetry_settings?.sync_interval_ms || 10000;
        ApiManager.startTelemetrySync(syncTime);

        // comunica a tutti che il motore è partito (serve a dare il via all'adapter per intercettare gli eventi)
        this.isActive = true; 
        document.dispatchEvent(new EngineReadyEvent()); 
        Log.engine("Avvio Completato");

        // avvia il timer dell'esperimento
        this.startExperimentTimer();
    }


    // metodo per avviare il timer dell'esperimento (multi-sessione)
    startExperimentTimer() {

        // recupera i dati dal config
        const endCondition = this.config.experiment.end_condition;

        // definiamo cosa deve succedere quando il timer scadrà (deve solo chiamare endExperiment ed aprire il post-survey)
        const onExpiredCallback = function(postSurveyLink) {
            this.endExperiment(postSurveyLink);
        }

        // deleghiamo l'intero compito al TimerManager.  
        TimerManager.start(endCondition, onExpiredCallback.bind(this)); 
    }

    // metodo per fermare il tracciamento/manipolazione ed aprire il post-survey
    endExperiment(postSurveyLink) {

        // spegniamo il motore (disattiviamo tracciamento ed interventi)
        this.stopExperiment();

        // aggiorniamo lo stato del partecipante
        chrome.runtime.sendMessage({ action: "UPDATE_STATUS", status: "POST-SURVEY-NOT-COMPLETED" }, (response) => {
            
            // se l'aggiornamento è andato a buon fine, gestiamo il nuovo stato
            if (response && response.success) {
                this.handleParticipantStatus();

            } else {
                Log.error("Engine", "Errore durante l'aggiornamento dello stato di fine esperimento.");
            }
        });
    }

    // metodo per spegnere il motore (disattivare tracciamento ed interventi)
    stopExperiment() {

        Log.engine("🛑 Stop tracciamento ed interventi");
        
        // disattiviamo gli interventi 
        this.isActive = false;

        // disattiviamo il timer della telemetria (fa anche un ultimo flush dei dati in coda)
        ApiManager.stopTelemetrySync();

        // disattiviamo gli observers
        this.stopObservers();
    }

    // metodo per disattivare gli observer di telemetria
    stopObservers() {

        // recuperiamo l'array degli eventi che stiamo tracciando
        const trackEvents = this.config?.telemetry_settings?.track_events || [];
        
        // per ogni evento, recuperiamo l'observer dedicato e lo fermiamo (ogni observer ha il metodo stop() prche lo abbiamo definito nell'interfaccia BaseObserver)
        for (let eventName of trackEvents) {
            const observer = window[eventName];
            observer.stop();
        }
    }


    // metodo per mettere in ascolto il motore su tutti gli event_source presenti nel config.json 
    initListeners() {

        // recuperiamo dal config.json tutti gli event_source da ascoltare
        // usiamo un Set cosi se ho 10 trigger che si attivano con lo stesso event_source me lo inserisce una volta sola
        const eventsToListen = new Set()                
        for (let trigger of this.config.triggers) {
            eventsToListen.add(trigger.event_source)
        }
        
        // mettiamo il motore in ascolto di tutti gli event_source di tutti i trigger
        for (let eventName of eventsToListen) {

            document.addEventListener(eventName, (e) => this.handleEvent(eventName, e.detail));

            // estriamo il nome dell'observer (es. "telemetry.events.SearchSubmittedEvent" => "SearchSubmittedObserver") 
            // e lo accendiamo con il suo metodo check()
            const observerName = eventName.split('.').pop();
            const observer = window[observerName];
            if (observer) {  observer.start(); }
        }

        Log.engine(`In ascolto su: ${Array.from(eventsToListen).join(', ')}`);
    }

    // metodo per attivare gli observer di telemetria basandosi sul config.json
    initTelemetryObservers() {

        // recuperiamo l'array degli eventi da tracciare (se non c'è, usiamo array vuoto)
        const trackEvents = this.config.telemetry_settings?.track_events || [];
        
        // per ogni evento nel config (es. "telemetry.events.ClickOnLinkEvent")
        for (let eventName of trackEvents) {
            
            // peschiamo l'Observer dal registro e ...
            const observer = window[eventName];
            if (observer) {
                observer.start(); 
                Log.engine(`Observer telemetria attivato: ${eventName}`);

            } else {
                Log.error("Engine", `Observer di telemetria non trovato nel registro per: ${eventName}`);
            }
        }
    }


    // metodo per gestire interamente la ricezione di un evento: controlla se scatena dei trigger e in caso esegue gli interventi associati
    handleEvent(eventName, eventData) {

        // se il mototre è spento NON facciamo nulla
        if (!this.isActive) return;

        Log.engine(`Ricevuto evento: ${eventName}\n`, eventData);

        // trova tutti i trigger che reagiscono a questo evento
        const activeTriggers = this.config.triggers.filter(t => t.event_source === eventName);
        
        // per ogni trigger => prende le condizioni => valuta se le condizioni sono soddisfatte => esegue gli interventi
        for (let trigger of activeTriggers) {
            const isMatch = this.evaluateTrigger(trigger, eventData);
            if (isMatch) {
                
                ApiManager.addEventToQueue("TriggerActivated", {
                    trigger_id: trigger.id,
                    event_source: eventName
                });
                
                this.executeInterventions(trigger.apply_interventions, eventData);  // passiamo anche eventData cosi le funzioni intervento possono usarlo se vogliono
            }
        }
    }


    // metodo per valutare se un evento scatena uno o più trigger
    evaluateTrigger(trigger, eventData) {
        
        // creiamo un array in cui salvare i risultati delle singole condizione del trigger
        // tale array sara poi utilizzato per per applicare il logical_operator (AND, OR, ecc.) di TUTTE le condizioni
        const results = [];

        // per ogni condizione del trigger
        for (let condition of trigger.conditions) {

            // recuperiamo la proprietà dell'evento da controllare (es. search_query)
            const propertyValue = eventData[condition.property];

            // recuperiamo il function operator da eseguire (es. CONTAINS_ANY)
            const operatorFn = window[condition.operator];

            // eseguiamo l'operatore (definiti in engine/operators.js)
            let result = false;
            if (operatorFn) {
                result = operatorFn(propertyValue, condition.value);
                
            } else {
                Log.error("Engine", `Operatore sconosciuto nel JSON: ${condition.operator}`);
            }
            
            results.push(result);
        }

        // valuta le condizioni in base all'operatore logico del trigger
        const finalResult = this.evaluateLogicalOperator(results, trigger.logical_operator);
        return finalResult
    }

    // metodo per valutare un array di risultati di condizioni in base ad un operatore logico (AND, OR, ecc.)
    evaluateLogicalOperator(results, operator) {

        switch (operator) {
            case "AND":
                return results.every(Boolean);

            case "OR":
                return results.some(Boolean);
                
            default:
                Log.error("Engine", `Operatore logico sconosciuto: ${operator}`);
                return false;
        }
    }


    // metodo per eseguire una o più funzioni intervento
    executeInterventions(interventionIds, eventData) {

        // per ogni intervento ID
        for (let interventionID of interventionIds) {

            // Recupera l'oggetto Intervention dal config.json ed estraiamo FQN e payload
            const intervention = this.config.interventions.find(i => i.id === interventionID);
            if (intervention) {
                const fqn = intervention.function_fqn;      // estraiamo il Fully Qualified Name (FQN) 
                const payload = intervention.payload;       // estraiamo il payload da passare alla funzione intervento

                this.executeInterventionFQN(fqn, payload, eventData);  // eseguiamo la funzione intervento

                // registriamo che l'intervento è stato applicato
                ApiManager.addEventToQueue("telemetry.events.InterventionAppliedEvent", {
                    intervention_id: intervention.id,
                    function_fqn: intervention.function_fqn
                });

            } else {
                Log.error("Engine", `Istanza di intervento non trovata nel config.json: ${interventionID}`);
            }

        }
    }

    // metodo per eseguire una funzione intervento dato il suo Fully Qualified Name (FQN) ed il payload
    // scrive un log di errore se il FQN non è presente nel registro delle funzioni intervento
    executeInterventionFQN(fqn, payload, eventData) {
        if (window[fqn]) { window[fqn](payload, eventData); } 
        else {Log.error("Engine", `Funzione FQN non trovata nel registro: ${fqn}`); }
    }
}

function figthPreRendering() {
    document.addEventListener("visibilitychange", function onVisibilityChange() {
        if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            const myEngine = new Engine(); 
        }
    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------

// se siamo in prerender o la pagina è nascosta aggiungiamo un listener che aspetta che la pagina diventi visibile, poi avvia il motore
if (document.visibilityState === "prerender" || document.visibilityState === "hidden") { 
    figthPreRendering(); 

// altrimenti, se la pagina è già visibile, avviamo subito il motore
} else { 
    const myEngine = new Engine(); 
}