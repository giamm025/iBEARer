// Questo observer si occupa di tracciare (esclusivamente) i click sui post della Home Page
class ClickOnHomePagePostObserver extends BaseObserver {

    constructor() {
        super();
        this.isHomePage = false;
    }
        
    start() {

        this.isActive = true;
        
        // eseguiamo un primo check all'avvio per impostare la variabile isHomePage
        this.check();

        this.attachListener(document, 'click', (e) => {
            
            // prendiamo l'intero percorso fatto dal click
            const path = e.composedPath();
            
            // estraiamo il tag <a> all'interno del percorso
            const linkTarget = path.find(el => el.tagName === 'A');
            if (linkTarget && linkTarget.href) {
                
                // se siamo in home ed è un post => estriamo il titolo e lanciamo l'evento
                const isPost = linkTarget.href.includes('/comments/');
                if (this.isHomePage && isPost) {
                    
                    // prendiamo il post ed estraiamo il titolo
                    const shredditPost = path.find(el => el.tagName === 'SHREDDIT-POST');
                    const realTitle = shredditPost 
                        ? shredditPost.getAttribute('post-title') 
                        : linkTarget.innerText.trim();

                    // aggiungiamo la telemetria in coda
                    this.addEventToQueue("telemetry.events.ClickOnHomePagePostEvent", {
                        url_destinazione: linkTarget.href,
                        testo_link: realTitle
                    });
                }
            }
        }, true);
    }

    // metodo chiamato ad ogni cambio URL
    check() {
        if (!this.isActive) return;
        this.isHomePage = window.location.pathname === '/';
    }
};

window.ClickOnHomePagePost = new ClickOnHomePagePostObserver();