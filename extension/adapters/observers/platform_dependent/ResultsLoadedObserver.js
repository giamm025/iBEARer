// Questo observer si occupa di estrarre i risultati di ricerca ed inviarli al backend. Gestisce correttamente le 
// transizioni SPA, i continui caricamenti di chunk dell'infinite scroll, resettando memoria e contatori ad ogni cambio pagina.
// EDIT: Si attiva solo quando viene scatenato un trigger con conseguente intervento "trackResults"

window.ResultsLoaded = {
    
    currentObserver: null,
    initTimer: null,
    scrapedUrls: new Set(), 

    // check() viene chiamato da SpaWatcher OGNI VOLTA che cambia l'URL
    // check() viene chiamato da SpaWatcher OGNI VOLTA che cambia l'URL
    check() {
        // Controlliamo se siamo ancora in una pagina di ricerca
        const urlParams = new URLSearchParams(window.location.search);
        const isSearchPage = window.location.pathname.includes('/search') && urlParams.has('q');

        // Se l'utente è USCITO dalla ricerca (es. tornato alla Home), spegniamo l'observer zombie
        if (!isSearchPage) {
            this.stopAndClean();
            Log.adapter("Utente uscito dalla ricerca. Observer ResultsLoaded spento.");
        }
        
        // Se invece siamo ancora in una pagina di ricerca, NON FACCIAMO NULLA.
        // Aspettiamo che sia l'Intervento del core_engine a chiamare startScraping() e gestire tutto.
    },

    // funzione per iniziare il tracciamento dei risultati. Verra chiamata dagli interventi quando scatta il trigger.
    startScraping(query) {
        
        // 1. Prima di iniziare, puliamo la memoria da eventuali ricerche precedenti
        // Mettendolo qui, evitiamo qualsiasi Race Condition con l'Adapter!
        this.stopAndClean();
        
        Log.adapter(`ResultsLoadedObserver: Avvio scraping mirato per "${query}"...`);

        // 2. funzione per estrarre i dati dei post
        const tryScrape = () => {
            
            const links = document.querySelectorAll('a[href*="/comments/"]');
            const newResults = [];

            links.forEach((link) => {
                const url = link.href; 
                if (!url || this.scrapedUrls.has(url)) return; 
                this.scrapedUrls.add(url);

                const subMatch = url.match(/\/r\/([^\/]+)\/comments\//i);
                const subreddit = subMatch ? "r/" + subMatch[1] : "";
                let title = (link.innerText || link.getAttribute('aria-label') || "").replace(/\s+/g, ' ').trim();

                newResults.push({
                    position: this.scrapedUrls.size,
                    title: title,
                    url: url,
                    subreddit: subreddit
                });
            });

            if (newResults.length > 0) {
                ApiManager.addEventToQueue("telemetry.events.TargetedResultsLoadedEvent", {
                    search_query: query,
                    extracted_count: newResults.length,
                    scraped_posts: newResults
                });
                Log.adapter(`ResultsLoadedObserver: Estratti ${newResults.length} post per la query: "${query}".`);
            }
        };

        // 3. AVVIAMO L'OBSERVER con il ritardo per schivare il Ghost DOM
        this.initTimer = setTimeout(() => {
            tryScrape(); 
            this.currentObserver = new MutationObserver(() => { tryScrape(); });
            this.currentObserver.observe(document.body, { childList: true, subtree: true });
        }, 1000); 
    },

    // funzione helper per spegnere i motori e formattare il disco
    stopAndClean() {
        
        // se c'è un observer attivo, lo disconnettiamo
        if (this.currentObserver) {
            this.currentObserver.disconnect();
            this.currentObserver = null;
        }

        // se c'è un timer di inizializzazione in corso, lo cancelliamo
        if (this.initTimer) {
            clearTimeout(this.initTimer);
            this.initTimer = null;
        }
        
        // svuotiamo il Set. In questo modo il prossimo post estratto avrà position 1.
        this.scrapedUrls.clear(); 
    }
};