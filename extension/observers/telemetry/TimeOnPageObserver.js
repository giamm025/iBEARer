class TimeOnPageObserver extends BaseObserver {

    constructor() {
        super();
        this.startTime = null;
        this.currentUrl = null;
    }

    start() {
        this.isActive = true;
        this.startTime = Date.now();
        this.currentUrl = window.location.href;
 
        this.attachListener(window, 'beforeunload', () => {
            this.calculateTimeSpentOn(this.currentUrl);
        });
    }

    // metodo chiamato ad ogni cambio URL: nel nostro caso dobbiamo calcolare il tempo speso 
    // sulla pagina precedente, e resettare il cronometro per la nuova pagina
    check() {

        if (!this.isActive) return;
        const newUrl = window.location.href;
        
        // se l'URL è effettivamente cambiato rispetto a quello che stavamo tracciando
        if (newUrl !== this.currentUrl) {
            
            // invia il tempo speso sulla VECCHIA pagina
            this.calculateTimeSpentOn(this.currentUrl); 
            
            // resetta il cronometro e aggiorna l'URL per la NUOVA pagina
            this.startTime = Date.now();    
            this.currentUrl = newUrl;
        }
    }

    // metodo helper per calcolare il tempo passato (ed inviarlo al backend)
    calculateTimeSpentOn(url) {

        if (!this.startTime || !url) return;

        const timeSpentSeconds = Math.round((Date.now() - this.startTime) / 1000);
        if (timeSpentSeconds > 0) {
            this.addEventToQueue("telemetry.events.TimeOnPageEvent", {
                duration_seconds: timeSpentSeconds,
                url_pagina: url
            });
        }
    }

    // spegnimento dell'observer
    customCleanUp() {
        // prima di spegnere l'observer, salviamo i secondi passati sull'ultima pagina PRIMA che l'utente venga sbattuto sul Post-Survey
        this.calculateTimeSpentOn(this.currentUrl);
        this.startTime = null;
        this.currentUrl = null;
    }
};

window.TimeOnPage = new TimeOnPageObserver();