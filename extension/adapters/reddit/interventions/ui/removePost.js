/**
 * @typedef {Object} RemovePostPayload
 * @property {number[]} [target_positions] - Array delle posizioni originali (1-based) da rimuovere.
 * @property {string[]} [target_keywords] - Array di parole chiave: se il post le contiene, viene rimosso.
 */
class RemovePostIntervention extends BasePostIntervention {
    
    constructor() {
        super();
    }

    // implementa l'azione specifica di RIMOZIONE post
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        if (!wrapper.dataset.bearRemoved) {
            
            // prendiamo i dati ORIGINALI del post prima di qualsiasi modifica, per la telemetria
            const postData = PlatformAdapter.extractPostData(wrapper, titleLink);

            // inviamo i dati originali del post al backend
            this.sendPostToBackend("REMOVED", initialQuery, currentPos, postData.title, postData.subreddit, postData.url);
            
            // deleghiamo la rimozione del post all'Adapter
            PlatformAdapter.hidePost(wrapper);
            wrapper.dataset.bearRemoved = "true";
            
            Log.intervention(`Post rimosso! (Pos: ${currentPos}, Match: ${isKeywordTarget ? 'Keyword' : 'Posizione'})`);
        }
    }
}

new RemovePostIntervention();