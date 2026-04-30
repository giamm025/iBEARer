
class SearchSubmitted extends CustomEvent {

    constructor(query) {
        super("adapters.events.SearchSubmitted", {
            detail: {
                search_query: query
            }
        });
    }
}