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