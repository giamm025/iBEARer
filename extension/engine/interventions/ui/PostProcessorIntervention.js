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

        // estriamo posizione/keywords dal config.json
        const keywords = payload.target_keywords ? payload.target_keywords.map(k => k.toLowerCase()) : [];
        const positions = payload.target_positions ? payload.target_positions.map(Number) : [];

        // se non è specificata nessuna keyword o posizione, non facciamo nulla
        if (keywords.length === 0 && positions.length === 0) {
            Log.error("Intervention", `Nessun target specificato per ${this.fqn}.`);
            return false;
        }   

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = new URLSearchParams(window.location.search).get('q');
        const observerKey = `_bearObserver_${this.fqn}`;

        // se c'è gia un observer attivo (dovuto ad una precedente applicazione dell'intervento) lo rimuoviamo
        if (window[observerKey]) { window[observerKey].disconnect(); }

        // metodo helper che processa i post visibili ed applica la funzione specifica su quelli che corrispondono ai target
        this.processPosts(keywords, positions, initialQuery, payload);

        // impostiamo l'observer per l'infinite scroll
        const observer = new MutationObserver((mutations) => {
            const currentQuery = new URLSearchParams(window.location.search).get('q');
            if (currentQuery !== initialQuery) {
                observer.disconnect();
                return;
            }

            if (mutations.some(m => m.addedNodes.length > 0)) {
                this.processPosts(keywords, positions, initialQuery, payload);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        window[observerKey] = observer;
        
        return true;
    }



    // metodo helper che processa i post visibili ed applica la funzione specifica su quelli che corrispondono ai target
    processPosts(keywords, positions, initialQuery, payload) {

        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        const currentQuery = new URLSearchParams(window.location.search).get('q');
        if (currentQuery !== initialQuery) return;

        // prendiamo tutti i titoli dei post
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        const realTitles = Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));

        // iteriamo su tutti i titoli per verificare se corrispondono a keyword o posizione
        realTitles.forEach((titleLink, index) => {

            // estriamo posizione e testo del post
            const currentPos = index + 1;
            const text = titleLink.innerText.toLowerCase();

            // controlliamo se la posizione è nella lista o se il testo contiene una delle keyword
            const isPosTarget = positions.includes(currentPos);
            const isKeywordTarget = keywords.some(k => text.includes(k));

            // se è vera almeno una delle due condizioni => chiamiamo la funzione specifica
            if (isPosTarget || isKeywordTarget) {

                // troviamo il container principale (quello centrale, eclusi i sidebar vari)
                const mainFeedContainer = titleLink.closest('main#main-content > div') || titleLink.closest('div.bg-neutral-background');
                if (mainFeedContainer) {

                    // troviamo il wrapper che contiene TUTTO il post (titolo, subreddit, immagine, ecc.)
                    let wrapper = titleLink;
                    while (wrapper.parentElement && wrapper.parentElement !== mainFeedContainer) {
                        wrapper = wrapper.parentElement;
                    }

                    // chiamiamo il metodo specifico della sottoclasse che sa cosa fare (Template Method Pattern)
                    if (wrapper) {
                        this.applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget);
                    }
                }
            }
        });
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

            // IMMAGINE
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
    


    // metodo per inviare i dati al backend tramite l'ApiManager
    sendPostToBackend(actionType, searchQuery, targetPosition, originalTitle, originalSubreddit, originalUrl) {
       
        // semplicemente chiamiamo l'ApiManager per inserire i dati inc oda verso il backend
        ApiManager.addEventToQueue("telemetry.events.PostAlteredEvent", {
            action_type: actionType,
            search_query: searchQuery,
            target_position: targetPosition,
            original_title: originalTitle,
            original_subreddit: originalSubreddit,
            original_url: originalUrl
        });
    }
}