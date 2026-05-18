// Questo observer si occupa di tracciare (esclusivamente) i click sui post della Home Page
class ClickOnHomePagePostObserver extends BaseObserver {

    constructor() {
        super("ClickOnHomePagePost");
        this.isHomePage = false;
    }
        
    start() {

        this.isActive = true;
        
        // eseguiamo un primo check all'avvio per impostare la variabile isHomePage
        this.check();

        this.attachListener(document, 'click', (e) => {
            
            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {
                
                // se ha commenti => è un post
                const isPost = linkTarget.href.includes('/comments/');

                // se siamo in home ed è un post, lanciamo l'evento
                if (this.isHomePage && isPost) {
                    this.addEventToQueue("telemetry.events.ClickOnHomePagePostEvent", {
                        url_destinazione: linkTarget.href,
                        testo_link: linkTarget.innerText.trim()
                    });
                }
            }
        });
    }

    // metodo chiamato ad ogni cambio URL
    check() {
        if (!this.isActive) return;
        this.isHomePage = window.location.pathname === '/';
    }
};

window.ClickOnHomePagePost = new ClickOnHomePagePostObserver();
Log.telemetry_registry("Observer caricato: ClickOnHomePagePostEvent");