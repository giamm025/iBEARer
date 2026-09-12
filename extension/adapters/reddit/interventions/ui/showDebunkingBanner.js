/**
 * @typedef {Object} DebunkingBannerData
 * @property {string} message Testo principale del banner di debunking.
 * @property {string} link_url URL a cui punta il banner (es. sito OMS/NASA).
 * @property {string} link_text Testo del bottone/link (es. "Scopri di più").
 * @property {string} [bg_color] Colore di sfondo del banner (formato esadecimale, es. "#D32F2F").
 * 
 * * @typedef {Object} DynamicContentRule
 * @property {string[]} trigger_keywords Array di stringhe o RegEx per il matching.
 * @property {DebunkingBannerData} data I dati da applicare se c'è un match.
 * 
 * * @typedef {Object} ShowDebunkingBannerPayload
 * @property {DynamicContentRule[]} dynamic_content Lista delle regole dinamiche.
 * @property {DebunkingBannerData} [default_fallback] Dati di fallback se nessuna regola fa match.
 */
class ShowDebunkingBannerIntervention extends BaseIntervention {

    constructor() {
        super();
        this.dismissedQueries = new Set();
    }
     
    /**
     * @param {ShowDebunkingBannerPayload} payload 
     * @param {Object} eventData 
     */
    execute(payload, eventData) {

        // estraiamo la query di ricerca dall'URL (es. ?q=5g+conspiracy)
        const search_query = (eventData && eventData.search_query) ? eventData.search_query : PlatformAdapter.getCurrentSearchQuery();

        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        const activePayload = this.resolvePayload(search_query, payload);
        if (!activePayload) { return false; }

        // se ce gia un nostro banner nel DOM, non facciamo nulla.
        if (document.getElementById("bear-debunk-banner")) return true;

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

            // se il container in cui dobbiamo inserire il banner ancora NON esiste => non facciamo nulla, aspettiamo il prossimo MutationObserver
            if (!PlatformAdapter.isBannerTargetReady()) return;

            // creiamo un contenitore principale (div)
            const banner = document.createElement("div");
            banner.id = "bear-debunk-banner";
            
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
            PlatformAdapter.insertDebunkingBanner(banner);
        }

        injectBanner();

        // ---------------------------------------------- RE-INSERIMENTO BANNER ----------------------------------------------
        // aggiungiamo un MutationObserver che reiniettare il banner ogni volta che React ricarica il DOM (es. nuovo chunk di risultati)
        window._debunkBannerObserver = new MutationObserver(() => {
            
            // il banner deve riapparire solo se siamo ancora sulla pagina di ricerca con la stessa query 
            const isStillValidSearch = PlatformAdapter.isSameSearchPage(search_query);
            
            // se non siamo piu sulla pagina di ricerca iniziale (es. ha iniziato un'altra ricerca o è andato all'home page)
            if (!isStillValidSearch) {
                                
                // rimuoviamo il banner
                const existingBanner = document.getElementById("bear-debunk-banner");
                if (existingBanner) existingBanner.remove();
                
                // rimuoviamo l'observer
                window._debunkBannerObserver.disconnect();
                window._debunkBannerObserver = null;

                Log.intervention(`Banner per "${search_query}" rimosso causa cambio pagina.`);
                return;
            }

            // se siamo ancora sulla ricerca giusta e il banner non è stato chiuso volutamente
            // significa che React ci ha cancellato il banner, e allora lo rimettiamo
            if (!self.dismissedQueries.has(search_query) && !document.getElementById("bear-debunk-banner")) {
                injectBanner();
            }
        });
        
        window._debunkBannerObserver.observe(document.body, { childList: true, subtree: true });
        return true; 
    }
}

new ShowDebunkingBannerIntervention();