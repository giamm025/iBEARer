// Questo observer si occupa di tracciare (esclusivamente) i click sui risultati di ricerca 

window.ClickOnResult = {
    
    start(apiManager) {

        document.addEventListener('click', (e) => {
            
            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {
                
                // controlliamo che ci troviamo su una pagine di ricerca (se non lo siamo, non ci risultati su cui cliccare...)
                const urlParams = new URLSearchParams(window.location.search);
                const isSearchPage = window.location.pathname.includes('/search') && urlParams.has('q');
                
                // per ora continuiamo ad usare la logica del 'se ha commenti => è un post'
                const isPost = linkTarget.href.includes('/comments/');

                // chiaamente se entrambe le condizioni sono vere, è un ClickOnResult
                if (isSearchPage && isPost) {
                    // estraiamo la query di ricerca giusto per mandarla al backend
                    const query = urlParams.get('q');
                    apiManager.addEventToQueue("telemetry.events.ClickOnResultEvent", {
                        search_query: query,
                        url_destinazione: linkTarget.href,
                        testo_link: linkTarget.innerText.trim()
                    });
                }
            }
        });
    }
};

Log.telemetry_registry("Observer caricato: ClickOnResultEvent");