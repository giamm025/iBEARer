// funzione helper per disegnare/modificare il finto post nel DOM
window.formatPost = function (fakePost, f_title, f_subreddit, f_avatar, f_content, f_image, f_link) {
    
    // A) Overlay che rende cliccabile l'area del titolo
    const overlayLink = fakePost.querySelector('a[data-testid="post-title"]');
    if (overlayLink) {
        overlayLink.href = f_link;
        overlayLink.setAttribute('aria-label', f_title);
        overlayLink.innerHTML = `<faceplate-screen-reader-content>${f_title}</faceplate-screen-reader-content>`;
    }

    // B) Il VERO Titolo Visibile
    const visibleTitle = fakePost.querySelector('a[data-testid="post-title-text"]');
    if (visibleTitle) {
        visibleTitle.href = f_link;
        visibleTitle.innerText = f_title; // Ora il titolo appare al posto giusto!
    }

    // C) Modifichiamo il Subreddit (Escludendo i link che vanno ai commenti!)
    const subLinks = Array.from(fakePost.querySelectorAll('a[href*="/r/"]')).filter(a => !a.href.includes('/comments/'));
    subLinks.forEach(link => {
        link.href = "#"; 
        const textSpan = link.querySelector('.truncate') || link;
        textSpan.innerText = f_subreddit;
    });

    // D) Sostituiamo l'icona/avatar del subreddit
    const avatarImg = fakePost.querySelector('span[avatar] img') || fakePost.querySelector('img[width="24"]');
    if (avatarImg) {
        avatarImg.src = f_avatar; 
        avatarImg.style.backgroundColor = "#0079D3"; 
    }

    // E) Aggiungiamo data, numero commenti e numero voti
    const date = '1 ora fa';
    const votes = '15.4k voti';
    const comments = '1.2k commenti';

    const timeContainer = fakePost.querySelector('faceplate-timeago');
    if (timeContainer) {
        timeContainer.outerHTML = `<span>` + date + `</span>`; 
    }

    const counterRow = fakePost.querySelector('div[data-testid="search-counter-row"]');
    if (counterRow) {
        counterRow.innerHTML = `<span>` + votes + `</span><span class="mx-2xs">·</span><span>` + comments + `</span>`;
    }

    // F) Inseriamo descrizione ed immagine del post
    const textColumn = fakePost.querySelector('div[data-testid="sdui-post-unit"]');
    const innerBox = fakePost.querySelector('div[data-testid="search-post-with-content-preview"]') || fakePost.querySelector('div[data-testid="search-post-unit"]') || fakePost.firstElementChild;
    if (textColumn) {
        const oldSnippet = textColumn.querySelector('search-telemetry-tracker[click-events="search/click/post"] a.text-14') || textColumn.lastElementChild;
        if (oldSnippet) oldSnippet.remove();

        // TESTO (DESCRIZIONE)
        const customTextBox = document.createElement("div");
        customTextBox.style.marginTop = "2px";
        customTextBox.style.marginBottom = "6px"; 
        customTextBox.style.fontSize = "14px";
        customTextBox.style.lineHeight = "1.4";
        customTextBox.style.color = "var(--color-neutral-content-strong)"; 
        
        if (f_content) {
            const textParagraph = document.createElement("p");
            textParagraph.innerText = f_content;
            textParagraph.style.margin = "0"; 
            customTextBox.appendChild(textParagraph);
        }

        if (counterRow && counterRow.parentElement) { counterRow.parentElement.insertBefore(customTextBox, counterRow); } 
        else { textColumn.appendChild(customTextBox); }
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