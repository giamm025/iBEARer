// Questo observer si occupa di estrarre i risultati di ricerca.
// Gestisce correttamente le transizioni SPA, resettando memoria e contatori ad ogni cambio pagina.

TelemetryRegistry["telemetry.events.SearchResultsScrapedEvent"] = {
    
    currentObserver: null,
    initTimer: null,
    scrapedUrls: new Set(), 
    apiManagerRef: null,

    // start() viene chiamato una sola volta da core_engine.js all'avvio
    // in questo caso non facciamo nulla. Aspettiamo solo che l'url cambi (cioe che l'SpaWatcher ci chiami tramite check())
    start(apiManager) {
        this.apiManagerRef = apiManager;
        Log.telemetry_registry("Observer SearchResultsScrapedEvent in attesa di SpaWatcher...");
    },

    // check() viene chiamato da SpaWatcher OGNI VOLTA che cambia l'URL
    check() {
        
        // prendiamo l'url e i parametri di ricerca della pagina in cui ci troviamo
        const urlParams = new URLSearchParams(window.location.search);

        // se non siamo in una ricerca (es. siamo tornati in Home), spegniamo tutto e puliamo la memoria
        if (!window.location.pathname.includes('/search') || !urlParams.has('q')) {
            this.stopAndClean();
            return;
        }

        // se invece siamo in una ricerca estraiamo la search_query
        const query = urlParams.get('q');

        // e resettiamo la memoria (necessario per far ripartire il contatore position da 1 ad ogni nuova ricerca)
        this.stopAndClean();

        // funzione per estrarre i dati dei post
        const tryScrape = () => {

            // crechiamo i post (risultati delle ricerche), che Reddit avvolge nel tag <shreddit-post>
            // EDIT: <shreddit-post> non funziona piu... quindi usiamo i link ai commenti. ogni post ne deve avere uno.
            const links = document.querySelectorAll('a[href*="/comments/"]');
            const newResults = [];

            // per ogni link (post) trovato estriamo i dati
            links.forEach((link) => {

                // prendiamo l'url del post
                const url = link.href; 

                // se l'url è gia presente, saltiamo questo post. altrimenti lo aggiungiamo al Set
                if (!url || this.scrapedUrls.has(url)) return; 
                this.scrapedUrls.add(url);

                // estraiamo il subreddit ed il titolo del post dall'url
                const subMatch = url.match(/\/r\/([^\/]+)\/comments\//i);
                const subreddit = subMatch ? "r/" + subMatch[1] : "";
                let title = (link.innerText || link.getAttribute('aria-label') || "").replace(/\s+/g, ' ').trim();

                // aggiungiamo il post alla lista dei risultati da inviare al backend
                newResults.push({
                    position: this.scrapedUrls.size,
                    title: title,
                    url: url,
                    subreddit: subreddit
                });
            });

            // se abbiamo estratto nuovi post, inviamo tutto al backend
            if (newResults.length > 0) {
                this.apiManagerRef.addEventToQueue("telemetry.events.SearchResultsScrapedEvent", {
                    search_query: query,
                    extracted_count: newResults.length,
                    scraped_posts: newResults
                });
                Log.adapter(`Telemetria: Estratti ${newResults.length} post per "${query}".`);
            }
        };

        // AVVIAMO L'OBSERVER
        // impostiamo un timer di 1 sec per evitare di lanciare l'observer troppo presto, prima che la pagina abbia caricato 
        // (prima capitava che venissero inviati al backend anche i post della homepage siccome non davamo abbastanza tempo a react di caricare i veri risultati di ricerca)
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