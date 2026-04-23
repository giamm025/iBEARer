
function runRedditAdapter() {

    // facciamo partire l'adapter per intercettare eventi SOLO DOPO che l'engine è partito
    // altrimenti rischiamo di intercettare eventi prima che l'engine sia pronto a gestirli
    document.addEventListener("EngineReady", () => {

        Log.adapter("Avvio Reddit Adapter...");

        // lista degli Observer da attivare
        const activeObservers = [
            window.SearchSubmitted,
            window.ResultsLoaded
        ];

        // definiamo la funzione che l'SpaWatcher drovrà eseguire ad ogni cambio di URL. 
        // nel nostro caso questa funzione si occuperà di attivare tutti gli Observer registrati nella nostra lista.
        SpaWatcher.watch(() => {

            for (const observer of activeObservers) {
                observer.check();
            }

        });
    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------
runRedditAdapter();