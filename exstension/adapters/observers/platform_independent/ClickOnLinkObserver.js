// Questo observer deve solamente controlliamo se l'elemento cliccato (o un suo parente) è un tag <a>
// EDIT: siccome abbiamo di separare il tracciamento dei link generici dai risultati di ricerca dobbiamo
// aggiungere un controllo tipo 'se è un rislutato di ricerca => ignoralo'

class ClickOnLinkObserver extends BaseObserver {

    constructor() {
        super("ClickOnLink"); 
        this.isSearchPage = false;
    }
    
    // metodo per far partire l'osservazione. Serve un riferimento ad ApiManager per poter fare direttamente
    // la chiamata ad addEventToQueue (altrimenti dovremmo ritornare l'evento all'engine e poi chiama lui 
    // l'ApiManager ma mi sembra una complicazione inutile, idk)
    start() {

        this.isActive = true;

        // eseguiamo un primo check all'avvio per impostare la variabile isSearchPage
        this.check()

        this.attachListener(document, 'click', (e) => {
            
            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {

                // similmente a quanto fatto in ClickOnResultObserver.js controlliamo:
                // se ci troviamo in una pagina di ricerca & il link ha i commenti => è un risultato di ricerca => ignoralo
                const isPost = linkTarget.href.includes('/comments/');
                if (this.isSearchPage && isPost) { return; }

                // se non è un risultato di ricerca, è correttamente un ClickOnLink generico e lo mandiamo al backend
                this.addEventToQueue("telemetry.events.ClickOnLinkEvent", {
                    url_destinazione: linkTarget.href,
                    testo_link: linkTarget.innerText.trim()
                    // trim serve a togliere spazi bianchi inutili all'inizio o alla fine del testo
                });
            }
        });
    }

    // metodo chiamato ad ogni cambio URL: nel nostro caso dobbiamo solo aggiornare sapere se ci troviamo in una 
    // pagina di ricerca oppure no (se siamo in una pagina di ricerca dobbiamo ignorare i click sui post)
    check() {
        if (!this.isActive) return;
        const urlParams = new URLSearchParams(window.location.search);
        this.isSearchPage = window.location.pathname.includes('/search') && urlParams.has('q');
    }
};

window.ClickOnLink = new ClickOnLinkObserver();
Log.telemetry_registry("Observer caricato: ClickOnLinkEvent");