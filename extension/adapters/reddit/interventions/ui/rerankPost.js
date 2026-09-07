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
class ReRankPostIntervention extends BasePostIntervention {
    
    constructor() {
        super();
        this.pendingReranks = [];
    }

    // override del metodo execute di BasePostIntervention per aggiungere la logica di "ghost scroll" se necessario
    execute(payload, eventData) {
        
        // lanciamo la logica standard della superclasse per attivare Observer e il processPosts
        const isRunning = super.execute(payload, eventData);
        if (!isRunning) return false;

        // estraiamo la query di ricerca ed il payload filtrato per ottenere le regole di reranking da usare
        const initialQuery = (eventData && eventData.search_query) ? eventData.search_query : (new URLSearchParams(window.location.search).get('q') || "");
        const activePayloads = this._getAllMatchingPayloads(initialQuery, payload, "data");
        
        // cerchiamo qual è il post più "profondo" che dobbiamo pescare e portare in alto
        let maxTargetNeeded = 0;
        activePayloads.forEach(p => {
            if (p.moves) {
                p.moves.forEach(m => {
                    if (m.new_position < m.target && m.target > maxTargetNeeded) {
                        maxTargetNeeded = m.target;
                    }
                });
            }
        });

        // se dobbiamo recuperare un post molto in basso => simuliamo lo scrolling
        if (maxTargetNeeded > 0) { PlatformAdapter.forceGhostScroll(maxTargetNeeded); }
        return true;
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
        const postData = PlatformAdapter.extractPostData(wrapper, titleLink);

        // estraiamo i post attualmente presenti nel DOM
        const loadedPostsCount = PlatformAdapter.getRealPosts().length;

        // SE la nuova posizione NON esiste ancora => mettiamo il post in coda
        if (targetNewPosition > loadedPostsCount) { 
            return this.addPostToPendingQueue(wrapper, originalPos, targetNewPosition, initialQuery, postData.title, postData.subreddit, postData.url); 
        }

        // Altrimenti, se la posizione esiste gia => applichiamo il reranking vero e proprio
        const success = PlatformAdapter.movePost(wrapper, targetNewPosition);

        // inviamo la telemetria al backend
        if (success) {
            this.sendPostToBackend("RERANKED", initialQuery, originalPos, postData.title, postData.subreddit, postData.url, targetNewPosition);
            Log.intervention(`Post spostato fisicamente! (Pos Originale: ${originalPos} -> Nuova Pos: ${targetNewPosition})`);        
        }
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

    // viene chiamato in automatico dalla classe madre ogni volta che l'utente scrolla (per sbloccare la coda)
    checkPendingActions() {
        
        // se la sala d'attesa è vuota, non facciamo nulla
        if (this.pendingReranks.length === 0) return;

        const loadedPostsCount = PlatformAdapter.getRealPosts().length;

        // filtriamo la sala d'attesa applicando il rerank ai post che hanno raggiunto la loro nuova posizione
        this.pendingReranks = this.pendingReranks.filter(pending => {
            
            // se la nuova posizione è stata caricata => facciamo riapparire il post e applichiamo il reranking delegando all'Adapter
            if (loadedPostsCount >= pending.targetNewPosition) {
                pending.wrapper.style.display = ''; 
                const success = PlatformAdapter.movePost(pending.wrapper, pending.targetNewPosition);
                if (success) { this.sendPostToBackend("RERANKED_DELAYED", pending.initialQuery, pending.originalPos, pending.originalTitle, pending.originalSubreddit, pending.originalUrl, pending.targetNewPosition); }
                return false; // rimuove dalla coda
            }
            return true; // mantiene in coda
        });
    }
}

new ReRankPostIntervention();