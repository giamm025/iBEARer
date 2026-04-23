function runRedditAdapter() {

    // facciamo partire l'adapter per intercettare eventi SOLO DOPO che l'engine è partito
    // altrimenti rischiamo di intercettare eventi prima che l'engine sia pronto a gestirli
    document.addEventListener("EngineReady", () => {

        Log.adapter("Avvio Reddit Adapter...");

        // lista degli Observer da attivare ad OGNI cambio URL
        const activeObservers = [
            window.SearchSubmitted,
            window.ResultsLoaded
        ];

        // definiamo la funzione che l'SpaWatcher drovrà eseguire ad ogni cambio di URL. 
        // nel nostro caso questa funzione si occuperà solo di attivare gli Observer registrati nella lista sopra.
        SpaWatcher.watch(() => {
            for (const observer of activeObservers) {
                observer.check();
            }
        });
    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------
runRedditAdapter();