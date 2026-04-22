// questo observer si occupa di capire quando Reddit ha caricato i risulati di una ricerca. Dopo di che estrae i dati principali 
// (titolo, url, subreddit) ed emette l'evento "ResultsLoaded" per inviare i dati al backend

TelemetryRegistry["telemetry.events.SearchResultsScrapedEvent"] = {
    
    start(apiManager) {

        // ci mettiamo in attesa dell'evento "SearchResultsLoadedEvent" che viene emesso da SearchObserver quando intercetta una ricerca.
        document.addEventListener('adapters.events.SearchResultsLoadedEvent', (e) => {
            
            // estraiamo la query di ricerca dall'evento (o dall'URL)
            const query = (e.detail && e.detail.search_query) ? e.detail.search_query : new URLSearchParams(window.location.search).get('q');
            if (!query) return;

            // funzione per estrarre i dati dei post
            const tryScrape = () => {

                // crechiamo i post (risultati delle ricerche), che Reddit avvolge nel tag <shreddit-post>
                const posts = document.querySelectorAll('shreddit-post');

                // se abbiamo trovato almeno un post significa che i risultati sono stati renderizzati. 
                if (posts.length > 0) {

                    // estraiamo i dati del post
                    const extractedResults = [];
                    posts.forEach((post, index) => {
                        extractedResults.push({
                            position: index + 1,
                            title: post.getAttribute('post-title') || '',
                            url: post.getAttribute('permalink') || '',
                            subreddit: post.getAttribute('subreddit-prefixed-name') || ''
                        });
                    });

                    // inviamo la telemetria al backend
                    apiManager.addEventToQueue("telemetry.events.SearchResultsScrapedEvent", {
                        search_query: query,
                        extracted_count: extractedResults.length,
                        scraped_posts: extractedResults
                    });

                    // estrazione avvenuto con successo
                    Log.adapter(`Telemetria: Estratti e messi in coda ${extractedResults.length} post per "${query}".`);
                    return true; 
                }
                return false; // Nessun post trovato
            };

            // --- 2. TENTATIVO IMMEDIATO (Contro la Race Condition) ---
            if (tryScrape()) {
                return; // se ha già trovato i post, abbiamo finito! Niente observer.
            }

            // se react non ha ancora renderizzato i risultati, ci mettiamo in ascolto dei cambiamenti del DOM con un MutationObserver. 
            // appena troviamo i post, estraiamo e stacchiamo l'observer.
            let observerActive = true;
            const observer = new MutationObserver((mutations, obs) => {
                // ad ogni mutazione del DOM, proviamo a estrarre. Se ha successo, stacchiamo.
                if (tryScrape()) {
                    obs.disconnect(); 
                    observerActive = false;
                }
            });

            // inizia a osservare l'intero body in attesa dei cambiamenti di React
            observer.observe(document.body, { childList: true, subtree: true });

            // FALLBACK: se la ricerca non produce risultati, uccidiamo l'observer dopo 10 secondi
            setTimeout(() => {
                if (observerActive) {
                    observer.disconnect();
                    Log.error("Telemetry", `Timeout Scraping per "${query}": Nessun risultato.`);
                }
            }, 10000);
            
        });
    }
};
Log.telemetry_registry("Observer caricato: SearchResultsScrapedEvent");