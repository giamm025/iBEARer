// EDIT: piuttosto che impazzire creando un vero e proprio post con i tag di reddit e tutto quanto (che se un domani cambiano 
// nemmeno funzionerebbe piu), conviene CLONARE un post già esistente (es. prendiamo il primo post, lo cloniamo e cambiamo gli attriobuti)

window.injectFakePost = function(payload, eventData) {
    
    // come abbiamo gia fatto per il debunking banner:
    // se c'è gia un post fake (abbiamo gia applicato l'intervento) non facciamo nulla
    if (document.getElementById("bear-fake-post")) return;

    // estraiamo i dati dal config.json (se alcuni valori mancano usiamo dei Default)
    const f_title = payload.title || "Attenzione: Informazione Scientifica";
    const f_subreddit = payload.subreddit || "r/SanitaPubblica";
    const f_avatar = payload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png";
    const f_author = payload.author || "MinisteroDellaVerita";
    const f_content = payload.content_text || "Questo è un messaggio di debunking inserito dall'estensione.";
    const f_image = payload.image_url || null;
    const f_link = payload.target_url || "#";
    
    // come abbiamo gia visto in altri casi 8es. Observers) i risultati veri di Reddit potrebbero metterci 1-2 secondi 
    // a caricare. Impostiamo quindi un setInterval per ritardare l'operazione
    const finder = setInterval(() => {
        
        // cerchiamo il primo link di un post. In particolare cerchiamo il link del titolo, perché è quello che 
        // ci serve per costruire il nostro post fake
        const firstTitleLink = document.querySelector('a[data-testid="post-title"]');
        if (firstTitleLink) {

            // appena troviamo un post originale, fermiamo il setInterval (ma proseguiamo con la costruzione del post fake)
            clearInterval(finder); 

            // 1. TROVIAMO LA COLONNA CENTRALE DI REDDIT
            const mainFeedContainer = firstTitleLink.closest('main#main-content > div') || firstTitleLink.closest('div.bg-neutral-background');
            if (!mainFeedContainer) {
                Log.error("Intervention", "Impossibile trovare la colonna principale dei risultati.");
                return;
            }

            // 2. RISALIAMO FINO AL FIGLIO DIRETTO DELLA COLONNA
            let originalPostWrapper = firstTitleLink;
            while (originalPostWrapper.parentElement && originalPostWrapper.parentElement !== mainFeedContainer) {
                originalPostWrapper = originalPostWrapper.parentElement;
            }

            // 3. CLONAZIONE DEL WRAPPER COMPLETO
            const fakePost = originalPostWrapper.cloneNode(true);
            fakePost.id = "bear-fake-post";

            // 4. MODIFICA DEL DOM CLONATO (funzione helper)
            formatFakePostDOM(fakePost, f_title, f_subreddit, f_avatar, f_content, f_image, f_link);

            // 5. INSERIMENTO NELLA PAGINA
            mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
            
            const divider = document.createElement("hr");
            divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";
            mainFeedContainer.insertBefore(divider, originalPostWrapper);
            
            Log.intervention("Fake Post inserito con successo (100% Camuffato)!");

        }
    }, 100); 
};

Log.intervention("Intervento caricato: injectFakePost");


// funzione helper per disegnare/modificare il finto post nel DOM
function formatFakePostDOM(fakePost, f_title, f_subreddit, f_avatar, f_content, f_image, f_link) {
    
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