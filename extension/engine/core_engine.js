
class Engine {
    
    constructor(config) {
        this.config = config;
        this.initListeners();
    }

    initListeners() {

        // mettiamo il motore in ascolto di tutti gli event_source
        const eventsToListen = new Set()                // uso un Set cosi se ho 10 trigger che si attivano con lo stesso event_source me lo inserisce una volta sola
        for (let trigger of this.config.triggers) {
            eventsToListen.add(trigger.event_source)
        }
        
        eventsToListen.forEach(eventName => {
            document.addEventListener(eventName, (e) => this.evaluateTriggers(eventName, e.detail));
        });
        Log.engine(`In ascolto su: ${Array.from(eventsToListen).join(', ')}`);
    }


    evaluateTriggers(eventName, eventData) {

        Log.engine(`Ricevuto evento: ${eventName}`, eventData);

        // Trova tutti i trigger che reagiscono a questo evento
        const activeTriggers = this.config.triggers.filter(t => t.event_source === eventName);

        activeTriggers.forEach(trigger => {
            let match = true; 

            for (let condition of trigger.conditions) {
                const actualValue = eventData[condition.property]; // es. legge "vaccini" dall'evento
                
                // Il valutatore logico
                if (condition.operator === "CONTAINS_ANY") {
                    const hasMatch = condition.value.some(keyword => 
                        actualValue.toLowerCase().includes(keyword.toLowerCase())
                    );
                    if (!hasMatch) match = false;
                }
            }

            if (match) {
                Log.engine(`Trigger scattato! ID: ${trigger.id}`);
                this.executeInterventions(trigger.apply_interventions);
            }
        });
    }

    executeInterventions(interventionFqns) {
        interventionFqns.forEach(fqn => {
            // Cerca la configurazione dell'intervento per prendere il payload
            const interventionConfig = this.config.interventions.find(i => i.function_fqn === fqn);
            
            if (interventionConfig && InterventionsRegistry[fqn]) {
                // Esegue la funzione reale passandole il payload del JSON
                InterventionsRegistry[fqn](interventionConfig.payload);
            } else {
                Log.error("Engine", `Funzione non trovata nel registro: ${fqn}`);
            }
        });
        Log.engine("Fine Interventi");
    }
}

// siccome ora non abbiamo backend/API chiaramente non posso chiedere al server il config.json ...
// Quindi ci tocca Hardcodarlo qui sotto :D
const config = {
    triggers: [
        {
            id: "trigger_search_001",
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
        }
    ],
    interventions: [
        {
            function_fqn: "interventions.debug.applyRedBorder",
            payload: {
                border_style: "10px solid red"
            }
        }
    ]
};
Log.error("Engine", "CONFIG.JSON HARDCODED");

// const response = await ...
// const config = await response.json();
const myEngine = new Engine(config);