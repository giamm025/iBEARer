// reddit_adapter.js

function runRedditAdapter() {
    Log.adapter("Reddit Adapter avviato e vigile.");
    
    // Creiamo una funzione isolata per fare il controllo
    const checkForConspiracySearch = () => {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (window.location.pathname.includes('/search') && urlParams.has('q')) {
            const query = urlParams.get('q');
            Log.adapter(`Rilevata ricerca per: "${query}". Emetto l'evento...`);
            
            const searchEvent = new CustomEvent("adapters.events.SearchResultsLoadedEvent", {
                detail: {
                    search_query: query
                }
            });
            document.dispatchEvent(searchEvent);
        }
    };

    // 1. Eseguiamo il controllo appena la pagina viene caricata fisicamente (es. se l'utente ci arriva da un link esterno o fa F5)
    checkForConspiracySearch();

    // 2. Trappola SPA: Ascoltiamo i cambiamenti dell'URL fatti da React senza ricaricare la pagina
    let lastUrl = location.href; 
    
    const observer = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            Log.adapter("Reddit ha cambiato pagina internamente (SPA routing)!");
            // Aspettiamo un istante che i nuovi risultati vengano caricati da Reddit, poi controlliamo
            setTimeout(checkForConspiracySearch, 500); 
        }
    });

    // Agganciamo l'observer al body intero
    observer.observe(document.body, { subtree: true, childList: true });
}

runRedditAdapter();