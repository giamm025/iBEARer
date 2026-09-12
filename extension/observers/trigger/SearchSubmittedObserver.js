// creiamo un nuovo Observer che espone solo la funzione check(): responsabile di controllare se l'utente ha fatto una ricerca 
// ed emettere l'evento corrispondente (SearchSubmitted)

class SearchSubmittedObserver extends BaseTriggerObserver {

    constructor() {
        // per estrarre il nome dell'evento che questo observer deve intercettare, creiamo un evento fittizio e ne estraiamo il FQN
        const event = new SearchSubmittedEvent();
        super(event.eventFqn);
    }

    start() {
        this.isActive = true;
    }

    check() {
        // se siamo su una pagina di ricerca => estriamo la query di ricerca => creiamo l'evento custom => emettiamo l'evento
        if (!this.isActive) return;
        if (PlatformAdapter.isSearchPage()) {
            const query = PlatformAdapter.getCurrentSearchQuery();                                          
            const searchEvent = new SearchSubmittedEvent({search_query: query});        
            document.dispatchEvent(searchEvent);                                        
        }
    }
};

window.SearchSubmittedObserver = new SearchSubmittedObserver();