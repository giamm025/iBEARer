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

        // estraiamo la query di ricerca dall'URL (es. ?q=5g+conspiracy)
        const search_query = new URLSearchParams(window.location.search).get('q') || "";

        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        const activePayload = this.resolvePayload(search_query, payload);
        if (!activePayload) { return false; }

        // se ce gia un nostro banner nel DOM, non facciamo nulla.
        if (document.getElementById("reddit-debunk-banner")) return true;

        // se l'utente ha già chiuso il banner per questa ricerca, non lo riapriamo
        if (this.dismissedQueries.has(search_query)) return false;

        
        // in base al contesto mostriamo un messaggio di debunking specifico 
        const debunkingMessage = activePayload.message || "Attenzione: Contenuto non verificato.";
        const debunkingLink = activePayload.link_url || "#";
        const linkText = activePayload.link_text || "Scopri di più";
        const bgColor = activePayload.bg_color || "#D32F2F";

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
            banner.style.backgroundColor = bgColor;
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
            if(debunkingLink !== "#") linkAnchor.target = "_blank"; 
            linkAnchor.style.color = "#FFFFFF";
            linkAnchor.style.textDecoration = "underline";
            linkAnchor.style.marginLeft = "10px";
            linkAnchor.style.fontWeight = "bold";
            linkAnchor.innerText = linkText;

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
                self.dismissedQueries.add(search_query);
                banner.remove();
                Log.intervention("L'utente ha chiuso il banner di debunking.");
                ApiManager.addEventToQueue("adapters.events.BannerDismissed", { query: search_query });
            });

            // assembliamo inserendo i pezzi (figli) dentro il banner (padre)
            banner.append(textSpan, linkAnchor, closeBtn);
            
            // aggiungiamo il banner al DOM
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
            const isStillValidSearch = window.location.pathname.includes('/search') && currentQuery === search_query;

            // se non siamo piu sulla pagina di ricerca iniziale (es. ha iniziato un'altra ricerca o è andato all'home page)
            if (!isStillValidSearch) {
                                
                // rimuoviamo il banner
                const existingBanner = document.getElementById("reddit-debunk-banner");
                if (existingBanner) existingBanner.remove();
                
                // rimuoviamo l'observer
                window._debunkBannerObserver.disconnect();
                window._debunkBannerObserver = null;

                Log.intervention(`Banner per "${search_query}" rimosso causa cambio pagina.`);
                return;
            }

            // se siamo ancora sulla ricerca giusta e il banner non è stato chiuso volutamente
            // significa che React ci ha cancellato il banner, e allora lo rimettiamo
            if (!self.dismissedQueries.has(search_query) && !document.getElementById("reddit-debunk-banner")) {
                injectBanner();
            }
        });
        
        window._debunkBannerObserver.observe(document.body, { childList: true, subtree: true });
        return true; 
    }
}

new ShowDebunkingBannerIntervention();