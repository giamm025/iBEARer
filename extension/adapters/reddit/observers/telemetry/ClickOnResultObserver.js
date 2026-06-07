// Questo observer si occupa di tracciare (esclusivamente) i click sui risultati di ricerca 

class ClickOnResultObserver extends BaseObserver {

    constructor() {
        super();
        this.isSearchPage = false;
        this.searchQuery = null;
    }
        
    start() {

        this.isActive = true;
        
        // eseguiamo un primo check all'avvio per impostare la variabile isSearchPage e searhQuery
        this.check();

        this.attachListener(document, 'click', (e) => {
            
            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {
                
                // se ha commenti => è un post
                const isPost = linkTarget.href.includes('/comments/');

                // chiaamente se entrambe le condizioni sono vere, è un ClickOnResult
                if (this.isSearchPage && isPost) {
                    this.addEventToQueue("telemetry.events.ClickOnResultEvent", {
                        search_query: this.searchQuery,
                        url_destinazione: linkTarget.href,
                        testo_link: linkTarget.innerText.trim()
                    });
                }
            }
        });
    }

    // metodo chiamato ad ogni cambio URL: nel nostro caso dobbiamo solo aggiornare sapere se ci troviamo in una 
    // pagina di ricerca oppure no (se siamo in una pagina di ricerca dobbiamo ignorare i click sui post)
    check() {
        if (!this.isActive) return;
        const urlParams = new URLSearchParams(window.location.search);
        this.isSearchPage = window.location.pathname.includes('/search') && urlParams.has('q');
        this.searchQuery = this.isSearchPage ? urlParams.get('q') : null;
    }
};

window.ClickOnResult = new ClickOnResultObserver();