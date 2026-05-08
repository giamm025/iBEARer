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

    // funzione per iniziare il tracciamento dei risultati
    startScraping(query) {
        
        // puliamo la memoria da eventuali ricerche precedenti
        this.customCleanUp();
        
        // funzione per capire quale tab è attiva e decidere quale sottofunzione di scraping chiamare
        const tryScrape = () => {
            
            // estraiamo l'intero url ed il parametro "type" per capire quale tab è aperto (es. posts, communities, people, comments)
            const urlParams = new URLSearchParams(window.location.search);
            const tabType = urlParams.get('type') || "all";
            let newResults = [];

            switch (tabType) {

                case "all":
                case "posts":
                case "media":
                    newResults = this.scrapePosts();
                    break;
                
                case "communities":
                    newResults = this.scrapeCommunities(); 
                    break;
                
                case "comments":
                    newResults = this.scrapeComments();
                    break;

                case "people":
                    newResults = this.scrapePeople();
                    break;

                default:
                    Log.adapter(`ResultsLoadedObserver: Tab type '${tabType}' sconosciuto o non tracciato.`);
                    break;
            }

            // se abbiamo estratto nuovi risultati, inviamo tutto al backend
            if (newResults.length > 0) {
                this.addEventToQueue("telemetry.events.ResultsLoadedEvent", {
                    search_query: query,
                    extracted_count: newResults.length,
                    scraped_posts: newResults
                });
                Log.adapter(`ResultsLoadedObserver: Estratti ${newResults.length} risultati (${tabType.toUpperCase()}) per la query: "${query}".`);
            }
        };

        // AVVIAMO L'OBSERVER: impostiamo un timer di 1 sec per evitare di lanciare l'observer troppo presto, prima che la pagina 
        // abbia caricato (prima capitava che venissero inviati al backend anche i post della homepage siccome non davamo abbastanza
        // tempo a React di caricare i veri risultati di ricerca)
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

    // ----------------------------------------------------------------------------------
    // STRATEGIE DI SCRAPING SPECIFICHE PER TAB
    // ----------------------------------------------------------------------------------

    // POSTS, ALL e MEDIA 
    scrapePosts() {

        // estriamo tutti i titoli dei post (usando il selettore specifico)
        const titleLinks = document.querySelectorAll('a[data-testid="post-title"]');
        const results = [];

        // per ogni link al titolo (post) trovato estriamo i dati
        titleLinks.forEach((link) => {

            // prendiamo l'url del post e lo normalizziamo (togliamo la query e tutto quello dopo gli #)
            const url = link.href.split('?')[0].split('#')[0]; 

            // ignoriamo i link diretti ai singoli commenti
            if (!url || url.includes('/comment/')) return; 

            // se l'url è gia presente, saltiamo questo post. altrimenti lo aggiungiamo al Set
            if (this.scrapedUrls.has(url)) return;

            // estraiamo il titolo
            const title = link.innerText.replace(/\s+/g, ' ').trim();

            // aggiungiamo l'url al alla lista dei risultati
            this.scrapedUrls.add(url); 

            // estraiamo il subreddit
            const subMatch = url.match(/\/r\/([^\/]+)\/comments\//i);
            const subreddit = subMatch ? "r/" + subMatch[1] : "";

            // aggiungiamo il post alla lista dei risultati da inviare al backend
            results.push({
                type: "POST",
                position: this.scrapedUrls.size, 
                title: title,
                url: url,
                subreddit: subreddit,
                content_text: "" 
            });
        });

        return results;
    }

    // COMMUNITIES
    scrapeCommunities() {

        // estriamo tutti i blocchi che rappresentano una community 
        const communityBlocks = document.querySelectorAll('div[data-testid="search-community"]');
        const results = [];

        // per ogni blocco di community trovato, estraiamo i dati
        communityBlocks.forEach((block) => {

            // cerchiamo il link che porta al subreddit
            const link = block.querySelector('a[href^="/r/"]');
            if (!link) return;

            // puliamo l'URL
            const url = link.href.split('?')[0].split('#')[0];
            
            // se abbiamo già visto questo URL, saltiamo questa community
            if (this.scrapedUrls.has(url)) return;

            // estraiamo il nome della community che si trova dentro il tag H2
            const titleElement = block.querySelector('h2');
            let communityName = titleElement ? titleElement.innerText.trim() : "";
            
            // FALLBACK: se Reddit dovesse cambiare l'H2, estraiamo il nome direttamente dall'URL (es. /r/destiny2/)
            if (!communityName) {
                const subMatch = url.match(/\/r\/([^\/]+)/i);
                communityName = subMatch ? "r/" + subMatch[1] : "Comunità Sconosciuta";
            }

            // aggiungiamo l'url al set per evitare duplicati
            this.scrapedUrls.add(url);

            // per le community, il "subreddit" coincide letteralmente con il titolo (es. "r/destiny2")
            const subreddit = communityName.startsWith("r/") ? communityName : "";

            // aggiungiamo il post alla lista dei risultati da inviare al backend
            results.push({
                type: "COMMUNITY",
                position: this.scrapedUrls.size,
                title: communityName,
                url: url,
                subreddit: subreddit,
                content_text: ""
            });
        });

        return results;
    }

    // COMMENTS
    scrapeComments() {

        // estriamo tutti i blocchi che rappresentano un commento 
        const commentBlocks = document.querySelectorAll('div[data-testid="search-sdui-comment-unit"]');
        const results = [];

        // per ogni blocco commento trovato, estraiamo i dati
        commentBlocks.forEach((block) => {

            // CERCHIAMO IL LINK AL COMMENTO: Reddit usa un tag <a> invisibile sopra il testo del commento legato tramite aria-labelledby
            const commentLink = block.querySelector('a[aria-labelledby^="comment-content-"]');
            if (!commentLink) return;

            // prendiamo l'url del commento e lo normalizziamo (togliamo la query e tutto quello dopo gli #)
            const url = commentLink.href.split('?')[0].split('#')[0];
            
            // se abbiamo già visto questo URL, saltiamo questo commento
            if (this.scrapedUrls.has(url)) return;

            // estraiamo il titolo del post "padre"
            const postTitleElement = block.querySelector('h2.i18n-search-comment-post-title');
            const postTitle = postTitleElement ? postTitleElement.innerText.trim() : "Titolo Sconosciuto";

            // estriamo il testo del commento
            const commentContentElement = block.querySelector('.i18n-search-comment-content');
            const commentText = commentContentElement ? commentContentElement.innerText.trim() : "";

            // estraiamo il subreddit
            const subMatch = url.match(/\/r\/([^\/]+)/i);
            const subreddit = subMatch ? "r/" + subMatch[1] : "";

            // aggiungiamo l'url al set per evitare duplicati
            this.scrapedUrls.add(url);

            // aggiungiamo il post alla lista dei risultati da inviare al backend
            results.push({
                type: "COMMENT",
                position: this.scrapedUrls.size,
                title: postTitle,        
                url: url,                
                subreddit: subreddit,
                content_text: commentText 
            });
        });

        return results;
    }

    // PEOPLE
    scrapePeople() {

        // estriamo tutti i blocchi che rappresentano un profilo 
        const peopleBlocks = document.querySelectorAll('div[data-testid="search-author"]');
        const results = [];

        // per ogni blocco profilo trovato, estraiamo i dati
        peopleBlocks.forEach((block) => {

            // cerchiamo il link che porta al profilo dell'utente
            const link = block.querySelector('a[href^="/user/"]');
            if (!link) return;

            // prendiamo l'url e lo normalizziamo (togliamo la query e tutto quello dopo gli #)
            const url = link.href.split('?')[0].split('#')[0];
            
            // se abbiamo già visto questo URL, saltiamo questo profilo
            if (this.scrapedUrls.has(url)) return;

            // estriamo il nome utente (tag H2)
            const titleElement = block.querySelector('h2');
            let username = titleElement ? titleElement.innerText.trim() : "";
            
            // FALLBACK: estraiamo dall'URL
            if (!username) {
                const userMatch = url.match(/\/user\/([^\/]+)/i);
                username = userMatch ? "u/" + userMatch[1] : "Utente Sconosciuto";
            }

            // estraiamo la bio dell'utente se presente (tag <p> con data-testid="search-subreddit-desc-text")
            const descElement = block.querySelector('p[data-testid="search-subreddit-desc-text"]');
            const description = descElement ? descElement.innerText.trim() : "";

            // aggiungiamo l'url al set per evitare duplicati
            this.scrapedUrls.add(url);

            // aggiungiamo il post alla lista dei risultati da inviare al backend
            results.push({
                type: "PERSON",
                position: this.scrapedUrls.size,
                title: username,             
                url: url,                 
                subreddit: "",            
                content_text: description 
            });
        });

        return results;
    }

    // ----------------------------------------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------------------------------------

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