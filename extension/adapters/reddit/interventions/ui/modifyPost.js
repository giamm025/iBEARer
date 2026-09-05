/**
 * @typedef {Object} ModifyPostPayload
 * @property {number[]} [target_positions] - Array delle posizioni originali da modificare.
 * @property {string[]} [target_keywords] - Array di parole chiave per matchare i post.
 * @property {string} [highlight_color] - Colore di sfondo dell'intero post (es. "#ffebee").
 * @property {string} [border_color] - Colore del bordo sinistro (es. "#d32f2f").
 * @property {string} [title] - Sovrascrive il titolo originale.
 * @property {string} [subreddit] - Sovrascrive il nome del subreddit.
 * @property {string} [subreddit_icon_url] - Sovrascrive l'icona del subreddit.
 * @property {string} [content_text] - Inserisce o sovrascrive un blocco di testo sotto il titolo.
 * @property {string} [image_url] - Sostituisce o inserisce un'immagine di anteprima.
 * @property {string} [target_url] - Cambia il link di destinazione del click.
 * @property {string} [date] - Sovrascrive la data di pubblicazione (es. "2 ore fa").
 * @property {string} [votes] - Sovrascrive il contatore dei voti.
 * @property {string} [comments] - Sovrascrive il contatore dei commenti.
 */
class ModifyPostIntervention extends BasePostIntervention {
    
    constructor() {
        super();
    }

    // implementa l'azione specifica di MODFIDICA post  
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        if (!wrapper.dataset.bearModified) {
            
            // prendiamo i dati ORIGINALI del post prima di qualsiasi modifica, per la telemetria
            const postData = PlatformAdapter.extractPostData(wrapper, titleLink);

            // inviamo i dati originali del post al backend
            this.sendPostToBackend("MODIFIED", initialQuery, currentPos, postData.title, postData.subreddit, postData.url);
            
            // applichiamo eventuali bordi (se specificati nel payload)
            if (payload.highlight_color) PlatformAdapter.applyHighlightToPost(wrapper, payload.highlight_color);
            if (payload.border_color)    PlatformAdapter.applyBorderToPost(wrapper, payload.border_color);

            // modifica effettiva del post
            PlatformAdapter.formatPost(wrapper, payload);
            
            // segnaliamo che il post è stato modificato per evitare modifiche multiple
            wrapper.dataset.bearModified = "true";
            Log.intervention(`Post modificato! (Pos: ${currentPos})`);
        }
    }
}

new ModifyPostIntervention();