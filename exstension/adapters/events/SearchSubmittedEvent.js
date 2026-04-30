class SearchSubmitted extends BaseEvent {

    /**
     * @param {string} query
     */
    constructor(query) {

        // check di consistenza: query deve essere una stringa non vuota
        if (!query || typeof query !== 'string') { throw new TypeError(`[SearchSubmittedEvent] Attesa una stringa per 'query', ricevuto: ${typeof query}`); }

        // chiamiamo il costruttore
        super("adapters.events.SearchSubmitted", {
            search_query: query
        });
    }
}