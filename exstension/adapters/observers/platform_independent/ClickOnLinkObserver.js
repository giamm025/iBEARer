// Questo observer deve solamente controlliamo se l'elemento cliccato (o un suo parente) è un tag <a>
// EDIT: siccome abbiamo di separare il tracciamento dei link generici dai risultati di ricerca dobbiamo
// aggiungere un controllo tipo 'se è un rislutato di ricerca => ignoralo'

window.ClickOnLink = {
    
    // metodo per far partire l'osservazione. Serve un riferimento ad ApiManager per poter fare direttamente
    // la chiamata ad addEventToQueue (altrimenti dovremmo ritornare l'evento all'engine e poi chiama lui 
    // l'ApiManager ma mi sembra una complicazione inutile, idk)
    start(apiManager) {

        document.addEventListener('click', (e) => {
            
            // estraiamo il link cliccato
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {

                // similmente a quanto fatto in ClickOnResultObserver.js controlliamo:
                // se ci troviamo in una pagina di ricerca & il link ha i commenti => è un risultato di ricerca => ignoralo
                const urlParams = new URLSearchParams(window.location.search);
                const isSearchPage = window.location.pathname.includes('/search') && urlParams.has('q');
                const isPost = linkTarget.href.includes('/comments/');
                if (isSearchPage && isPost) { return; }

                // senon è un risultato di ricerca, è correttamente un ClickOnLink generico e lo mandiamo al backend
                apiManager.addEventToQueue("telemetry.events.ClickOnLinkEvent", {
                    url_destinazione: linkTarget.href,
                    testo_link: linkTarget.innerText.trim()
                    // trim serve a togliere spazi bianchi inutili all'inizio o alla fine del testo
                });
            }
        });
    }
};

Log.telemetry_registry("Observer caricato: ClickOnLinkEvent");