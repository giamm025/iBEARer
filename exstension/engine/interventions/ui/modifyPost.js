
window.modifyPost = function(payload, eventData) {

    // estriamo posizione/keywords dal config.json
    const keywords =  payload.target_keywords ? payload.target_keywords.map(k => k.toLowerCase()) : [];
    const positions = payload.target_positions ? payload.target_positions.map(Number) : [];

    // se non è specificata nessuna keyword o posizione, non facciamo nulla
    if (keywords.length === 0 && positions.length === 0) {
        Log.error("Intervention", "Nessun target specificato per modifyPost.");
        return;
    }   

    // salviamo la query di ricerca iniziale per sapere quando l'utente cambia pagina (per fermare l'observer)
    // (senza di questo prima succedeva che l'intervento rimaneva applicato ai container dei post anche per 
    // ricerche che non centravano nulla)
    const initialQuery = new URLSearchParams(window.location.search).get('q');

    // funzione che processa i post visibili e modifica quelli che corrispondono ai target
    const processModifications = () => {

        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        const currentQuery = new URLSearchParams(window.location.search).get('q');
        if (currentQuery !== initialQuery) return;

        // prendiamo tutti i titoli dei post
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        
        // iteriamo su tutti i titoli per verificare se corrispondono a keyword o posizione
        allTitles.forEach((titleLink, index) => {

            // estriamo posizione e testo del post
            const currentPos = index + 1;
            const text = titleLink.innerText.toLowerCase();

            // controlliamo se la posizione è nella lista o se il testo contiene una delle keyword
            const isPosTarget = positions.includes(currentPos);
            const isKeywordTarget = keywords.some(k => text.includes(k));

            // se è vera almeno una delle due condizioni, modifichiamo il post
            if (isPosTarget || isKeywordTarget) {
                const mainFeedContainer = titleLink.closest('main#main-content > div') || titleLink.closest('div.bg-neutral-background');
                if (mainFeedContainer) {
                    let wrapper = titleLink;
                    while (wrapper.parentElement && wrapper.parentElement !== mainFeedContainer) {
                        wrapper = wrapper.parentElement;
                    }

                    if (wrapper && !wrapper.dataset.bearModified) {
                        sendModifiedPostToBackend(wrapper, titleLink, currentPos, initialQuery);
                        const innerBox = wrapper.querySelector('div[data-testid="search-post-with-content-preview"]') || wrapper.querySelector('div[data-testid="search-post-unit"]') || wrapper.firstElementChild;
                        if (innerBox) {
                            innerBox.style.backgroundColor = payload.highlight_color || "rgba(244, 67, 54, 0.05)";
                            innerBox.style.borderLeft = `4px solid ${payload.border_color || "#F44336"}`;
                        }


                        // modifichiamo il post
                        window.formatPost(wrapper, payload.title, payload.subreddit, payload.subreddit_icon_url, payload.content_text, payload.image_url, payload.target_url, payload.date, payload.votes, payload.comments);
                        wrapper.dataset.bearModified = "true";
                        Log.intervention(`Post modificato! (Pos: ${currentPos})`);
                    }
                }
            }
        });
    };

    // controlliamo se ce un observer attivo e, prima di creare uno nuovo (es. una nuova ricerca), disattiviamo quello vecchio
    if (window._bearModifyPostObserver) {
        window._bearModifyPostObserver.disconnect();
    }

    processModifications();

    const observer = new MutationObserver((mutations) => {

        const currentQuery = new URLSearchParams(window.location.search).get('q');
        if (currentQuery !== initialQuery) {
            observer.disconnect();
            return;
        }

        if (mutations.some(m => m.addedNodes.length > 0)) {
            processModifications();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window._bearModifyPostObserver = observer;
};

Log.intervention_registry("Intervento caricato: modifyPost");

function sendModifiedPostToBackend(wrapper, titleLink, currentPos, initialQuery) {

    // --- 1. ESTRAZIONE DATI ORIGINALI ---
    const originalTitle = titleLink.innerText.trim();
    const originalUrl = titleLink.href;
    const subLink = wrapper.querySelector('a[href*="/r/"]');
    const validSubLink = Array.from(wrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
    const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

    // --- 2. INVIO AL BACKEND ---
    ApiManager.addEventToQueue("telemetry.events.PostAlteredEvent", {
        action_type: "MODIFIED",
        search_query: initialQuery,
        target_position: currentPos,
        original_title: originalTitle,
        original_subreddit: originalSubreddit,
        original_url: originalUrl
    });
}