
window.modifyPost = function(payload, eventData) {

    // estriamo posizione/keywords dal config.json
    const keywords =  payload.target_keywords.map(k => k.toLowerCase());
    const positions = payload.target_positions.map(Number);

    // se non è specificata nessuna keyword o posizione, non facciamo nulla
    if (keywords.length === 0 && positions.length === 0) {
        Log.error("Intervention", "Nessun target specificato per modifyPost.");
        return;
    }   

    // funzione che processa i post visibili e modifica quelli che corrispondono ai target
    const processModifications = () => {

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
                        const innerBox = wrapper.querySelector('div[data-testid="search-post-with-content-preview"]') || wrapper.querySelector('div[data-testid="search-post-unit"]') || wrapper.firstElementChild;
                        if (innerBox) {
                            innerBox.style.backgroundColor = payload.highlight_color || "rgba(244, 67, 54, 0.05)";
                            innerBox.style.borderLeft = `4px solid ${payload.border_color || "#F44336"}`;
                        }

                        // Applichiamo la formattazione usando la funzione helper globale
                        if (typeof window.formatPost === "function") {
                            window.formatPost(
                                wrapper, 
                                payload.title, 
                                payload.subreddit, 
                                payload.subreddit_icon_url, 
                                payload.content_text, 
                                payload.image_url, 
                                payload.target_url,
                                payload.date,
                                payload.votes,
                                payload.comments
                            );
                            wrapper.dataset.bearModified = "true";
                            Log.intervention(`Post modificato! (Pos: ${currentPos})`);
                        }
                    }
                }
            }
        });
    };

    processModifications();

    const observer = new MutationObserver((mutations) => {
        if (mutations.some(m => m.addedNodes.length > 0)) {
            processModifications();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window._bearModifyPostObserver = observer;
};

Log.intervention_registry("Intervento caricato: modifyPost");