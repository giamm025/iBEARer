window.ClickOnLink = {
    
    // metodo per far partire l'osservazione. Serve un riferimento ad ApiManager per poter fare direttamente
    // la chiamata ad addEventToQueue (altrimenti dovremmo ritornare l'evento all'engine e poi chiama lui 
    // l'ApiManager ma mi sembra una complicazione inutile, idk)
    start(apiManager) {
        
        document.addEventListener('click', (e) => {
            
            // questo observer deve solamente controlliamo se l'elemento cliccato (o un suo parente) è un tag <a>
            const linkTarget = e.target.closest('a');
            if (linkTarget && linkTarget.href) {
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