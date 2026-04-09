
function runRedditAdapter() {

    Log.adapter("Avvio Reddit Adapter...");

    // lista degli Observer da attivare
    const activeObservers = [
        SearchObserver
    ];

    // definiamo la funzione che l'SpaWatcher drovrà eseguire ad ogni cambio di URL. 
    //  nel nostro caso questa funzione si occuperà di attivare tutti gli Observer registrati nella nostra lista.
    SpaWatcher.watch(() => {

        for (const observer of activeObservers) {
            observer.check();
        }

    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------
runRedditAdapter();