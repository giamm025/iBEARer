// Questo observer si occupa di estrarre i risultati di ricerca ed inviarli al backend. Gestisce correttamente le 
// transizioni SPA, i continui caricamenti di chunk dell'infinite scroll, resettando memoria e contatori ad ogni cambio pagina.
// EDIT: Si attiva solo quando viene scatenato un trigger con conseguente intervento "trackResults"

class ResultsLoadedObserver extends BaseObserver {
    
    constructor() {
        super();
        this.currentObserver = null;
        this.initTimer = null;
        this.scrapedUrls = new Set();
    }

    start() {
        this.isActive = true;
    }

    // check() viene chiamato da SpaWatcher OGNI VOLTA che cambia l'URL
    check() {

        // se l'observer è spento, non facciamo nulla
        if (!this.isActive) return;

        // controlliamo se dopo il cambio URL siamo ancora in una pagina di ricerca
        const isSearchPage = PlatformAdapter.isSearchPage();

    // se non siamo in una ricerca (es. siamo tornati in Home), spegniamo tutto e puliamo la memoria
        if (!isSearchPage) {
            this.customCleanUp();
        }
        // se invece siamo ancora in una pagina di ricerca, aspettiamo che un trigger ci dica di accendere l'osservatore
    }

    // funzione per iniziare il tracciamento dei risultati
    startScraping(query) {
        
        // puliamo la memoria da eventuali ricerche precedenti
        this.customCleanUp();

        // AVVIAMO L'OBSERVER: impostiamo un timer di 1 sec per evitare di lanciare l'observer troppo presto, prima che la pagina 
        // abbia caricato (prima capitava che venissero inviati al backend anche i post della homepage siccome non davamo abbastanza
        // tempo a React di caricare i veri risultati di ricerca)
        this.initTimer = setTimeout(() => {
            
            // funzione per capire quale tab è attiva e decidere quale sottofunzione di scraping chiamare
            this._tryScrape(query);

            // EDIT: aggiungiamo un "debounce" di 500ms per l'observer. in questo modo evitiamo di lanciare tryScrape
            // ad ogni micro modifica. Lo lanciamo solo dopo che il DOM ha finito di caricarsi
            let debounceTimeout = null;
            this.currentObserver = new MutationObserver(() => {

                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    this._tryScrape(query);
                }, 500); 

            });

            this.currentObserver.observe(document.body, { childList: true, subtree: true });
        }, 1000); 
    }

    /** 
     * Metodo privato che esegue lo scraping e invia i nuovi risultati alla coda 
     * @param {string} query La query di ricerca attuale
     */
    _tryScrape(query) {
        
        // chiediamo all'Adapter di fare lo scraping per noi
        const rawResults = PlatformAdapter.scrapePageResults();
        const newResults = [];

        // inseriamo in newResults solo i nuovi risultati (che non sono già presenti in scrapedUrls)
        for (const item of rawResults) {
            if (!this.scrapedUrls.has(item.url)) {
                this.scrapedUrls.add(item.url);
                item.position = this.scrapedUrls.size; 
                newResults.push(item);
            }
        }

        // se abbiamo estratto nuovi risultati, inviamo tutto al backend
        if (newResults.length > 0) {
            this.addEventToQueue("telemetry.events.ResultsLoadedEvent", {
                search_query: query,
                extracted_count: newResults.length,
                scraped_posts: newResults
            });
            // Log.adapter(`ResultsLoadedObserver: Estratti ${newResults.length} risultati (${tabType.toUpperCase()}) per la query: "${query}".`);
        }
    }

    customCleanUp() {
        if (this.currentObserver) {
            this.currentObserver.disconnect();
            this.currentObserver = null;
        }

        if (this.initTimer) {
            clearTimeout(this.initTimer);
            this.initTimer = null;
        }
        
        this.scrapedUrls.clear(); 
    }
}

window.ResultsLoaded = new ResultsLoadedObserver();