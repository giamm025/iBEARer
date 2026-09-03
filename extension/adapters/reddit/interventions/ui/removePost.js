/**
 * @typedef {Object} RemovePostPayload
 * @property {number[]} [target_positions] - Array delle posizioni originali (1-based) da rimuovere.
 * @property {string[]} [target_keywords] - Array di parole chiave: se il post le contiene, viene rimosso.
 */
class RemovePostIntervention extends BasePostIntervention {

    constructor() {
        super();
    }

    /** implementa l'azione specifica di RIMOZIONE post */
    applyAction(post, originalPosition, initialQuery, payload, isKeywordTarget) {

        // leggiamo i dati originali PRIMA di nascondere il post, per la telemetria
        const originalTitle = this.platform.getPostTitle(post);
        const originalUrl = this.platform.getPostUrl(post);
        const originalCommunity = this.platform.getPostCommunity(post);

        // inviamo i dati originali del post al backend
        this.sendPostToBackend("REMOVED", initialQuery, originalPosition, originalTitle, originalCommunity, originalUrl);

        // nascondiamo il post          
        this.platform.hidePost(post);

        Log.intervention(`Post rimosso! (Pos: ${originalPosition}, Match: ${isKeywordTarget ? 'Keyword' : 'Posizione'})`);
    }
}

new RemovePostIntervention();