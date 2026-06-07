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
        const eventFqn = BaseEvent._generateFQN(); 

        // check di consistenza: il FQN deve essere una stringa non vuota
        if (!eventFqn || typeof eventFqn !== 'string') { throw new Error(`[Architecture Violation] FQN non valido.`); }
        super(eventFqn, {
            detail: payload,    // payload accessibile tramite event.detail
            bubbles: true,      // permette all'evento di propagarsi verso l'alto nella gerarchia DOM, rendendolo ascoltabile da qualsiasi livello
            cancelable: true    // permette agli ascoltatori di chiamare event.preventDefault() per impedire l'azione predefinita associata all'evento
        });
        this.payload = payload;
        Log.event_registry(`Evento registrato: ${eventFqn}`);
    }

    // metodo per estrarre il FQN in automatico (genera un errore fittizzio e silenzioso, poi analizza lo stack trace)
    static _generateFQN() {
        try {
            // generiamo un errore silenzioso per leggere la cronologia delle chiamate
            const stack = new Error().stack;
            
            // prendiamo l'URL base della nostra estensione (es. chrome-extension://abcdefgh...)
            const baseUrl = chrome.runtime.getURL('');

            // dividiamo lo stack trace in righe e filtriamo solo quelle della nostra estensione
            const extensionLines = stack.split('\n').filter(line => line.includes(baseUrl));

            // cerchiamo la prima riga che NON è BaseEvent.js => quella sara la classe figlia
            let targetPath = null;
            for (let line of extensionLines) {
                
                // estraiamo tutto ciò che c'è DOPO l'URL base e PRIMA dei due punti (es. "chrome-extension://ID/adapters/events/Search.js:10:5" -> "adapters/events/Search.js")
                const match = line.match(new RegExp(baseUrl + "([^:]+)"));
                if (match && match[1]) {
                    const path = match[1]; 
                    if (!path.includes('BaseEvent.js')) { targetPath = path; break; }
                }
            }

            // trasformiamo "adapters/events/SearchSubmitted.js" in "adapters.events.SearchSubmitted"
            if (targetPath) { 
                return targetPath.replace('.js', '').split('/').join('.'); 
            }

        } catch (e) {
            console.warn(`[BaseEvent] Impossibile estrarre FQN automatico`, e);
        }
    }
}