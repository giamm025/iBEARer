/**
 * definiamo come DEVE essere fatto il payload di SearchSubmittedEvent (nel nostro caso ci basta la search_query)
 * @typedef {Object} SearchSubmittedPayload
 * @property {string} search_query - Il testo che l'utente ha digitato nella barra di ricerca.
 */
 
class SearchSubmittedEvent extends BaseEvent {

    /**
     * @param {SearchSubmittedPayload} payload
     */
    constructor(payload) {

        // chiamiamo il costruttore
        super(payload);
    }
}