// Per poter gestire al meglio tutti i casi dobbiamo dividere il tempo trascorso sulla pagina in 2:

// 1. beforeunload che è un evento nativo del browser, lanciato quando l'utente sta per 
// lasciare la pagina (chiudendo la scheda, ricaricando, o navigando altrove). In questo modo siamo sicuri di 
// catturare il tempo totale trascorso sulla pagina, anche se l'utente non interagisce con essa. TUTTAVIA in
// una SPA (Single Page Application) questo metodo non funziona bene perche l'utente potrebbe "navigare" 
// all'interno della stessa pagina senza triggerare beforeunload, e quindi non catturare il tempo "effettivo".

// 2. SPA Watcher: Poiche abbiamo gia implementato l'SPA Watcher per intercettare i cambi URL quando l'utente effettua 
// delle ricerche, possiamo riutilizzare quella logica per capire quando l'utente "naviga" (es. da google.com/search?q=vaccini 
// a google.com/search?q=terapie+vaccini). In questo modo possiamo inviare la telemetria ogni volta che l'utente cambia "pagina" 
// anche se chrome non resetta completamente il DOM.

TelemetryRegistry["telemetry.events.TimeOnPageEvent"] = {
    
    start(apiManager) {
        let startTime = Date.now();
        let currentUrl = window.location.href;
        
        // 1. Gestione Chiusura o Ricaricamento
        window.addEventListener('beforeunload', () => {
            sendTelemetry(currentUrl);
        });

        // 2. Gestione SPA
        if (typeof SpaWatcher !== 'undefined') {

            SpaWatcher.watch(() => {
                const newUrl = window.location.href;
                if (newUrl !== currentUrl) {
                    sendTelemetry(currentUrl); // Invia il tempo speso sulla VECCHIA pagina
                    startTime = Date.now();    // Resetta il cronometro per la NUOVA pagina
                    currentUrl = newUrl;
                }
            });
        }


        // funzione helper per inviare la telemetria
        const sendTelemetry = (urlToLog) => {
            
            const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);
            if (timeSpentSeconds > 0) {
                apiManager.addEventToQueue("telemetry.events.TimeOnPageEvent", {
                    duration_seconds: timeSpentSeconds,
                    url_pagina: urlToLog
                });
                Log.adapter(`Telemetria: TimeOnPage inviato per ${urlToLog} (${timeSpentSeconds}s)`);
            }
        };
    }
};

Log.telemetry_registry("Observer caricato: TimeOnPageEvent");