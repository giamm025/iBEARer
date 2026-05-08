/**
 * @typedef {Object} ShowDebunkingBannerPayload
 * @description Payload atteso per il banner. (Attualmente usi logica hardcoded, 
 * ma in futuro dovresti spostare messaggi e link nel JSON).
 */

class ShowDebunkingBannerIntervention extends BaseIntervention {

    constructor() {
        super("interventions.ui.showDebunkingBanner");
        this.dismissedQueries = new Set();
    }
    
    /**
     * @param {ShowDebunkingBannerPayload} payload 
     * @param {Object} eventData 
     */
    execute(payload, eventData) {
        // eventData contiene il CONTESTO di cui parlava il prof (in questo caso la query di ricerca)
        const searchedWord = eventData.search_query.toLowerCase();

        // se ce gia un nostro banner nel DOM, non facciamo nulla.
        if (document.getElementById("reddit-debunk-banner")) return true;

        // se l'utente ha già chiuso il banner per questa ricerca, non lo riapriamo
        if (this.dismissedQueries.has(searchedWord)) return false;

        
        // in base al contesto mostriamo un messaggio di debunking specifico 
        let debunkingMessage = "";
        let debunkingLink = "";
        if (searchedWord.includes("vaccini")) {
            debunkingMessage = "Attenzione: I vaccini sono sicuri ed efficaci secondo l'OMS.";
            debunkingLink = "https://www.who.int/news-room/questions-and-answers/item/vaccines-and-immunization-vaccine-safety";
        
        } else if (searchedWord.includes("5g")) {
            debunkingMessage = "Attenzione: Le reti 5G utilizzano onde radio non ionizzanti sicure.";
            debunkingLink = "https://www.europarl.europa.eu/RegData/etudes/STUD/2021/690012/EPRS_STU(2021)690012_EN.pdf";
        
        } else if (searchedWord.includes("terra piatta")) {
            debunkingMessage = "Attenzione: La forma sferica della Terra è un fatto scientifico provato.";
            debunkingLink = "https://www.nasa.gov/earth/how-do-we-know-the-earth-isnt-flat-we-asked-a-nasa-expert-episode-53/";
        }

        // pulizia di eventuali Observer precedenti
        if (window._debunkBannerObserver) { window._debunkBannerObserver.disconnect(); }

        // manteniamo una reference a 'this' per usarla dentro l'event listener
        const self = this;

        // ---------------------------------------------- CREAZIONE BANNER ----------------------------------------------
        function injectBanner() {
            // controlliamo che il container di reddit in cui inserire il banner sia gia stato caricato
            const redditContainer = document.querySelector("shreddit-app .grid-container");
            if (!redditContainer || !redditContainer.parentNode) return;

            // creiamo un contenitore principale (div)
            const banner = document.createElement("div");
            banner.id = "reddit-debunk-banner";
            
            // stili CSS applicati direttamente all'elemento
            banner.style.position = "sticky"; 
            banner.style.top = "60px";
            banner.style.width = "100%";
            banner.style.backgroundColor = "#D32F2F"; 
            banner.style.color = "#FFFFFF";
            banner.style.padding = "16px";
            banner.style.textAlign = "center";
            banner.style.fontFamily = "Arial, sans-serif";
            banner.style.fontSize = "16px";
            banner.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.3)";
            banner.style.marginBottom = "16px"; 
            banner.style.borderRadius = "8px";  
            banner.style.zIndex = "1";

            banner.style.height = "fit-content"; 
            banner.style.alignSelf = "start";    
            banner.style.boxSizing = "border-box"; 
            banner.style.lineHeight = "1.5";

            // creazione del testo del messaggio
            const textSpan = document.createElement("span");
            textSpan.style.fontWeight = "bold";
            textSpan.innerText = debunkingMessage + " ";

            // creazione del link cliccabile
            const linkAnchor = document.createElement("a");
            linkAnchor.href = debunkingLink;
            linkAnchor.target = "_blank"; 
            linkAnchor.style.color = "#FFFFFF";
            linkAnchor.style.textDecoration = "underline";
            linkAnchor.style.marginLeft = "10px";
            linkAnchor.style.fontWeight = "bold";
            linkAnchor.innerText = "Scopri di più";

            // creazione del pulsante di chiusura (X)
            const closeBtn = document.createElement("span");
            closeBtn.innerHTML = "&times;"; 
            closeBtn.style.position = "absolute";
            closeBtn.style.right = "20px";
            closeBtn.style.top = "12px";
            closeBtn.style.cursor = "pointer";
            closeBtn.style.fontSize = "24px";
            closeBtn.style.fontWeight = "bold";
            
            closeBtn.addEventListener("click", () => {
                self.dismissedQueries.add(searchedWord);
                banner.remove();
                Log.intervention("L'utente ha chiuso il banner di debunking.");
                ApiManager.addEventToQueue("adapters.events.BannerDismissed", { query: searchedWord });
            });

            // assembliamo inserendo i pezzi (figli) dentro il banner (padre)
            banner.append(textSpan, linkAnchor, closeBtn);

            // aggiungiamo il banner al documento
            redditContainer.parentNode.insertBefore(banner, redditContainer);
        }

        injectBanner();

        // ---------------------------------------------- RE-INSERIMENTO BANNER ----------------------------------------------
        // aggiungiamo un MutationObserver che reiniettare il banner ogni volta che React ricarica il DOM (es. nuovo chunk di risultati)
        window._debunkBannerObserver = new MutationObserver(() => {
            
            // estraiamo l'URL e la query di ricerca
            const urlParams = new URLSearchParams(window.location.search);
            const currentQuery = urlParams.get('q') ? urlParams.get('q').toLowerCase() : "";
            
            // il banner deve riapparire solo se siamo ancora sulla pagina di ricerca con la stessa query 
            const isStillValidSearch = window.location.pathname.includes('/search') && currentQuery === searchedWord;

            // se non siamo piu sulla pagina di ricerca iniziale (es. ha iniziato un'altra ricerca o è andato all'home page)
            if (!isStillValidSearch) {
                
                // rimuoviamo il banner
                const existingBanner = document.getElementById("reddit-debunk-banner");
                if (existingBanner) existingBanner.remove();
                
                // rimuoviamo l'observer
                window._debunkBannerObserver.disconnect();
                window._debunkBannerObserver = null;

                Log.intervention(`Banner per "${searchedWord}" rimosso causa cambio pagina.`);
                return;
            }

            // se siamo ancora sulla ricerca giusta e il banner non è stato chiuso volutamente
            // significa che React ci ha cancellato il banner, e allora lo rimettiamo
            if (!self.dismissedQueries.has(searchedWord) && !document.getElementById("reddit-debunk-banner")) {
                injectBanner();
            }
        });
        
        window._debunkBannerObserver.observe(document.body, { childList: true, subtree: true });
        return true; 
    }
}

new ShowDebunkingBannerIntervention();