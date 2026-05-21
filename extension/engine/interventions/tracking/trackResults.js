
/**
 * @typedef {Object} TrackResultsPayload
 * @description Payload per l'intervento di telemetria dei risultati. 
 * Attualmente questo intervento non richiede configurazioni specifiche o dynamic_content.
 */
class TrackResultsIntervention extends BaseIntervention {
    
    constructor() {
        // Usa il FQN esatto che scriverai nel config.json
        super("interventions.trackResults");
    }
    
    /**
     * @param {TrackResultsPayload} payload 
     * @param {Object} eventData 
     */
    execute(payload, eventData) {

        // avviamo l'observe che si occupera di fare un po tutto (parsing risultati + invio)
        if (eventData && eventData.search_query) {
            window.ResultsLoaded.startScraping(eventData.search_query);

        } else {
            Log.error("Intervention", "Impossibile avviare trackResults: query mancante in eventData.");
        }

        return true;
    }
};

new TrackResultsIntervention();