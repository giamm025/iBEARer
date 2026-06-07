// creiamo un nuovo Observer che espone solo la funzione check(): responsabile di controllare se l'utente ha fatto una ricerca 
// su Reddit e di emettere l'evento corrispondente (SearchSubmitted)

class SearchSubmittedObserver extends BaseObserver {

    constructor() {
        super("SearchSubmitted");
    }

    start() {
        this.isActive = true;
    }

    check() {

        if (!this.isActive) return;

        // creiamo un URLSearchParams per leggere i parametri dall'URL (es. ?q=conspiracy)
        const urlParams = new URLSearchParams(window.location.search);
        
        // per come funziona reddit le ricerche vengono fatte su .../search e la query specifica inserita nel parametro "q"
        if (window.location.pathname.includes('/search') && urlParams.has('q')) {
            const query = urlParams.get('q');                                           // estraiamo la query di ricerca
            const searchEvent = new SearchSubmittedEvent({search_query: query});        // creiamo un nuovo evento " L'utente ha cercato *query* "
            document.dispatchEvent(searchEvent);                                        // emettiamo l'evento
        }
    }
};

window.SearchSubmittedObserver = new SearchSubmittedObserver();
Log.telemetry_registry("Observer caricato: SearchSubmitted");