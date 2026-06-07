/**
 * @typedef {Object} RerankMove
 * @property {number} target - Posizione originaria del post da spostare.
 * @property {number} new_position - Nuovo slot visivo di destinazione.
 * 
 * @typedef {Object} ReRankPostPayload
 * @property {number[]} [target_positions] - Le posizioni originali da intercettare.
 * @property {string[]} [target_keywords] - Le parole chiave per intercettare i post.
 * @property {number} [keyword_new_position] - Lo slot in cui buttare i post intercettati tramite keyword (zona quarantena).
 * @property {RerankMove[]} [moves] - Array di regole di spostamento per mappare l'origine posizionale alla destinazione.
 */
class ReRankPostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super();
        this.pendingReranks = [];
    }

    // implementa l'azione specifica di RE-RANKING post
    applyAction(wrapper, titleLink, originalPos, initialQuery, payload, isKeywordTarget) {
        
        let targetNewPosition = null;

        // estraiamo il campo "moves" che contiene tutte le regole di spostamento
        const moveRule = payload.moves ? payload.moves.find(m => m.target === originalPos) : null;
        if (moveRule) {
            targetNewPosition = moveRule.new_position;

        } else if (isKeywordTarget && payload.keyword_new_position) {
            targetNewPosition = payload.keyword_new_position;
        }

        if (!targetNewPosition || originalPos === targetNewPosition) return; 

        // estraiamo i dati del post originale per la telemetria
        const originalTitle = titleLink.innerText.trim();
        const originalUrl = titleLink.href;
        const validSubLink = Array.from(wrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
        const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

        // estraiamo i post attualmente presenti nel DOM
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        const realTitles = Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));

        // SE la nuova posizione NON esiste ancora => mettiamo il post in coda
        if (targetNewPosition > realTitles.length) { 
            return this.addPostToPendingQueue(wrapper, originalPos, targetNewPosition, initialQuery, originalTitle, originalSubreddit, originalUrl); 
        }

        // Altrimenti, se la posizione esiste gia => applichiamo il reranking vero e proprio
        const success = this.rerank(wrapper, targetNewPosition, realTitles);

        // inviamo la telemetria al backend
        if (success) {
            this.sendPostToBackend("RERANKED", initialQuery, originalPos, originalTitle, originalSubreddit, originalUrl, targetNewPosition);
            Log.intervention(`Post spostato fisicamente! (Pos Originale: ${originalPos} -> Nuova Pos: ${targetNewPosition})`);        
        }
    }

    // funzione che sposta fisicamente il post nel DOM alla nuova posizione
    rerank(targetWrapper, newPosSlot, realTitles) {

        // prendiamo il post che attualmente si trova in quella che sarà la nuova posizione
        const referencePostTitle = realTitles[newPosSlot - 1];
        if (referencePostTitle) {
            
            // prendiamo il wrapper del post da spostare
            const referenceWrapper = this._getSinglePostWrapper(referencePostTitle);
            if (referenceWrapper && referenceWrapper !== targetWrapper) { 

                // prendiamo il genitore comune di entrambi i post (mainFeedContainer)
                const mainFeedContainer = referenceWrapper.parentNode;

                // troviamo il titolo dentro il targetWrapper per capire la posizion esatta in cui si trova fisicamente il post ORA
                const targetTitle = targetWrapper.querySelector('a[data-testid="post-title"]');
                const currentPos = realTitles.indexOf(targetTitle);
                const newPos = newPosSlot - 1;
                if (currentPos === -1) return false;

                try {

                    // se stiamo spostando il nostro post in ALTO  (es. da 5 a 1) => inseriamo PRIMA del post di riferimento
                    // se stiamo spostando il nostro post in BASSO (es. da 1 a 5) => inseriamo DOPO   il post di riferimento
                    if (currentPos > newPos) { 
                        mainFeedContainer.insertBefore(targetWrapper, referenceWrapper); 
                    } else { 
                        mainFeedContainer.insertBefore(targetWrapper, referenceWrapper.nextSibling); 
                    }
                    return true;

                } catch (e) {
                    Log.error("Intervention", "Errore durante lo spostamento nel DOM", e);
                    return false;
                }
            }
        }
        return false;
    }

    // funzione che aggiunge un post in "coda di attesa" finché non viene caricata la sua nuova posizione
    addPostToPendingQueue(wrapper, originalPos, targetNewPosition, initialQuery, originalTitle, originalSubreddit, originalUrl) {
        
        Log.intervention(`Rerank rimandato per il post "${originalTitle}", in attesa della posizione:  ${targetNewPosition}`);
        
        // nascondiamo momentaneamente il post finche non arriva la sua posizione
        wrapper.style.display = 'none';
        Log.intervention(`Post nascosto in attesa dello slot ${targetNewPosition} (Origine: ${originalPos})`);
        
        // lo aggiungiamo in coda con tutti i suoi dati
        this.pendingReranks.push({
            wrapper, originalPos, targetNewPosition, initialQuery, 
            originalTitle, originalSubreddit, originalUrl
        });
    }

    // viene chiamato in automatico dalla classe madre ogni volta che l'utente scrolla
    checkPendingActions(realTitles) {
        
        // se la sala d'attesa è vuota, non facciamo nulla
        if (this.pendingReranks.length === 0) return;

        // filtriamo la sala d'attesa applicando il rerank ai post che hanno raggiunto la loro nuova posizione
        this.pendingReranks = this.pendingReranks.filter(pending => {
            
            // se la nuova posizione è stata caricata => facciamo riapparire il post e applichiamo il reranking
            if (realTitles.length >= pending.targetNewPosition) {
                pending.wrapper.style.display = ''; 
                const success = this.rerank(pending.wrapper, pending.targetNewPosition, realTitles);
                if (success) { this.sendPostToBackend("RERANKED_DELAYED", pending.initialQuery, pending.originalPos, pending.originalTitle, pending.originalSubreddit, pending.originalUrl, pending.targetNewPosition); }
                return false; // rimuove dalla coda
            }
            return true; // mantiene in coda
        });
    }
}

new ReRankPostIntervention();