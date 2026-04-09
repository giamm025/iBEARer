
class SearchResultsLoadedEvent extends CustomEvent {

    constructor(query) {
        super("adapters.events.SearchResultsLoadedEvent", {
            detail: {
                search_query: query
            }
        });
    }
}