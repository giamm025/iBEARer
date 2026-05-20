class ReRankPostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super("rerankPost");
        this.pendingReranks = [];
    }

    // implementa l'azione specifica di RE-RANKING post
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        
        // estraiamo la nuova posizione dal config.json
        const targetNewPosition = payload.new_position;
        if (!targetNewPosition || currentPos === targetNewPosition) return; 

        // estraiamo i dati del post originale per la telemetria
        const originalTitle = titleLink.innerText.trim();
        const originalUrl = titleLink.href;
        const validSubLink = Array.from(wrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
        const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

        // estraiamo i post attualmente presenti nel DOM
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        const realTitles = Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));

        // SE la nuova posizione NON esiste ancora => mettiamo il post in coda
        if (targetNewPosition > realTitles.length) { return this.addPostToPendingQueue(wrapper, currentPos, targetNewPosition, initialQuery, originalTitle, originalSubreddit, originalUrl); }

        // Altrimenti, se la posizione eisste gia => applichiamo il reranking vero e proprio
        const success = this.rerank(wrapper, currentPos, targetNewPosition, realTitles);

        // inviamo la telemetria al backend
        if (success) {
            this.sendPostToBackend("RERANKED", initialQuery, currentPos, originalTitle, originalSubreddit, originalUrl, targetNewPosition);
            Log.intervention(`Post spostato fisicamente! (Pos Originale: ${currentPos} -> Nuova Pos: ${targetNewPosition})`);        
        }
    }

    // funzione che sposta fisicamente il post nel DOM alla nuova posizione
    rerank(targetWrapper, currentPos, newPos, realTitles) {

        // prendiamo il post che attualmente si trova in quella che sarà la nuova posizione
        const referencePostTitle = realTitles[newPos - 1];
        if (referencePostTitle) {
            
            // prendiamo il wrapper del post da spostare
            const referenceWrapper = this._getSinglePostWrapper(referencePostTitle);
            if (referenceWrapper && referenceWrapper !== targetWrapper) { 

                // prendiamo il genitore comune di entrambi i post (mainFeedContainer)
                const mainFeedContainer = referenceWrapper.parentNode;
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


    addPostToPendingQueue(wrapper, currentPos, targetNewPosition, initialQuery, originalTitle, originalSubreddit, originalUrl) {

        Log.intervention(`Rerank rimandato per il post "${originalTitle}", in attesa della posizione:  ${targetNewPosition}`);
        
        // nascondiamo momentaneamente il post finche non arriva la sua posizione
        wrapper.style.display = 'none';
        Log.intervention(`Post nascosto in attesa che venga caricata la posizione ${targetNewPosition} (Post Originale: ${originalTitle})`);
        
        // lo aggiungiamo in coda con tutti i suoi dati
        this.pendingReranks.push({
            wrapper, currentPos, targetNewPosition, initialQuery, 
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
                const success = this.rerank(pending.wrapper, pending.currentPos, pending.targetNewPosition, realTitles);
                if (success) { this.sendPostToBackend("RERANKED_DELAYED", pending.initialQuery, pending.currentPos, pending.originalTitle, pending.originalSubreddit, pending.originalUrl, pending.targetNewPosition); }
                return false;
            }
            return true; 
        });
    }
}

new ReRankPostIntervention();