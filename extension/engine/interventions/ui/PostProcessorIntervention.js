/**
 * @class PostProcessorIntervention
 * @extends BaseIntervention
 * @description Classe base per interventi che iterano sui post (es. Modify e Remove). 
 * Gestisce il MutationObserver, i controlli di compatibilità (isPostPage) e l'estrazione dei target.
 */
class PostProcessorIntervention extends BaseIntervention {

    execute(payload, eventData) {

        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!this.isPostPage()) { return false; } 

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = new URLSearchParams(window.location.search).get('q') || "";

        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        const activePayload = this.resolvePayload(initialQuery, payload, "data");
        if (!activePayload) { return false; }

        // estriamo posizione/keywords dal config.json
        const keywords = activePayload.target_keywords ? activePayload.target_keywords.map(k => k.toLowerCase()) : [];
        const positions = activePayload.target_positions ? activePayload.target_positions.map(Number) : [];

        // se non è specificata nessuna keyword o posizione, non facciamo nulla
        if (keywords.length === 0 && positions.length === 0) {
            Log.error("Intervention", `Nessun target specificato per ${this.fqn}.`);
            return false;
        }   

        // se c'è gia un observer attivo (dovuto ad una precedente applicazione dell'intervento) lo rimuoviamo
        const observerKey = `_bearObserver_${this.fqn}`;
        if (window[observerKey]) { window[observerKey].disconnect(); }

        // creiamo un Set per memorizzare quali posizioni abbiamo GIÀ processato
        const processedPositions = new Set();        
        let isMutating = false; 

        // Funzione wrapper che addormenta l'observer durante le modifiche
        const runProcess = () => {
            isMutating = true; 
            this.processPosts(keywords, positions, initialQuery, activePayload, processedPositions);
            setTimeout(() => { isMutating = false; }, 50);
        };

        // metodo helper che processa i post visibili ed applica la funzione specifica su quelli che corrispondono ai target
        runProcess();

        // impostiamo l'observer per l'infinite scroll
        const observer = new MutationObserver((mutations) => {

            // se stiamo già processando dei post, evitiamo di far scattare l'observer (es. durante il reranking o la rimozione, che causano mutazioni multiple)
            if (isMutating) return; 

            const currentQuery = new URLSearchParams(window.location.search).get('q') || "";
            if (currentQuery !== initialQuery) {
                observer.disconnect();
                return;
            }

            if (mutations.some(m => m.addedNodes.length > 0)) {
                runProcess();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        window[observerKey] = observer;
        
        return true;
    }

    
    
    // metodo helper che processa i post visibili ed applica la funzione specifica su quelli che corrispondono ai target
    processPosts(keywords, positions, initialQuery, payload, processedPositions) {
        
        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        const currentQuery = new URLSearchParams(window.location.search).get('q') || "";
        if (currentQuery !== initialQuery) return;
        
        // prendiamo tutti i titoli dei post
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        const realTitles = Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));

        // iteriamo su tutti i titoli per verificare se corrispondono a keyword o posizione
        realTitles.forEach((titleLink, index) => {

            // estriamo posizione e testo del post
            const currentPos = index + 1;
            const rawText = titleLink.innerText || titleLink.getAttribute('aria-label') || titleLink.textContent || "";
            const text = rawText.toLowerCase();
            
            // controlliamo se la posizione è nella lista o se il testo contiene una delle keyword e NON è ancora stata processata (per evitare di processare più post con la stessa posizione, nel caso in cui il feed non sia ordinato esattamente per rilevanza)
            const isPosTarget = positions.includes(currentPos) && !processedPositions.has(currentPos);
            const isKeywordTarget = keywords.some(k => text.includes(k));

            // se è vera almeno una delle due condizioni => chiamiamo la funzione specifica
            if (isPosTarget || isKeywordTarget) {
                
                // chiamiamo la funzione per estrarre il wrapper del post da clonare 
                const wrapper = this._getSinglePostWrapper(titleLink);
                if (wrapper && !wrapper.dataset[`bear_${this.fqn}`]) {
                    
                    // marchiamo il post come processato per evitare di processarlo nuovamente 
                    wrapper.dataset[`bear_${this.fqn}`] = "true";
                    this.applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget);
                    if (isPosTarget) processedPositions.add(currentPos);
                
                } else {
                    Log.error("Intervention", `Impossibile isolare il wrapper per il post in pos ${currentPos}`);
                }
            }
        });

