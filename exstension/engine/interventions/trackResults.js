
window["interventions.trackResults"] = function(payload, eventData) {
    
    if (eventData && eventData.search_query) {
        
        // avviamo l'observe che si occupera di fare un po tutto (parsing risultati + invio)
        window.ResultsLoaded.startScraping(eventData.search_query);

    } else {
        Log.error("Intervention", "Impossibile avviare trackResults: query mancante in eventData.");
    }
};

Log.intervention_registry("Intervento caricato: interventions.trackResults");