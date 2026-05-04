
class Engine {
    
    constructor() {
        this.config = null;
        this.group = null;
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

    // metodo per gestire l'esperimento sulla base dello stato del partecipante (ENROLLED, PRE-SURVEY-COMPLETED, POST-SURVEY-COMPLETED)
    async handleParticipantStatus() {

        // recuperiamo lo stato e il gruppo del partecipante
        let statusData = await ApiManager.getStatus();
        if (!statusData || !statusData.status) {
            Log.error("Engine", "Errore critico: Impossibile recuperare lo stato.");
            return;
        }

        switch (statusData.status) {
            
            // se lo stato attuale è ENROLLED => deve ancora completare il pre-survey => aspettiamo 
            case "ENROLLED":
                Log.engine("In attesa del completamento del pre-survey...");
                
                // creiamo una promessa che blocca il mototre finche non riceve la notifica (callback) 
                // da ApiManager che conferma il completamento del form. 
                const assignedGroup = await new Promise((resolve) => {
                    ApiManager.onExperimentStartCallback = (group) => {
                        resolve(group);
                    };
                
                    // Se Chrome ha ucciso il background.js nel mentre che l'utente stava compilando il pre-survey, non riceveremo mai la callback. 
                    // in questo caso, aggiungiamo un listener che aspetta che la pagina torni visibile (cioe l'utente ha completatao il survey ed è
                    // tornaro su Reddit). a quel punto ricontrolliamo lo stato, se è PRE-SURVEY-COMPLETED, allora avviamo il mototre
                    const onVisibilityChange = async () => {
                        if (document.visibilityState === "visible") {
                            let checkData = await ApiManager.getStatus();
                            if (checkData && checkData.status === "PRE-SURVEY-COMPLETED") {
                                document.removeEventListener("visibilitychange", onVisibilityChange);
                                resolve(checkData.group);
                            }
                        }
                    };
                    document.addEventListener("visibilitychange", onVisibilityChange);
                });

                // quando la promise si risolve avviamo l'esperimento, passando il gruppo a cui è stato assegnato l'utente
                await this.startExperiment(assignedGroup);
                break;

            // se invece lo stato è PRE-SURVEY-COMPLETED => inizia l'esperimento
            case "PRE-SURVEY-COMPLETED":
                await this.startExperiment(statusData.group);
                break;

            case "POST-SURVEY-COMPLETED":
                Log.error("Engine", "Ancora nessuna implementazione per POST-SURVEY-COMPLETED.");
                break;

            default:
                Log.error("Engine", `Stato sconosciuto o non gestito: ${statusData.status}`);
                break;
        }
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
        document.dispatchEvent(new EngineReadyEvent());  
        Log.engine("Avvio Completato");
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
                observer.start(ApiManager); 
                Log.engine(`Observer telemetria attivato: ${eventName}`);

            } else {
                Log.error("Engine", `Observer di telemetria non trovato nel registro per: ${eventName}`);
            }
        }
    }


    // metodo per gestire interamente la ricezione di un evento: controlla se scatena dei trigger e in caso esegue gli interventi associati
    handleEvent(eventName, eventData) {

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