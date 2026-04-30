// funzione helper per disegnare/modificare il finto post nel DOM
window.formatPost = function (postNode, f_title, f_subreddit, f_avatar, f_content, f_image, f_link, f_date, f_votes, f_comments) {
    
    // A) Overlay che rende cliccabile l'area del titolo
    if (f_title || f_link) {
        const overlayLink = postNode.querySelector('a[data-testid="post-title"]');
        const visibleTitle = postNode.querySelector('a[data-testid="post-title-text"]');
        
        if (overlayLink) {
            if (f_link) overlayLink.href = f_link;
            if (f_title) {
                overlayLink.setAttribute('aria-label', f_title);
                overlayLink.innerHTML = `<faceplate-screen-reader-content>${f_title}</faceplate-screen-reader-content>`;
            }
        }
        
            // B) Il VERO Titolo Visibile
        if (visibleTitle) {
            if (f_link) visibleTitle.href = f_link;
            if (f_title) visibleTitle.innerText = f_title; 
        }
    }

    // C) Modifichiamo il Subreddit (Escludendo i link che vanno ai commenti!)
    if (f_subreddit) {
        const subLinks = Array.from(postNode.querySelectorAll('a[href*="/r/"]')).filter(a => !a.href.includes('/comments/'));
        subLinks.forEach(link => {
            if (f_link) link.href = "#"; // Rimuove il link al subreddit solo se stiamo dirottando l'utente
            const textSpan = link.querySelector('.truncate') || link;
            textSpan.innerText = f_subreddit;
        });
    }

    // D) Sostituiamo l'icona/avatar del subreddit
    if (f_avatar) {
        const avatarImg = postNode.querySelector('span[avatar] img') || postNode.querySelector('img[width="24"]');
        if (avatarImg) {
            avatarImg.src = f_avatar; 
            avatarImg.style.backgroundColor = "transparent"; 
        }
    }

    // E) Aggiungiamo data, numero commenti e numero voti
    if (f_date) {
        const timeContainer = postNode.querySelector('faceplate-timeago');
        if (timeContainer) {
            timeContainer.outerHTML = `<span>${f_date}</span>`; 
        }
    }

    if (f_votes || f_comments) {
        const counterRow = postNode.querySelector('div[data-testid="search-counter-row"]');
        if (counterRow) {
            // nel caso in cui non ci vengano passati voti/commenti, usiamo quelli del post originale
            const spans = counterRow.querySelectorAll('span');
            let originalVotes = spans.length > 0 ? spans[0].innerText : "0 voti";
            let originalComments = spans.length > 2 ? spans[2].innerText : "0 commenti";

            const finalVotes = f_votes ? f_votes : originalVotes;
            const finalComments = f_comments ? f_comments : originalComments;

            counterRow.innerHTML = `<span>${finalVotes} voti</span><span class="mx-2xs">·</span><span>${finalComments} commenti</span>`;
        }
    }

    // F) Inseriamo descrizione ed immagine del post
    if (f_content || f_image) {
        const textColumn = postNode.querySelector('div[data-testid="sdui-post-unit"]');
        const innerBox = postNode.querySelector('div[data-testid="search-post-with-content-preview"]') || postNode.querySelector('div[data-testid="search-post-unit"]') || postNode.firstElementChild;
        const counterRow = postNode.querySelector('div[data-testid="search-counter-row"]');
        
        if (textColumn) {
            const oldSnippet = textColumn.querySelector('search-telemetry-tracker[click-events="search/click/post"] a.text-14') || textColumn.lastElementChild;
            if (oldSnippet && oldSnippet !== counterRow) oldSnippet.remove();

            // TESTO (DESCRIZIONE)
            if (f_content) {
                const customTextBox = document.createElement("div");
                customTextBox.style.marginTop = "2px";
                customTextBox.style.marginBottom = "6px"; 
                customTextBox.style.fontSize = "14px";
                customTextBox.style.lineHeight = "1.4";
                customTextBox.style.color = "var(--color-neutral-content-strong)"; 
                
                const textParagraph = document.createElement("p");
                textParagraph.innerText = f_content;
                textParagraph.style.margin = "0"; 
                customTextBox.appendChild(textParagraph);

                if (counterRow && counterRow.parentElement) { 
                    counterRow.parentElement.insertBefore(customTextBox, counterRow); 
                } else { 
                    textColumn.appendChild(customTextBox); 
                }
            }
        }

        // IMMAGINE
        if (f_image && innerBox) {
            innerBox.style.alignItems = "flex-start";
            if (textColumn) textColumn.style.paddingRight = "16px";

            const imgWrapper = document.createElement("div");
            imgWrapper.style.flexShrink = "0"; 
            imgWrapper.style.marginLeft = "auto"; 

            const imgElement = document.createElement("img");
            imgElement.src = f_image;
            imgElement.style.width = "138px"; 
            imgElement.style.height = "103px"; 
            imgElement.style.objectFit = "cover"; 
            imgElement.style.borderRadius = "8px";
            imgElement.style.margin = "0"; 
            imgElement.style.marginTop = "4px"; 
            
            imgWrapper.appendChild(imgElement);
            innerBox.appendChild(imgWrapper);
        }
    }
};