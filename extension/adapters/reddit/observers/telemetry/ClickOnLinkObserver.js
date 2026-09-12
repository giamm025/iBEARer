// Questo observer deve solamente controlliamo se l'elemento cliccato (o un suo parente) è un tag <a>
// EDIT: siccome abbiamo di separare il tracciamento dei link generici dai risultati di ricerca dobbiamo
// aggiungere un controllo tipo 'se è un rislutato di ricerca => ignoralo'

class ClickOnLinkObserver extends BaseObserver {

    constructor() {
        super(); 
        this.isSearchPage = false;
        this.isHomePage = false;
    }
    
    /** 
     * metodo per far partire l'osservazione. Serve un riferimento ad ApiManager per poter fare direttamente
     * la chiamata ad addEventToQueue (altrimenti dovremmo ritornare l'evento all'engine e poi chiama lui 
     * l'ApiManager ma mi sembra una complicazione inutile, idk)
     */
    start() {

        this.isActive = true;

        // eseguiamo un primo check all'avvio per impostare la variabile isSearchPage
        this.check();

        this.attachListener(document, 'click', (e) => {

            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {

                // similmente a quanto fatto in ClickOnResultObserver.js controlliamo:
                // se ci troviamo in una pagina di ricerca & il link ha i commenti => è un risultato di ricerca => ignoralo
                const isPost = PlatformAdapter.isPostUrl(linkTarget.href);
                if ((this.isSearchPage || this.isHomePage) && isPost) { return; }

                // se non è un risultato di ricerca, è correttamente un ClickOnLink generico e lo mandiamo al backend
                this.addEventToQueue("telemetry.events.ClickOnLinkEvent", {
                    url_destinazione: linkTarget.href,
                    testo_link: linkTarget.innerText.trim()
                    // (come in Visual Basic, evviva!) trim serve a togliere spazi bianchi inutili all'inizio o alla fine del testo
                });
            }
        });
    }

    check() {
        if (!this.isActive) return;
        this.isSearchPage = PlatformAdapter.isSearchPage();
        this.isHomePage = PlatformAdapter.isHomePage();
    }
}

window.ClickOnLink = new ClickOnLinkObserver();