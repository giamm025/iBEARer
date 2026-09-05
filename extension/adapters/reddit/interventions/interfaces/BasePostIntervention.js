/**
 * @class BasePostIntervention
 * @extends BaseIntervention
 * @description Classe base per interventi che iterano sui post (es. Modify e Remove). 
 * Gestisce il MutationObserver, i controlli di compatibilità (isPostPage) e l'estrazione dei target.
 */
class BasePostIntervention extends BaseIntervention {

    execute(payload, eventData) {

        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!this.isPostPage()) { return false; } 

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = (eventData && eventData.search_query) 
            ? eventData.search_query 
            : (new URLSearchParams(window.location.search).get('q') || "");

        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        const activePayloads = this._getAllMatchingPayloads(initialQuery, payload, "data");
        if (activePayloads.length === 0) return false;

        // se c'è gia un observer attivo (dovuto ad una precedente applicazione dell'intervento) lo rimuoviamo
        const observerKey = `_bearObserver_${this.fqn}`;
        if (window[observerKey]) { window[observerKey].disconnect(); }

        // creiamo un Set per memorizzare quali posizioni abbiamo GIÀ processato
        const processedPositions = new Set();        
        let isMutating = false; 

        // Funzione wrapper che addormenta l'observer durante le modifiche
        const runProcess = () => {
            isMutating = true; 
            this.processPosts(initialQuery, activePayloads, processedPositions);
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
    processPosts(initialQuery, activePayloads, processedPositions) {

        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        const currentQuery = new URLSearchParams(window.location.search).get('q') || "";
        if (currentQuery !== initialQuery) return;
        
        // prendiamo tutti i titoli dei post
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        const realTitles = Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));

        // iteriamo su tutti i titoli per verificare se corrispondono a keyword o posizione
        realTitles.forEach((titleLink, index) => {

            // estriamo posizione e testo del post
            const wrapper = this._getSinglePostWrapper(titleLink);
            if (!wrapper) return;

            // la prima volta che incontriamo un post gli aggiungiamo un attributo che indica la sua posizione ORIGINALE (prima dei nostri reranking)
            if (!wrapper.dataset.bearOriginalPos) { wrapper.dataset.bearOriginalPos = index + 1; }

            // utilizziamo poi questa posizione ORIGINALE per trovare target e riferimenti
            const originalPos = parseInt(wrapper.dataset.bearOriginalPos);
            const text = titleLink.innerText.toLowerCase();

            // iteriamo su ogni regola attiva per vedere se questo post la fa scattare
            activePayloads.forEach(payload => {

                // estraiamo keyword e posizioni target dal payload
                const keywords = payload.target_keywords || [];
                const positions = payload.target_positions ? payload.target_positions.map(Number) : [];

                // controlliamo se la posizione è nella lista o se il testo contiene una delle keyword e NON è ancora stata processata (per evitare di processare più post con la stessa posizione, nel caso in cui il feed non sia ordinato esattamente per rilevanza)
                const isPosTarget = positions.includes(originalPos) && !processedPositions.has(originalPos);
                const isKeywordTarget = keywords.some(k => {
                    const regexMatch = k.match(/^\/(.+)\/([a-z]*)$/);
                    if (regexMatch) {
                        try {
                            const regex = new RegExp(regexMatch[1], regexMatch[2] || 'i');
                            return regex.test(text); 
                        } catch (e) { return false; }
                    }
                    return text.includes(k.toLowerCase());
                });

                // se è vera almeno una delle due condizioni => chiamiamo la funzione specifica
                if (isPosTarget || isKeywordTarget) {
                    
                    // se il post è già stato modificato => non facciamo nulla
                    if (!wrapper.dataset[`bear_${this.fqn}`]) {
                        
                        // marchiamo il post come processato per evitare di processarlo nuovamente 
                        wrapper.dataset[`bear_${this.fqn}`] = "true";
                        
                        // applichiamo l'intervento specifico e segniamo il post come "processato"
                        this.applyAction(wrapper, titleLink, originalPos, initialQuery, payload, isKeywordTarget);
                        if (isPosTarget) processedPositions.add(originalPos);
                    }
                }
            });
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


    // metodo helper per estrarre TUTTI i payload validi (non solo il primo)
    _getAllMatchingPayloads(query, payload, dataKey = "data") {

        const matches = [];
        const lowerQuery = query.toLowerCase();

        for (let item of payload.dynamic_content) {
            let isMatch = false;
            
            // Se non ci sono keyword, matcha sempre (default)
            if (!item.trigger_keywords || item.trigger_keywords.length === 0) {
                isMatch = true;
            } else {

                // controlliamo se matcha almeno una keyword o regex
                isMatch = item.trigger_keywords.some(k => {
                    const regexMatch = k.match(/^\/(.+)\/([a-z]*)$/);
                    if (regexMatch) {
                        try {
                            const regex = new RegExp(regexMatch[1], regexMatch[2] || 'i');
                            return regex.test(query);
                        } catch (e) {
                            Log.error("Intervention", `Regex non valida nel config: ${k}`, e);
                            return false;
                        }
                    }
                    return lowerQuery.includes(k.toLowerCase());
                });
            }

            if (isMatch && item[dataKey]) {
                matches.push(item[dataKey]);
            }
        }

        return matches;
    }
    
    // metodo per fondere i dati del config.json con dei valori di default (nel caso qualcosa mancasse)
    mergePostData(basePayload, overrides = {}) {
        
        // Uniamo i due oggetti. Le proprietà di "overrides" vinceranno su quelle di "basePayload"
        const merged = { ...basePayload, ...overrides };

        return {
            title: merged.title || "Attenzione: Informazione",
            subreddit: merged.subreddit || "r/iBEARer",
            subreddit_icon_url: merged.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png",
            subreddit_target_url: merged.subreddit_target_url || null,
            content_text: merged.content_text || "",
            image_url: merged.image_url || null,
            target_url: merged.target_url || null,
            date: merged.date || "2 mesi fa",
            votes: merged.votes || null,
            comments: merged.comments || null
        };
    }

    // metodo per iniettare link e telemetria su componenti specifici, bucando lo Shadow DOM di Reddit
    _addTargetLink(component, url, fullEventName, payload, initialQuery, pos, new_tab = false) {
        
        if (!component) return;
        component.addEventListener('click', (e) => {
            
            // Analizziamo il percorso fisico del click nel DOM
            const path = e.composedPath();
            const isClickOnSubLink = path.some(el => el.dataset && el.dataset.bearIsSubLink);
            
            // Se il gestore attuale è il macro-contenitore (il post intero) MA l'utente ha mirato 
            // specificamente al link del subreddit, usciamo silenziosamente e lasciamo propagare l'evento verso il basso
            if (component.id?.startsWith('bear-fake-post') && isClickOnSubLink) {
                return;
            }

            // Se siamo arrivati qui, il click è legittimo per questo componente
            e.preventDefault();
            e.stopPropagation(); 
            
            // invia l'evento alla coda di telemetria
            ApiManager.addEventToQueue(fullEventName, {
                search_query: initialQuery,
                post_position: pos,
                title: payload.title || "Titolo Sconosciuto",
                subreddit: payload.subreddit || "Subreddit Sconosciuto",
            });            
            
            if (url && !new_tab)     { window.location.href = url; }
            else if (url && new_tab) { window.open(url, '_blank'); }
            
        }, { capture: true }); 
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