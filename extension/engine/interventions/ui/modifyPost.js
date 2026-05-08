class ModifyPostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super("modifyPost");
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
            
            // DEBUG: evidenziamo il post modificato con un bordo rosso (o con i colori specificati nel payload)
            const innerBox = wrapper.querySelector('div[data-testid="search-post-with-content-preview"]') || wrapper.querySelector('div[data-testid="search-post-unit"]') || wrapper.firstElementChild;
            if (innerBox) {
                innerBox.style.backgroundColor = payload.highlight_color || "rgba(244, 67, 54, 0.05)";
                innerBox.style.borderLeft = `4px solid ${payload.border_color || "#F44336"}`;
            }

            // 4. Modifica dati 
            this.formatPost(wrapper, payload.title, payload.subreddit, payload.subreddit_icon_url, payload.content_text, payload.image_url, payload.target_url, payload.date, payload.votes, payload.comments);
            wrapper.dataset.bearModified = "true";
            Log.intervention(`Post modificato! (Pos: ${currentPos})`);
        }
    }
}

new ModifyPostIntervention();