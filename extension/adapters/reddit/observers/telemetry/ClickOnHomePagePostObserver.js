// Questo observer si occupa di tracciare (esclusivamente) i click sui post della Home Page
class ClickOnHomePagePostObserver extends BaseObserver {

    constructor() {
        super();
        this.isHomePage = false;
    }
        
    start() {
        // eseguiamo un primo check all'avvio per impostare la variabile isHomePage
        this.isActive = true;
        this.check();

        this.attachListener(document, 'click', (e) => {
            
            // prendiamo l'intero percorso fatto dal click
            const path = e.composedPath();
            
            // estraiamo il tag <a> all'interno del percorso
            const linkTarget = path.find(el => el.tagName === 'A');
            if (linkTarget && linkTarget.href) {

                // se siamo in home ed è un post => estriamo il titolo e lanciamo l'evento
                const isPost = PlatformAdapter.isPostUrl(linkTarget.href);
                if (this.isHomePage && isPost) {
                    const postTitle = PlatformAdapter.extractPostTitleFromClick(path, linkTarget);

                    // aggiungiamo la telemetria in coda
                    this.addEventToQueue("telemetry.events.ClickOnHomePagePostEvent", {
                        url_destinazione: linkTarget.href,
                        testo_link: postTitle
                    });
                }
            }
        }, true);
    }

    // metodo chiamato ad ogni cambio URL
    check() {
        if (!this.isActive) return;
        this.isHomePage = PlatformAdapter.isHomePage();
    }
}

window.ClickOnHomePagePost = new ClickOnHomePagePostObserver();