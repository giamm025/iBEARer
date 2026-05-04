function runRedditAdapter() {

    // facciamo partire l'adapter per intercettare eventi SOLO DOPO che l'engine è partito
    // altrimenti rischiamo di intercettare eventi prima che l'engine sia pronto a gestirli
    document.addEventListener("EngineReady", () => {

        Log.adapter("Avvio Reddit Adapter...");

        // definiamo la funzione che l'SpaWatcher drovrà eseguire ad ogni cambio di URL. 
        // nel nostro caso si occuperà solo di attivare gli Observer registrati.
        SpaWatcher.watch(() => {

            // se ci sono observer registrati, chiamiamo il loro metodo check() per svegliarli
            if (window.ObserverRegistry) {
                for (const observer of window.ObserverRegistry) {
                    observer.check();
                }
            
            // altrimenti logghiamo che non ci sono observer registrati (DEBUG)
            } else {
                Log.adapter("Nessun Observer registrato.");
            }
        });
    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------
runRedditAdapter();