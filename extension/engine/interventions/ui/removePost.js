/**
 * Intervento: Remove Post (Multi-Target + MutationObserver)
 */

window.removePost = function(payload, eventData) {
    Log.intervention("Avvio rimozione post (Multi-Target)...");

    // Normalizziamo gli input in array, anche se nel JSON fosse presente un valore singolo
    const keywords = Array.isArray(payload.target_keywords) 
        ? payload.target_keywords.map(k => k.toLowerCase()) 
        : (payload.target_keywords ? [payload.target_keywords.toLowerCase()] : []);

    const positions = Array.isArray(payload.target_positions) 
        ? payload.target_positions.map(Number) 
        : (payload.target_position ? [Number(payload.target_position)] : []);

    if (keywords.length === 0 && positions.length === 0) {
        Log.error("Intervention", "Nessun target specificato per removePost.");
        return;
    }

    const processPosts = () => {
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        
        allTitles.forEach((titleLink, index) => {
            const currentPos = index + 1;
            const text = titleLink.innerText.toLowerCase();

            // Controllo se la posizione è nella lista o se una delle keyword è presente
            const isPosTarget = positions.includes(currentPos);
            const isKeywordTarget = keywords.some(k => text.includes(k));

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

Log.intervention("Intervento caricato: removePost");