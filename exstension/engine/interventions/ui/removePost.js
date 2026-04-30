/**
 * @typedef {Object} RemovePostPayload
 * @property {string[]} [target_keywords]
 * @property {number[]} [target_positions]
 */

class RemovePostIntervention extends BaseIntervention {
    
    constructor() {
        // Usa il FQN esatto che scriverai nel config.json
        super("removePost");
    }

    /**
     * @param {RemovePostPayload} payload 
     * @param {Object} eventData 
     */
    execute(payload, eventData) {
        Log.intervention("Avvio rimozione post (Multi-Target)...");

        // estriamo posizione/keywords dal config.json
        const keywords = payload.target_keywords ? payload.target_keywords.map(k => k.toLowerCase()) : [];
        const positions = payload.target_positions ? payload.target_positions.map(Number) : [];

        // se non è specificata nessuna keyword o posizione, non facciamo nulla
        if (keywords.length === 0 && positions.length === 0) {
            Log.error("Intervention", "Nessun target specificato per removePost.");
            return;
        }

        // salviamo la query di ricerca iniziale per sapere quando l'utente cambia pagina (per fermare l'observer)
        // (senza di questo prima succedeva che l'intervento rimaneva applicato ai container dei post anche per 
        // ricerche che non centravano nulla)
        const initialQuery = new URLSearchParams(window.location.search).get('q');

        // funzione che processa i post visibili e nasconde quelli che corrispondono ai target
        const processPosts = () => {

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

                // se è vera almeno una delle due condizioni, nascondiamo il post
                if (isPosTarget || isKeywordTarget) {

                    const mainFeedContainer = titleLink.closest('main#main-content > div') || titleLink.closest('div.bg-neutral-background');
                    if (mainFeedContainer) {
                        let wrapper = titleLink;
                        while (wrapper.parentElement && wrapper.parentElement !== mainFeedContainer) {
                            wrapper = wrapper.parentElement;
                        }

                        if (wrapper && !wrapper.dataset.bearRemoved) {
                            this.sendRemovedPostToBackend(wrapper, titleLink, currentPos, initialQuery);
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

        // controlliamo se ce un observer attivo e, prima di creare uno nuovo (es. una nuova ricerca), disattiviamo quello vecchio
        if (window._bearRemovePostObserver) {
            window._bearRemovePostObserver.disconnect();
        }

        processPosts();

        const observer = new MutationObserver((mutations) => {

            const currentQuery = new URLSearchParams(window.location.search).get('q');
            if (currentQuery !== initialQuery) {
                observer.disconnect();
                return;
            }

            if (mutations.some(m => m.addedNodes.length > 0)) {
                processPosts();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        window._bearRemovePostObserver = observer;
    }

    sendRemovedPostToBackend(wrapper, titleLink, currentPos, initialQuery) {

        // --- 1. ESTRAZIONE DATI ORIGINALI ---
        const originalTitle = titleLink.innerText.trim();
        const originalUrl = titleLink.href;
        const subLink = wrapper.querySelector('a[href*="/r/"]');
        const validSubLink = Array.from(wrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
        const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

        // --- 2. INVIO AL BACKEND ---
        this.sendPostToBackend("REMOVED", initialQuery, currentPos, originalTitle, originalSubreddit, originalUrl);
    }
}

new RemovePostIntervention();