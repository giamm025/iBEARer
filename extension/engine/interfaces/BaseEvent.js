/**
 * @typedef {Object} GenericPayload
 * @description Un payload generico. Le sottoclassi DEVOLO specializzare questo tipo.
 */
class BaseEvent extends CustomEvent {

    /**
     * @param {GenericPayload} payload - Il contesto dell'evento.
     */
    constructor(payload = {}) {
        
        // estriamo il FQN in automatico
        const leafClassName = new.target.name;
        const eventFqn = BaseEvent._generateFQN(leafClassName); 

        // check di consistenza: il FQN deve essere una stringa non vuota
        if (!eventFqn || typeof eventFqn !== 'string') { throw new Error(`[Architecture Violation] FQN non valido.`); }
        super(eventFqn, {
            detail: payload,    // payload accessibile tramite event.detail
            bubbles: true,      // permette all'evento di propagarsi verso l'alto nella gerarchia DOM, rendendolo ascoltabile da qualsiasi livello
            cancelable: true    // permette agli ascoltatori di chiamare event.preventDefault() per impedire l'azione predefinita associata all'evento
        });
        this.payload = payload;
        this.eventFqn = eventFqn;

        // aggiungiamo il nuovo evento al regitro globale (se non esiste lo crea)
        if (!window.EventRegistry) { window.EventRegistry = []; }
        if (!window.EventRegistry.includes(eventFqn)) {  window.EventRegistry.push(eventFqn); }
        Log.event_registry(`Evento registrato: \t${eventFqn}`);
    }

    // metodo per estrarre il FQN in automatico (genera un errore fittizzio e silenzioso, poi analizza lo stack trace)
    static _generateFQN(leafClassName) {
        try {
            // generiamo un errore silenzioso per leggere la cronologia delle chiamate
            const stack = new Error().stack;
            
            // prendiamo l'URL base della nostra estensione (es. chrome-extension://abcdefgh...)
            const baseUrl = chrome.runtime.getURL('');

            // dividiamo lo stack trace in righe e filtriamo solo quelle della nostra estensione
            const extensionLines = stack.split('\n').filter(line => line.includes(baseUrl));
            
            // prendiamo il nome della classe che ha generato l'evento (la "foglia" più profonda nello stack)
            let targetPath = null;
            for (let line of extensionLines) {
                
                // estraiamo tutto ciò che c'è DOPO l'URL base e PRIMA dei due punti (es. "chrome-extension://ID/adapters/events/Search.js:10:5" -> "adapters/events/Search.js")
                const match = line.match(new RegExp(baseUrl + "([^:]+)"));
                if (match && match[1]) { 
                    const path = match[1];
                    
                    // cerchiamo la riga esatta in cui la classe foglia viene istanziata
                    if (line.includes(leafClassName)) {
                        targetPath = path;
                        break;
                    }
                }
            }

            // trasformiamo "adapters/events/SearchSubmitted.js" in "adapters.events.SearchSubmitted"
            if (targetPath) { 
                return targetPath.replace('.js', '').split('/').join('.'); 
            }

        } catch (e) {
            console.warn(`[BaseEvent] Impossibile estrarre FQN automatico per ${leafClassName.constructor.name}`, e);
        }
    }
}