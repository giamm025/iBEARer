class ReRankPostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super("rerankPost");
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

        // applichiamo il reranking vero e proprio
        const success = this.rerank(wrapper, currentPos, targetNewPosition);

        // inviamo la telemetria al backend
        if (success) {
            this.sendPostToBackend("RERANKED", initialQuery, currentPos, originalTitle, originalSubreddit, originalUrl, targetNewPosition);
            Log.intervention(`Post spostato fisicamente! (Pos Originale: ${currentPos} -> Nuova Pos: ${targetNewPosition})`);        
        }
    }

    // funzione che sposta fisicamente il post nel DOM alla nuova posizione
    rerank(targetWrapper, currentPos, newPos) {
        
        // estraiamo tutti i titoli presenti nel DOM (escludendo i nostri fake post)
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        const realTitles = Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));

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
}

new ReRankPostIntervention();