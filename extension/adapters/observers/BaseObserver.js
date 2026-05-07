// "interfaccia" Observer. 
// gestisce automaticamente la registrazione (start) e la pulizia della degli Event Listener (stop)

class BaseObserver {

    constructor(name) {
        this.name = name;
        this.activeListeners = [];
        this.isActive = false;
        
        // aggiungiamo il nuovo observer al regitro globale (se non esiste lo crea)
        if (!window.ObserverRegistry) { window.ObserverRegistry = []; }
        window.ObserverRegistry.push(this);    
    }

    // funzione helper per registrare e tenere traccia di nuovi listeners
    // in questo modo, quando chiameremo stop(), avremo gia TUTTI i listeners registrati, senza doverli gestire manualmente
    attachListener(target, eventType, handler) {
        target.addEventListener(eventType, handler);
        this.activeListeners.push({ target, eventType, handler });
    }

    // aggiunge un evento in coda usando l'ApiManager globale
    addEventToQueue(event_fqn, metadata = {}) {
        if (!this.isActive) return;
        ApiManager.addEventToQueue(event_fqn, metadata);
    }


    // metodo per avviare l'observer (chiamato dall'Engine)
    start() {
        Log.error(`[${this.name}Observer] start() non implementato.`);
    }


    // metodo lanciato ad ogni cambio URL
    check() { 
        Log.error(`[${this.name}Observer] check() non implementato.`);
    }

    
    // metodo per spegnere l'observer quando l'esperimento finisce
    stop() {

        // segniamo che l'observer è disattivato
        this.isActive = false;

        // rimuoviamo TUTTI i listeners registrati
        for (let listener of this.activeListeners) {
            listener.target.removeEventListener(listener.eventType, listener.handler);
        }
        
        // svuotiamo il registro
        this.activeListeners = []; 
        
        // se un observer figlio ha bisogno di fare delle pulizie extra (es. resettare variabili, cancellare timers, etc) 
        // può implementare una funzione customCleanUp() 
        this.customCleanUp();
    }


    // metodo opzionale per pulizie extra alla disattivazione dell'observer
    customCleanUp() {
        // nessuna azione di default.
    }
}