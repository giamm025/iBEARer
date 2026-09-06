/**
 * @class RedditAdapter
 * @description Adapter specifico per la piattaforma Reddit. Fornisce metodi per l'interazione con i post, la gestione dei modali e l'estrazione dei dati.
 */ 
class RedditAdapter {
    
    /** Configura l'estensione per eseguire l'esperimento su REDDIT */
    run() {

        // facciamo partire l'adapter per intercettare eventi SOLO DOPO che l'engine è partito
        // altrimenti rischiamo di intercettare eventi prima che l'engine sia pronto a gestirli
        document.addEventListener("EngineReady", () => {

            Log.adapter("Avvio Reddit Adapter...");

            // definiamo la funzione che "sveglia" TUTTI gli observers attivi 
            const notifyObservers = () => {

                // se ci sono observer registrati, chiamiamo il loro metodo check() per svegliarli
                if (window.ObserverRegistry) {
                    for (const observer of window.ObserverRegistry) {
                        observer.check();
                    }     

                // altrimenti logghiamo che non ci sono observer registrati (DEBUG)
                } else {
                    Log.adapter("Nessun Observer registrato.");
                }
            };

            // definiamo la funzione che l'SpaWatcher drovrà eseguire AD OGNI CAMBIO URL. 
            // nel nostro caso si occuperà solo di attivare gli Observer registrati.
            SpaWatcher.watch(() => {
                notifyObservers()
            });
        });
    }

    // =======================================================================
    // MANIPOLAZIONE QUESTIONARI
    // =======================================================================

