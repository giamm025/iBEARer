/**
 * @typedef {Object} RemovePostPayload
 * @property {number[]} [target_positions] - Array delle posizioni originali (1-based) da rimuovere.
 * @property {string[]} [target_keywords] - Array di parole chiave: se il post le contiene, viene rimosso.
 */
class RemovePostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super();
    }

    // implementa l'azione specifica di RIMOZIONE post
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        if (!wrapper.dataset.bearRemoved) {
            
            // prendiamo i dati originali
            const rawTitle = titleLink.innerText || titleLink.getAttribute('aria-label') || titleLink.textContent || "";
            const originalTitle = rawTitle.replace(/\s+/g, ' ').trim() || "Sconosciuto";
            const originalUrl = titleLink.href;
            const validSubLink = Array.from(wrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
            const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

            // inviamo i dati originali del post al backend
            this.sendPostToBackend("REMOVED", initialQuery, currentPos, originalTitle, originalSubreddit, originalUrl);
            
            // nascondiamo il post (usando display:none)            
            wrapper.style.display = 'none';
            wrapper.dataset.bearRemoved = "true";
            
            // NB. Reddit inserisce un elemento <hr> dopo ogni post nei risultati di ricerca. 
            // se nascondiamo un post, dobbiamo nascondere anche l'hr sottostante per evitare brutti spazi vuoti nella UI.
            const nextSibling = wrapper.nextElementSibling;
            if (nextSibling && nextSibling.tagName === 'HR') {
                nextSibling.style.display = 'none';
            }
            
            Log.intervention(`Post rimosso! (Pos: ${currentPos}, Match: ${isKeywordTarget ? 'Keyword' : 'Posizione'})`);
        }
    }
}

new RemovePostIntervention();