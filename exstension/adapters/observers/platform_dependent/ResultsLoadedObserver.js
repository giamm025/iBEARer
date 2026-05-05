// Questo observer si occupa di estrarre i risultati di ricerca ed inviarli al backend. Gestisce correttamente le 
// transizioni SPA, i continui caricamenti di chunk dell'infinite scroll, resettando memoria e contatori ad ogni cambio pagina.
// EDIT: Si attiva solo quando viene scatenato un trigger con conseguente intervento "trackResults"

class ResultsLoadedObserver extends BaseObserver {
    
    constructor() {
        super("ResultsLoaded");
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
        const urlParams = new URLSearchParams(window.location.search);
        const isSearchPage = window.location.pathname.includes('/search') && urlParams.has('q');

        // se non siamo in una ricerca (es. siamo tornati in Home), spegniamo tutto e puliamo la memoria
        if (!isSearchPage) {
            this.customCleanUp();
        }
        // se invece siamo ancora in una pagina di ricerca, aspettiamo che un trigger ci dica di accendere l'osservatore
    }

    // funzione per iniziare il tracciamento dei risultati. Verra chiamata dagli interventi quando scatta il trigger.
    startScraping(query) {
        
        // puliamo la memoria da eventuali ricerche precedenti
        this.customCleanUp();
        
        // funzione per estrarre i dati dei post
        const tryScrape = () => {
            
            // crechiamo i post (risultati delle ricerche), che Reddit avvolge nel tag <shreddit-post>
            // EDIT: <shreddit-post> non funziona piu... quindi usiamo i link ai commenti. ogni post ne deve avere uno.
            const links = document.querySelectorAll('a[href*="/comments/"]');
            const newResults = [];

            // per ogni link (post) trovato estriamo i dati
            links.forEach((link) => {

                // prendiamo l'url del post e lo normalizziamo (togliamo la query e tutto quello dopo gli #)
                const url = link.href.split('?')[0].split('#')[0]; 

                // EDIT: ogni post ha un link "comments", MA se invece abbiamo un link 
                // "comment" (singolare) stiamo guardando letteralmente un COMMENTO => dobbiamo ignorarlo
                if (!url || url.includes('/comment/')) return; 

                // se l'url è gia presente, saltiamo questo post. altrimenti lo aggiungiamo al Set
                if (!url || this.scrapedUrls.has(url)) return;

                // estraiamo il titolo
                let title = (link.innerText || link.getAttribute('aria-label') || "").replace(/\s+/g, ' ').trim();                
                
                // solitamente il link del titolo principale avvolge quasi sempre un <h2> o <h3>. 
                const hasHeader = link.querySelector('h2, h3, h4');

                // se il link non ha un header ed il testo è sospettosamente corto (es. "1 anno fa", "Condividi")
                // probabilmente il parsing ha sbagliato e quello che ha pescato non è il titolo
                if (!hasHeader && title.length < 15) return;

                // aggiungiamo l'url al alla lista dei risultati
                this.scrapedUrls.add(url); 

                // estraiamo il subreddit
                const subMatch = url.match(/\/r\/([^\/]+)\/comments\//i);
                const subreddit = subMatch ? "r/" + subMatch[1] : "";

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
                this.addEventToQueue("telemetry.events.ResultsLoadedEvent", {
                    search_query: query,
                    extracted_count: newResults.length,
                    scraped_posts: newResults
                });
                Log.adapter(`ResultsLoadedObserver: Estratti ${newResults.length} post per la query: "${query}".`);
            }
        };

        // AVVIAMO L'OBSERVER
        // impostiamo un timer di 1 sec per evitare di lanciare l'observer troppo presto, prima che la pagina abbia caricato 
        // (prima capitava che venissero inviati al backend anche i post della homepage siccome non davamo abbastanza tempo a react di caricare i veri risultati di ricerca)
        this.initTimer = setTimeout(() => {

            tryScrape();

            // EDIT: aggiungiamo un "debounce" di 500ms per l'observer. in questo modo evitiamo di lanciare tryScrape
            // ad ogni micro modifica. Lo lanciamo solo dopo che il DOM ha finito di caricarsi
            let debounceTimeout = null;
            this.currentObserver = new MutationObserver(() => {

                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    tryScrape();
                }, 500); 

            });

            this.currentObserver.observe(document.body, { childList: true, subtree: true });
        }, 1000); 
    }

    // funzione helper per spegnere i motori e formattare il disco
    customCleanUp() {
        
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
}

window.ResultsLoaded = new ResultsLoadedObserver();