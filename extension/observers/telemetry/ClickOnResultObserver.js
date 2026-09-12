class ClickOnResultObserver extends BaseObserver {

    constructor() {
        super();
        this.isSearchPage = false;
        this.searchQuery = null;
    }
        
    start() {
        // eseguiamo un primo check all'avvio per impostare la variabile isSearchPage e searhQuery
        this.isActive = true;
        this.check();

        this.attachListener(document, 'click', (e) => {
            
            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {
                const isPost = PlatformAdapter.isPostUrl(linkTarget.href);

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
        this.isSearchPage = PlatformAdapter.isSearchPage();
        this.searchQuery  = this.isSearchPage ? PlatformAdapter.getCurrentSearchQuery() : null;
    }
}

window.ClickOnResult = new ClickOnResultObserver();