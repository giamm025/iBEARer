
window.removePost = function(payload, eventData) {
    Log.intervention("Avvio rimozione post (Multi-Target)...");

    // estriamo posizione/keywords dal config.json
    const keywords = payload.target_keywords.map(k => k.toLowerCase());
    const positions = payload.target_positions.map(Number);

    // se non è specificata nessuna keyword o posizione, non facciamo nulla
    if (keywords.length === 0 && positions.length === 0) {
        Log.error("Intervention", "Nessun target specificato per removePost.");
        return;
    }

    // funzione che processa i post visibili e nasconde quelli che corrispondono ai target
    const processPosts = () => {

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

            // se è vera almeno una delle due condizioni, nascondiamo il post
            if (isPosTarget || isKeywordTarget) {

                const mainFeedContainer = titleLink.closest('main#main-content > div') || titleLink.closest('div.bg-neutral-background');
                if (mainFeedContainer) {
                    let wrapper = titleLink;
                    while (wrapper.parentElement && wrapper.parentElement !== mainFeedContainer) {
                        wrapper = wrapper.parentElement;
                    }

                    if (wrapper && !wrapper.dataset.bearRemoved) {
                        wrapper.style.display = 'none';
                        wrapper.dataset.bearRemoved = "true";
                        
                        const nextSibling = wrapper.nextElementSibling;
                        if (nextSibling && nextSibling.tagName === 'HR') {
                            nextSibling.style.display = 'none';
                        }
                        
                        Log.intervention(`Post rimosso! (Pos: ${currentPos}, Match: ${isKeywordTarget ? 'Keyword' : 'Posizione'})`);
                    }
                }
            }
        });
    };

    processPosts();

    const observer = new MutationObserver((mutations) => {
        if (mutations.some(m => m.addedNodes.length > 0)) {
            processPosts();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window._bearRemovePostObserver = observer;
};

Log.intervention_registry("Intervento caricato: removePost");