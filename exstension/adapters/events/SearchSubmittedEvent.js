/**
 * definiamo come DEVE essere fatto il payload di SearchSubmittedEvent (nel nostro caso ci basta la search_query)
 * @typedef {Object} SearchSubmittedPayload
 * @property {string} search_query - Il testo che l'utente ha digitato nella barra di ricerca.
 */
 
class SearchSubmitted extends BaseEvent {

    /**
     * @param {SearchSubmittedPayload} payload
     */
    constructor(payload) {

        // check di consistenza: query deve essere una stringa non vuota
        if (!payload.search_query || typeof payload.search_query !== 'string') { throw new TypeError(`[SearchSubmittedEvent] Attesa una stringa per 'search_query', ricevuto: ${typeof payload.search_query}`); }

        // chiamiamo il costruttore
        super("adapters.events.SearchSubmitted", payload);
    }
}