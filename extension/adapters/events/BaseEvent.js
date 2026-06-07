/**
 * @typedef {Object} GenericPayload
 * @description Un payload generico. Le sottoclassi DEVOLO specializzare questo tipo.
 */

class BaseEvent extends CustomEvent {
    
    /**
     * @param {string} eventFqn - Il Fully Qualified Name dell'evento (es. "SearchSubmittedEvent")
     * @param {GenericPayload} payload - Il contesto dell'evento.
     */
    constructor(eventFqn, payload = {}) {
        
        // check di consistenza: il FQN deve essere una stringa non vuota
        if (!eventFqn || typeof eventFqn !== 'string') { throw new Error(`[Architecture Violation] FQN non valido.`); }
        super(eventFqn, {
            detail: payload,    // payload accessibile tramite event.detail
            bubbles: true,      // permette all'evento di propagarsi verso l'alto nella gerarchia DOM, rendendolo ascoltabile da qualsiasi livello
            cancelable: true    // permette agli ascoltatori di chiamare event.preventDefault() per impedire l'azione predefinita associata all'evento
        });
        this.payload = payload;
    }
}