        // diamo la possibilità alle sottoclassi di "aggiungere post in coda" da processare (es. se voglio spostare un post da posizione 1 a posizione 50 devo aspettare che Reddit carichi il 50esimo post)
        if (typeof this.checkPendingActions === 'function') { this.checkPendingActions(realTitles); }
    }



    // metodo per verificare se siamo in una schermata compatibile ("Posts" o "All") prima di applicare l'intervento
    isPostPage() {

        // prendiamo l'url della pagina e controlliamo se siamo nella schermata "Posts" (type=posts) o "All" (type=all o nullo). 
        const urlParams = new URLSearchParams(window.location.search);
        const tabType = urlParams.get('type');
        
        // se siamo in altre schermate (es. "People", "Communities") non applichiamo l'intervento.
        if (tabType && tabType !== 'posts' && tabType !== 'all') {
            Log.intervention(`Schermata incompatibile (type=${tabType}). Intervento post abortito.`);
            return false; // 'false' per bloccare la telemetria dell'Engine!
        }
        return true;
    }



    // metodo astratto che le sottoclassi DEVONO implementare per definire l'azione specifica (modifica, rimozione, ecc.)
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        throw new Error(`[Architecture Violation] ${this.fqn} NON ha implementato applyAction().`);
    }



    //metodo ricorsivo per trovare il wrapper esatto di un singolo post
    _getSinglePostWrapper(titleLink) {
        
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

    // metodo helper per personalizzare un post (cambiare titolo, subreddit, immagine, testo, ecc.)
    formatPost(postNode, f_title, f_subreddit, f_avatar, f_content, f_image, f_link, f_date, f_votes, f_comments) {
    
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

        // G) Inseriamo descrizione ed immagine del post
        if (f_content || f_image) {
            const textColumn = postNode.querySelector('div[data-testid="sdui-post-unit"]');
            const innerBox = postNode.querySelector('div[data-testid="search-post-with-content-preview"]') || postNode.querySelector('div[data-testid="search-post-unit"]') || postNode.firstElementChild;
            const counterRow = postNode.querySelector('div[data-testid="search-counter-row"]');
            
            if (textColumn) {
                const oldSnippet = textColumn.querySelector('search-telemetry-tracker[click-events="search/click/post"] a.text-14') || textColumn.lastElementChild;
                if (oldSnippet && oldSnippet !== counterRow) oldSnippet.remove();

                // G.1) TESTO (DESCRIZIONE)
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
    }
    
    // metodo per fondere i dati del config.json con dei valori di default (nel caso qualcosa mancasse)
    mergePostData(basePayload, overrides = {}) {
        
        // Uniamo i due oggetti. Le proprietà di "overrides" vinceranno su quelle di "basePayload"
        const merged = { ...basePayload, ...overrides };

        return {
            title: merged.title || "Attenzione: Informazione",
            subreddit: merged.subreddit || "r/iBEARer",
            subreddit_icon_url: merged.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png",
            content_text: merged.content_text || "Questo è un messaggio inserito dall'estensione.",
            image_url: merged.image_url || null,
            target_url: merged.target_url || null,
            date: merged.date || "2 mesi fa",
            votes: merged.votes || null,
            comments: merged.comments || null
        };
    }
    
    // metodo per inviare i dati al backend tramite l'ApiManager
    sendPostToBackend(actionType, searchQuery, targetPosition, originalTitle, originalSubreddit, originalUrl, newPosition) {
        
        // semplicemente chiamiamo l'ApiManager per inserire i dati inc oda verso il backend
        ApiManager.addEventToQueue("telemetry.events.PostAlteredEvent", {
            action_type: actionType,
            search_query: searchQuery,
            target_position: targetPosition,
            new_position: newPosition || targetPosition,
            original_title: originalTitle,
            original_subreddit: originalSubreddit,
            original_url: originalUrl
        });
    }
}