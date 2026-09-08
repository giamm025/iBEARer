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
    
    /** 
     * Verifica se la pagina corrente è compatibile con l'iniezione o manipolazione dei post. 
     * (Per ora, gli interventi si attivano solo sulle pagine con i risultati di ricerca)
     */
    isValidInterventionPage() {
        // prendiamo l'url della pagina e controlliamo se siamo nella schermata "Posts" (type=posts) o "All" (type=all o nullo). 
        const urlParams = new URLSearchParams(window.location.search);
        const tabType = urlParams.get('type');
        
        // se siamo in altre schermate (es. "People", "Communities") non applichiamo l'intervento.
        if (tabType && tabType !== 'posts' && tabType !== 'all') {
            Log.intervention(`Schermata incompatibile (type=${tabType}). Intervento post abortito.`);
            return false; // per bloccare la telemetria 
        }
        return true;
    }

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

    /** Restituisce l'array di tutti i titoli dei post (compresi quelli fittizi iniettati da noi) */
    getAllPosts() {
        return Array.from(document.querySelectorAll('a[data-testid="post-title"]'))
    }

    /** Restituisce la query di ricerca attuale */
    getCurrentSearchQuery() {
        return new URLSearchParams(window.location.search).get('q') || ""
    }

    /** Sposta fisicamente un post (targetWrapper) nella nuova posizione desiderata */
    movePost(targetWrapper, newPosSlot) {
        
        // prendiamo l'array dei titoli dei post reali (esclusi quelli fittizi iniettati da noi)
        const realTitles = this.getRealPosts();
        
        // prendiamo il post che attualmente si trova in quella che sarà la nuova posizione
        const referencePostTitle = realTitles[newPosSlot - 1];
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
    // INIEZIONE FAKE POST 
    // =======================================================================

    /** Trova i nodi di riferimento per clonare e inserire un nuovo post */
    getInjectionReferences(pos, countInjectedPosts = true) {
        
        // estraiamo i link ai post (inclusi quelli initettati da noi)
        const realTitleLinks = this.getRealPosts();
        const allTitleLinks  = this.getAllPosts();
    
        // se countInjectedPosts è true  => usiamo allTitleLinks  (compresi i nostri fake post)
        // se countInjectedPosts è false => usiamo realTitleLinks (esclusi  i nostri fake post)
        const targetLinksArray = countInjectedPosts ? allTitleLinks : realTitleLinks;
        if (targetLinksArray.length === 0) return null;

        // se la posizione richiesta non esiste ancora nel DOM => restituiamo "pending" per ritardare l'inserimento
        if (pos > targetLinksArray.length) { return { isPending: true }; }

        // estraiamo il primo post reale (quello che andremo a clonare) e il post di riferimento per l'inserimento (dove andremo ad inserire il nostro post) 
        const cloneWrapper  = this._getPostWrapper(realTitleLinks[0]);
        const insertReference = targetLinksArray[pos - 1] || targetLinksArray[targetLinksArray.length - 1];
        const insertWrapper = this._getPostWrapper(insertReference);
        if (!cloneWrapper || !insertWrapper) {Log.error("Intervention", "Impossibile isolare il wrapper del post. Layout non supportato."); return null; }

        // recuperiamo il nodo padre del post (solitamente il main feed container) NECESSARIO per utilizzare insertBefore() 
        // (senza il nodo padre insertBefore proprio non funzionerebbe! genererebbe un errore. non possiamo non restituirlo)
        const parent = cloneWrapper.parentElement;
        return { cloneWrapper, insertWrapper, parent };    
    }

    /** Estrae i primi 7 post del feed per fornire contesto al prompt AI (esclusi quelli fittizzi iniettati da noi) */
    scrapeContext() {
        return Array.from(document.querySelectorAll('shreddit-post'))
            .filter(p => !p.id.includes('bear-fake-post'))
            .slice(0, 7) 
            .map(p => `- Subreddit: ${p.getAttribute('subreddit-prefixed-name')} | Titolo: ${p.getAttribute('post-title')}`)
            .join("\n");
    }

    /** Crea un clone pulito (senza ID, media e avatar originali) del post di partenza */
    createCleanClone(postToCloneWrapper) {
        
        const fakePost = postToCloneWrapper.cloneNode(true);
        const divider = document.createElement("hr");
        divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";

        // rimuoviamo tutti gli id del post originale
        fakePost.removeAttribute('id');
        fakePost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

        // rimuoviamo tutti i media (immagini, video, ecc) del post originale
        const mediaElements = fakePost.querySelectorAll('img, video, picture, shreddit-post-image, faceplate-img');
        mediaElements.forEach(media => {
            if (!media.closest('span[avatar]') && !media.src?.includes('avatar') && !media.src?.includes('communityIcon')) {
                const wrapper = media.closest('div[data-testid="post-thumbnail"], .thumbnail'); 
                if (wrapper) wrapper.remove();
                else media.remove();
            }
        });

        // rimuoviamo l'avatar del subreddit originale
        const avatars = fakePost.querySelectorAll('img[src*="avatar"], img[src*="communityIcon"]');
        avatars.forEach(img => img.removeAttribute('srcset'));

        // ritorniamo il post fittizio e il divider da inserire dopo di esso
        return { fakePost, divider };
    }

    /** Rimuove tutti i link del post originale non popolati da noi (es. subreddit, autore, ecc). */
    sanitizeFakePostLinks(fakePost) {
        const allLinks = fakePost.querySelectorAll('a');
        allLinks.forEach(link => {
            link.removeAttribute("href");
            link.removeAttribute("target");
            link.removeAttribute("aria-haspopup"); 
            link.removeAttribute("aria-expanded");
            link.onclick = (e) => e.preventDefault();
        });

        // rimuoviamo anche gli hovercard (es. quello del subreddit o autore) che si attivano passandoci sopra con il cursore
        const hoverCards = fakePost.querySelectorAll('faceplate-hovercard');
        hoverCards.forEach(card => {
            const hoverContent = card.querySelector('[slot="content"]');
            if (hoverContent) hoverContent.remove();
            card.removeAttribute('enter-delay');
            card.removeAttribute('data-id');
            card.removeAttribute('label');
        });

        // mettiamo il cursore "manina" per far sembrare il fake post cliccabile
        fakePost.style.cursor = "pointer";
    }

    /** Filtra i payload in base al contesto della piattaforma. Nel caso di Reddit filtriamo per il subreddit
     *  (es. se stiamo cercando dentro r/politics, iniettiamo solo i post configurati per r/politics) 
     */
    filterPlatformSpecificPayloads(payloads) {
        
        const subMatch = window.location.pathname.match(/^\/r\/([^/]+)\/search/i);
        
        // Se NON siamo in un subreddit specifico (es. ricerca globale), restituiamo i post intatti
        if (!subMatch) {  return payloads; }

        // Se SIAMO in un subreddit specifico, estraiamo il nome e filtriamo il payload
        const currentSubreddit = `r/${subMatch[1].toLowerCase()}`;
        const filteredPayloads = payloads.filter(p => p.subreddit && p.subreddit.toLowerCase() === currentSubreddit);
        return filteredPayloads;
    }

    // =======================================================================
    // BANNER DI DEBUNKING (Platform-Specific)
    // =======================================================================

    /** 
     * Trova il contenitore principale della piattaforma e inietta il banner in cima.
     * Ritorna true se l'inserimento ha successo, false altrimenti.
     */
    insertDebunkingBanner(bannerElement) {
        const redditContainer = document.querySelector("shreddit-app .grid-container");
        if (redditContainer && redditContainer.parentNode) {
            redditContainer.parentNode.insertBefore(bannerElement, redditContainer);
            return true;
        }
        return false;
    }

    /** 
     * Verifica se l'utente si trova ancora sulla pagina dei risultati per la query originale.
     * Utile per le SPA (Single Page Applications) che aggiornano l'URL senza ricaricare il DOM.
     */
    isSameSearchPage(expectedQuery) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentQuery = urlParams.get('q') ? urlParams.get('q').toLowerCase() : "";
        
        return window.location.pathname.includes('/search') && currentQuery === expectedQuery.toLowerCase();
    }

    /** Controlla se il contenitore target per il banner è già stato renderizzato nel DOM */
    isBannerTargetReady() {
        const redditContainer = document.querySelector("shreddit-app .grid-container");
        return redditContainer && redditContainer.parentNode;
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