/**
 * @class BaseObserver
 * @description Classe astratta (Interfaccia) per la gestione della telemetria passiva.
 * Gestisce automaticamente la registrazione, il tracciamento e la pulizia degli Event Listener.
 */
class BaseObserver {

    constructor() {
        
        // Estraiamo il path completo (es. "adapters.observers.SearchSubmittedObserver")
        this.observerFqn = BaseObserver._generateFQN();
        this.name = this.observerFqn.split('.').pop();
        this.activeListeners = [];
        this.isActive = false;
        
        // aggiungiamo il nuovo observer al regitro globale (se non esiste lo crea)
        if (!window.ObserverRegistry) { window.ObserverRegistry = []; }
        window.ObserverRegistry.push(this);    
        Log.telemetry_registry(`Observer caricato in memoria: ${this.observerFqn}`);
    }

    // metodo per estrarre il FQN in automatico (genera un errore fittizzio e silenzioso, poi analizza lo stack trace)
    static _generateFQN() {
        try {
            const stack = new Error().stack;
            const baseUrl = chrome.runtime.getURL('');
            const extensionLines = stack.split('\n').filter(line => line.includes(baseUrl));

            let targetPath = null;
            for (let line of extensionLines) {
                const match = line.match(new RegExp(baseUrl + "([^:]+)"));
                if (match && match[1]) {
                    const path = match[1]; 
                    if (!path.includes('BaseObserver.js')) { targetPath = path; break; }
                }
            }

            if (targetPath) { 
                return targetPath.replace('.js', '').split('/').join('.'); 
            }
        } catch (e) {
            console.warn(`[BaseObserver] Impossibile estrarre FQN automatico per ${this.name}`, e);
        }
    }

    /**
     * Helper per registrare un Event Listener tenendone traccia. In questo modo quando chiameremo stop(), avremo gia TUTTI i listeners registrati, senza doverli gestire manualmente
     * * @param {EventTarget} target - L'elemento DOM (es. document, window, o un div specifico)
     * @param {string} eventType - Il nome dell'evento (es. "click", "scroll", "keydown")
     * @param {Function} handler - La funzione di callback da eseguire
     * @param {boolean} useCapture - Se l'evento deve essere catturato in fase di cattura
     */
    attachListener(target, eventType, handler, useCapture = false) {
        target.addEventListener(eventType, handler, useCapture);
        this.activeListeners.push({ target, eventType, handler, useCapture });
    }

    /**
     * Aggiunge un evento in coda usando l'ApiManager globale, controllando che l'Observer sia attivo.
     * * @param {string} event_fqn - Fully Qualified Name dell'evento di telemetria (es. "telemetry.events.ClickEvent")
     * @param {Object} [metadata={}] - Dati aggiuntivi estratti dall'evento (il Payload)
     */
    addEventToQueue(event_fqn, metadata = {}) {
        if (!this.isActive) return;
        ApiManager.addEventToQueue(event_fqn, metadata);
    }


    /**
     * Metodo per avviare l'observer (chiamato dall'Engine).
     * Le sottoclassi DEVONO sovrascrivere questo metodo, ricordandosi di impostare `this.isActive = true`.
     */
    start() {
        Log.error(`[${this.name}Observer] start() non implementato.`);
    }


    /**
     * Metodo lanciato dall'architettura ad ogni cambio URL dall'SpaWatcher.
     * Le sottoclassi DEVONO sovrascriverlo se devono rivalutare il DOM al cambio pagina.
     */
    check() { 
        Log.error(`[${this.name}Observer] check() non implementato.`);
    }

    
    /**
     * Metodo standard per spegnere l'observer e rimuovere tutti i listener registrati.
     * È sconsigliato sovrascriverlo; utilizzare customCleanUp() per logiche extra.
     */    
    stop() {

        // segniamo che l'observer è disattivato
        this.isActive = false;

        // rimuoviamo TUTTI i listeners registrati
        for (let listener of this.activeListeners) {
            listener.target.removeEventListener(listener.eventType, listener.handler, listener.useCapture);
        }
        
        // svuotiamo il registro
        this.activeListeners = []; 
        
        // se un observer figlio ha bisogno di fare delle pulizie extra (es. resettare variabili, cancellare timers, etc) 
        // può implementare una funzione customCleanUp() 
        this.customCleanUp();
    }


    /**
     * Metodo opzionale per pulizie extra (es. resettare variabili, cancellare setTimeout/setInterval, ecc.)
     */    customCleanUp() {
        // nessuna azione di default.
    }
}