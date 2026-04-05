
class Engine {
    
    constructor(config) {
        this.config = config;
        this.initListeners();
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


    // metodo per gestire interamente la ricezione di un evento: controlla se scatena dei trigger e in caso esegue gli interventi associati
    handleEvent(eventName, eventData) {
        Log.engine(`Ricevuto evento: ${eventName}`, eventData);

        // trova tutti i trigger che reagiscono a questo evento
        const activeTriggers = this.config.triggers.filter(t => t.event_source === eventName);
        
        // per ogni trigger trovato => valuta se le condizioni sono soddisfatte => esegue gli interventi
        for (let trigger of activeTriggers) {
            const isMatch = this.evaluateTrigger(trigger, eventData);
            if (isMatch) {
                Log.engine(`Trigger Attivato: ${trigger.id}`);
                this.executeInterventions(trigger.apply_interventions);
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
            const operatorFn = OperatorsRegistry[condition.operator];

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


    // metodo per eseguire una o più funzioni intervento (identificate dal fqn)
    executeInterventions(interventionFqns) {

        // per ogni intervento (fqn) da eseguire 
        for (let fqn of interventionFqns) {

            // Cerchiamo l'intervento nel config.json per recuperare il payload 
            const interventionConfig = this.config.interventions.find(i => i.function_fqn === fqn);

            // se troviamo la config dell'intervento e la funzione è registrata nel registro globale, allora eseguiamo 
            if (interventionConfig && InterventionsRegistry[fqn]) {
                InterventionsRegistry[fqn](interventionConfig.payload);
            } else {
                Log.error("Engine", `Funzione non trovata nel registro: ${fqn}`);
            }

        }
        Log.engine("Fine Interventi");
    }
}

// ------------------------------------------------- AVVIO -------------------------------------------------
// siccome ora non abbiamo backend/API chiaramente non posso chiedere al server il config.json ...
// Quindi ci tocca Hardcodarlo qui sotto :D
const config = {
    triggers: [
        {
            id: "trigger_contains_conspiracy",
            event_source: "adapters.events.SearchResultsLoadedEvent",
            logical_operator: "AND",
            conditions: [
                {
                    "property": "search_query",
                    "operator": "CONTAINS_ANY",
                    "value": ["epstein", "vaccini", "terra piatta", "5g"]
                }
            ],
            apply_interventions: [
                "interventions.debug.applyRedBorder"
            ]
        },
        
        {
            id: "trigger_NOT_contains_conspiracy",
            event_source: "adapters.events.SearchResultsLoadedEvent",
            logical_operator: "AND",
            conditions: [
                {
                    "property": "search_query",
                    "operator": "NOT_CONTAINS_ANY",
                    "value": ["epstein", "vaccini", "terra piatta", "5g"]
                }
            ],
            apply_interventions: [
                "interventions.debug.applyGreenBorder"
            ]
        }


    ],

    interventions: [
        {
            function_fqn: "interventions.debug.applyRedBorder",
            payload: {
                border_style: "30px solid red"
            }
        },

        {
            function_fqn: "interventions.debug.applyGreenBorder",
            payload: {
                border_style: "30px solid green"
            }
        }
    ]
};
Log.error("Engine", "CONFIG.JSON HARDCODED!!!!!!!!!!!!!!!!!!!!!!!!!");

// const response = await ...
// const config = await response.json();
const myEngine = new Engine(config);