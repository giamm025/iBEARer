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
class ModifyPostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super();
    }

    // implementa l'azione specifica di MODFIDICA post
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        if (!wrapper.dataset.bearModified) {
            
            // prendiamo i dati originali
            const originalTitle = titleLink.innerText.trim();
            const originalUrl = titleLink.href;
            const validSubLink = Array.from(wrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
            const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

            // inviamo i dati originali del post al backend
            this.sendPostToBackend("MODIFIED", initialQuery, currentPos, originalTitle, originalSubreddit, originalUrl);
            
            // applichiamo il colore di evidenziazione (se specificato)
            const innerBox = wrapper.querySelector('div[data-testid="search-post-with-content-preview"]') || wrapper.querySelector('div[data-testid="search-post-unit"]') || wrapper.firstElementChild;
            if (innerBox) {
                if (payload.highlight_color) innerBox.style.backgroundColor = payload.highlight_color;
                if (payload.border_color) innerBox.style.borderLeft = `4px solid ${payload.border_color}`;
            }

            // 4. Modifica dati 
            this.formatPost(wrapper, payload.title, payload.subreddit, payload.subreddit_icon_url, payload.content_text, payload.image_url, payload.target_url, payload.date, payload.votes, payload.comments);
            wrapper.dataset.bearModified = "true";
            Log.intervention(`Post modificato! (Pos: ${currentPos})`);
        }
    }
}

new ModifyPostIntervention();