    /** Apre un Modale bloccante di dimensioni configurabili. */
    showSurveyModal(modalConfiguration) {

        // usiamo un id fisso per il nostro pop-up, in modo da poterlo identificare e rimuovere facilmente in seguito
        if (document.getElementById('reddit-cospiracy-survey-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'reddit-cospiracy-survey-modal';
        
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); z-index: 9999999;
            display: flex; justify-content: center; align-items: center;
            font-family: Arial, sans-serif; backdrop-filter: blur(5px);
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: white; padding: 40px; border-radius: 12px;
            text-align: center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;

        // Inseriamo dinamicamente i valori passati tramite l'oggetto modalConfiguration
        box.innerHTML = `
            <h2 style="color: #1a1a1b; margin-top: 0; font-size: 24px;">${modalConfiguration.title}</h2>
            <p style="color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                ${modalConfiguration.message}
            </p>
            <a href="${modalConfiguration.link}" target="_blank" style="
                background: #ff4500; color: white; padding: 14px 28px;
                text-decoration: none; font-weight: bold; border-radius: 999px;
                font-size: 16px; display: inline-block; cursor: pointer;
            ">${modalConfiguration.buttonText}</a>
        `;

        modal.appendChild(box);
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    /** Chiude il Modale aperto con showSurveyModal() e ripristina lo scroll della pagina. */ 
    hideSurveyModal() {
        const modal = document.getElementById('reddit-cospiracy-survey-modal');
        if (modal) modal.remove();
        document.body.style.overflow = ''; 
    }

    // =======================================================================
    // MANIPOLAZIONE POST
    // =======================================================================

    /** Estrae i dati principai di un post. */
    extractPostData(postWrapper, titleLink) {
        
        // TITOLO
        const rawTitle = titleLink.innerText || titleLink.getAttribute('aria-label') || titleLink.textContent || "";
        const originalTitle = rawTitle.replace(/\s+/g, ' ').trim() || "Sconosciuto";
        
        // URL
        const originalUrl = titleLink.href;
        
        // SUBREDDIT
        const validSubLink = Array.from(postWrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
        const originalSubreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

        return {
            title: originalTitle,
            url: originalUrl,
            subreddit: originalSubreddit
        };
    }

    /** Nasconde un post dal feed (usando display:none). */
    hidePost(postWrapper) {

        // nascondiamo il post principale 
        postWrapper.style.display = 'none';
        
        // nascondiamo anche l'hr sottostante per evitare brutti spazi vuoti nella UI.
        const nextSibling = postWrapper.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'HR') nextSibling.style.display = 'none';
    }

    /** Applica un colore sfondo al post. */
    applyHighlightToPost(postWrapper, highlightColor) {
        if (!highlightColor) { Log.Error("highlightColor is required"); return; }
        const innerBox = this._getInnerBox(postWrapper);
        if (innerBox) {
            innerBox.style.backgroundColor = highlightColor;
        }
    }

    /** Applica un bordo colorato al post. */
    applyBorderToPost(postWrapper, borderColor) {
        if (!borderColor) { Log.Error("borderColor is required"); return; }
        const innerBox = this._getInnerBox(postWrapper);
        if (innerBox) {
            innerBox.style.borderLeft = `4px solid ${borderColor}`;
        }
    }

    /** Sovrascrive gli attributi di un post */
    formatPost(postNode, payload) {
        
        // Estraiamo tutte le variabili dal payload
        const { 
            title: f_title, 
            subreddit: f_subreddit, 
            subreddit_icon_url: f_avatar, 
            content_text: f_content, 
            image_url: f_image, 
            target_url: f_link, 
            date: f_date, 
            votes: f_votes, 
            comments: f_comments 
        } = payload;

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

            // B) Il VERO titolo visibile (quello che l'utente vede)
            if (visibleTitle) {
                if (f_link) visibleTitle.href = f_link;
                if (f_title) visibleTitle.innerText = f_title; 
            }
        }

        // C) Modifichiamo il Subreddit (Escludendo i link che vanno ai commenti)
        if (f_subreddit) {
            const subLinks = Array.from(postNode.querySelectorAll('a[href*="/r/"]')).filter(a => !a.href.includes('/comments/'));
            subLinks.forEach(link => {
                if (f_link) link.href = "#"; 
                const textSpan = link.querySelector('.truncate') || link;
                textSpan.innerText = f_subreddit;
                link.dataset.bearIsSubLink = "true";
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

        // E) Aggiungiamo data
        if (f_date) {
            const timeContainer = postNode.querySelector('faceplate-timeago');
            if (timeContainer) {
                const customDateSpan = document.createElement('span');
                customDateSpan.innerText = f_date;
                timeContainer.replaceWith(customDateSpan);
            }
        }

        // F) Aggiungiamo numero commenti e numero voti
        const counterRow = postNode.querySelector('div[data-testid="search-counter-row"]');
        if (counterRow) {
            let originalVotes = "0";
            let originalComments = "0";

            const faceplateNumbers = counterRow.querySelectorAll('faceplate-number');
            if (faceplateNumbers.length > 0) {
                originalVotes = faceplateNumbers[0].getAttribute('pretty') || faceplateNumbers[0].textContent.trim();
            }
            if (faceplateNumbers.length > 1) {
                originalComments = faceplateNumbers[1].getAttribute('pretty') || faceplateNumbers[1].textContent.trim();
            } else if (faceplateNumbers.length === 0) {
                const spans = counterRow.querySelectorAll('span');
                if (spans.length > 0) {
                    const matchV = spans[0].innerText.match(/[\d.,kKMB]+/);
                    if (matchV) originalVotes = matchV[0];
                }
                if (spans.length > 2) {
                    const matchC = spans[2].innerText.match(/[\d.,kKMB]+/);
                    if (matchC) originalComments = matchC[0];
                }
            }

            const finalVotes = (f_votes !== null && f_votes !== undefined) ? f_votes : originalVotes;
            const finalComments = (f_comments !== null && f_comments !== undefined) ? f_comments : originalComments;

            counterRow.innerHTML = `<span>${finalVotes} voti</span><span class="mx-2xs">·</span><span>${finalComments} commenti</span>`;
        }

        // G) Inseriamo descrizione ed immagine del post
        if (f_content || f_image) {
            const textColumn = postNode.querySelector('div[data-testid="sdui-post-unit"]');
            const innerBox = this._getInnerBox(postNode);
            const counterRow = postNode.querySelector('div[data-testid="search-counter-row"]');
            
            if (textColumn) {
                // Rimuoviamo vecchi snippet testo
                const oldSnippet = textColumn.querySelector('search-telemetry-tracker[click-events="search/click/post"] a.text-14') || textColumn.lastElementChild;
                if (oldSnippet && oldSnippet !== counterRow) oldSnippet.remove();

                // G.1) DESCRIZIONE
                if (f_content) {
                    const existingCustomBox = textColumn.querySelector('.bear-custom-text-box');
                    if (existingCustomBox) existingCustomBox.remove();
                    
                    const customTextBox = document.createElement("div");
                    customTextBox.className = "bear-custom-text-box"; 
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

            // G.2) IMMAGINE
            if (f_image && innerBox) {
                
                // Pulizia vecchie immagini
                const existingImages = innerBox.querySelectorAll('img');
                existingImages.forEach(img => {
                    if (!img.closest('span[avatar]')) {
                        let nodeToRemove = img;
                        while (nodeToRemove.parentElement && nodeToRemove.parentElement !== innerBox) {
                            nodeToRemove = nodeToRemove.parentElement;
                        }
                        if (nodeToRemove !== textColumn && nodeToRemove !== counterRow) {
                            nodeToRemove.remove();
                        } else {
                            img.remove();
                        }
                    }
                });

                innerBox.style.alignItems = "flex-start";
                if (textColumn) textColumn.style.paddingRight = "16px";

                const imgWrapper = document.createElement("div");
                imgWrapper.style.flexShrink = "0"; 
                imgWrapper.style.marginLeft = "auto"; 

                const imgElement = document.createElement("img");
                imgElement.src = f_image;
                imgElement.style.width = "120px"; 
                imgElement.style.height = "95px"; 
                imgElement.style.objectFit = "cover"; 
                imgElement.style.borderRadius = "8px";
                imgElement.style.margin = "0"; 
                imgElement.style.marginTop = "4px"; 
                
                imgWrapper.appendChild(imgElement);
                innerBox.appendChild(imgWrapper);
            }
        }
    }

    // =======================================================================
    // RERANKING & SCROLLING
    // =======================================================================

    /** Restituisce l'array dei titoli dei post reali (esclusi quelli fittizi iniettati da noi) */
    getRealPosts() {
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        return Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));
    }

    /** Sposta fisicamente un post (targetWrapper) nella nuova posizione desiderata */
    movePost(targetWrapper, newPosSlot) {

        // prendiamo il post che attualmente si trova in quella che sarà la nuova posizione
        const referencePostTitle = this.getRealPosts()[newPosSlot - 1];
        if (!referencePostTitle) return false;
        const referenceWrapper = this._getPostWrapper(referencePostTitle);

        if (referenceWrapper && referenceWrapper !== targetWrapper) { 
            
            const mainFeedContainer = referenceWrapper.parentNode;
            const targetTitle = targetWrapper.querySelector('a[data-testid="post-title"]');
            const currentPos = realTitles.indexOf(targetTitle);
            const newPos = newPosSlot - 1;
            
            // se il post non è più presente nel DOM (es. è stato rimosso dall'utente) => non facciamo nulla
            if (currentPos === -1) return false;

            try {
                // se stiamo spostando il nostro post in ALTO  (es. da 5 a 1) => inseriamo PRIMA del post di riferimento
                // se stiamo spostando il nostro post in BASSO (es. da 1 a 5) => inseriamo DOPO   il post di riferimento  
                if (currentPos > newPos) { mainFeedContainer.insertBefore(targetWrapper, referenceWrapper); } 
                else                     { mainFeedContainer.insertBefore(targetWrapper, referenceWrapper.nextSibling);  }
                return true;

            } catch (e) {
                Log.error("Intervention", "Errore durante lo spostamento nel DOM", e);
                return false;
            }
        }
        return false;
    }

    /** Simula lo scrolling per forzare React a caricare nuovi risultati fino al target */
    forceGhostScroll(targetPos) {
        this._injectHidingStyles();
        this._hidePageContent(); 
        Log.intervention(`Ghost Scroll attivato: Ricerca del post in posizione ${targetPos}...`);

        // impostiamo un numero massimo di tentativi per evitare loop infiniti in caso di problemi di caricamento
        let attempts = 0;
        const maxAttempts = 20; 
        const scrollInterval = setInterval(() => {
            
            // teniamo il conto di quanti post reali sono stati caricati finora
            const realTitlesCount = this.getRealPosts().length;

            // se abbiamo raggiunto la posizione cercata (o il limite di tentativi massimi) => torniamo in cima e mostriamo il contenuto
            if (realTitlesCount >= targetPos || attempts >= maxAttempts) {
                clearInterval(scrollInterval);                          // rimuove il timer
                window.scrollTo(0, 0);                                  // torna in cima
                setTimeout(() => { this._revealPageContent(); }, 300);  // mostra di nuovo la pagina

            // altrimenti (non abbiamo ancora raggiunto la posizione target) => scrolla di nuovo
            } else {
                window.scrollTo(0, document.body.scrollHeight);
                attempts++;
            }
        }, 300); 
    }

    // =======================================================================
    // METODI PRIVATI
    // =======================================================================

    /** Restituisce l'elemento interno di un post. */
    _getInnerBox(postWrapper){
        return postWrapper.querySelector('div[data-testid="search-post-with-content-preview"]') 
                      || postWrapper.querySelector('div[data-testid="search-post-unit"]') 
                      || postWrapper.firstElementChild;
    }

     /** Trova in modo robusto il wrapper esterno di un singolo post */
    _getPostWrapper(titleLink) {
        // risaliamo la gerarchia fino a trovare un nodo che contiene piu titoli
        let current = titleLink.closest('shreddit-post') || titleLink.closest('article') || titleLink;
        while (current.parentElement) {

            const parent = current.parentElement;
            
            // se raggiungiamo il main content => ritorniamo il nodo precedente (figlio) come wrapper del singolo post
            if (parent.tagName === 'SHREDDIT-FEED' || parent.id === 'main-content') {  return current; }

            // se troviamo un nodo che contiene piu titoli => significa che contiene più di un singolo post => ritorniamo il nodo precedente
            const titlesInParent = parent.querySelectorAll('a[data-testid="post-title"]');
            if (titlesInParent.length > 1) { return current; }

            // se non è vera nessuna delle condizioni sopra => continuiamo a risalire
            current = parent;
        }
        return current;
    }

    _injectHidingStyles() {
        if (!document.getElementById("bear-curtain-style")) {
            const style = document.createElement("style");
            style.id = "bear-curtain-style";
            style.innerHTML = `
                .bear-feed-hidden, 
                .bear-feed-hidden > * { opacity: 0 !important; pointer-events: none !important; }
                .bear-stagger-hidden { opacity: 0 !important; pointer-events: none !important; }
                .bear-fade-in { animation: bearFadeIn 0.5s ease-in forwards; }
                @keyframes bearFadeIn { from { opacity: 0; } to { opacity: 1; } }
            `;
            document.head.appendChild(style);
        }
    }

    _hidePageContent(targetContainer = null) {
        const container = targetContainer || document.querySelector('shreddit-feed') || document.querySelector('main') || document.body;
        if (!container.classList.contains('bear-feed-hidden')) {
            container.classList.add('bear-feed-hidden');
            
            const upperMenu = document.querySelector('reddit-sidebar-nav, #left-sidebar-container, nav');
            const leftMenu = document.querySelector('#left-sidebar, reddit-sidebar-nav, #left-sidebar-container');
            const rightMenu = document.querySelector('[slot="right-sidebar"], right-sidebar, #right-sidebar-container, aside');

            if (upperMenu) upperMenu.classList.add('bear-stagger-hidden');
            if (leftMenu) leftMenu.classList.add('bear-stagger-hidden');
            if (rightMenu) rightMenu.classList.add('bear-stagger-hidden');

            setTimeout(() => { if (upperMenu) upperMenu.classList.remove('bear-stagger-hidden'); }, 1500); 
            setTimeout(() => { if (rightMenu) rightMenu.classList.remove('bear-stagger-hidden'); }, 3000); 
            setTimeout(() => { if (leftMenu) leftMenu.classList.remove('bear-stagger-hidden');   }, 3500); 
        }
    }

    _revealPageContent() {
        document.querySelectorAll('.bear-feed-hidden').forEach(feed => feed.classList.remove('bear-feed-hidden'));
        document.querySelectorAll('.bear-stagger-hidden').forEach(menu => menu.classList.remove('bear-stagger-hidden'));
    }
};