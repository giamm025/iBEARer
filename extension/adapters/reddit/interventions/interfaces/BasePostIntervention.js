/**
 * @class BasePostIntervention
 * @extends BaseIntervention
 * @description Classe base per interventi che iterano sui post (Modify, Remove, ReRank, ...).
 * Delega OGNI accesso al DOM a this.platform. Le sottoclassi non toccano mai il DOM: implementano solo `applyAction()`.
 */
class BasePostIntervention extends BaseIntervention {

    execute(payload, eventData) {

        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!PlatformAdapter.isValidInterventionPage()) { return false; } 

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = (eventData && eventData.search_query) ? eventData.search_query : PlatformAdapter.getCurrentSearchQuery();

        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        const activePayloads = this._getAllMatchingPayloads(initialQuery, payload, "data");
        if (activePayloads.length === 0) return false;

        // se c'è gia un observer attivo (dovuto ad una precedente applicazione dell'intervento) lo rimuoviamo
        this._feedObserverHandle?.disconnect();

        // creiamo un Set per memorizzare quali posizioni abbiamo GIÀ processato
        const processedPositions = new Set();
        let isMutating = false;

        // funzione wrapper che "addormenta" l'observer durante le modifiche
        const runProcess = () => {
            isMutating = true;
            this.processPosts(initialQuery, activePayloads, processedPositions);
            setTimeout(() => { isMutating = false; }, 50);
        };

        runProcess();

        // impostiamo l'observer per l'infinite scroll
        this._feedObserverHandle = this.platform.observeFeedChanges((reason) => {
            
            // se stiamo già processando dei post, evitiamo di far scattare l'observer (es. durante il reranking o la rimozione, che causano mutazioni multiple)
            if (isMutating) return; 

            const currentQuery = PlatformAdapter.getCurrentSearchQuery();
            if (currentQuery !== initialQuery) { observer.disconnect(); return; }

            if (mutations.some(m => m.addedNodes.length > 0)) {
                runProcess();
            }
        });

        return true;
    }

    // metodo helper che processa i post visibili ed applica la funzione specifica su quelli che corrispondono ai target
    processPosts(initialQuery, activePayloads, processedPositions) {

        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        const currentQuery = PlatformAdapter.getCurrentSearchQuery();
        if (currentQuery !== initialQuery) return;
        
        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        if (this.platform.getCurrentSearchQuery() !== initialQuery) return;

        // prendiamo tutti i post
        const posts = this.platform.getVisiblePosts();

            // estriamo posizione e testo del post
            const wrapper = PlatformAdapter._getPostWrapper(titleLink);
            if (!wrapper) return;

            // iteriamo sul payload per vedere se il post corrente fa scattare qualche trigger (per keyword o posizione)
            activePayloads.forEach((payload) => {
                // estraiamo la lista delle keyword e la lista delle posizioni che fanno scattare i trigger
                const keywords  = payload.target_keywords || [];
                const positions = (payload.target_positions || []).map(Number);

                // controlliamo se la posizione del post o il testo del post si trovano nelle liste che fanno scattare i trigger 
                const isPosTarget = positions.includes(originalPos) && !processedPositions.has(originalPos);
                const isKeywordTarget = keywords.some((k) => this._matchesKeyword(k, text));

                // se non si verifica nessuna delle due condizioni => non scatta nessun trigger 
                if (!isPosTarget && !isKeywordTarget) return;

                // se il post è già stato => non lo processiamo di nuovo
                if (post[`_bearProcessed_${this.fqn}`]) return;

                // altirmenti, applichiamo l'intervento specifico e segniamo il post come "processato"
                this.applyAction(post, originalPos, initialQuery, payload, isKeywordTarget);
                if (isPosTarget) processedPositions.add(originalPos);
                post[`_bearProcessed_${this.fqn}`] = true;
            });
        });

        // controlliamo se ci sono azioni in coda da eseguire (es. se voglio spostare un post da posizione 1 a posizione 50 devo aspettare che Reddit carichi il 50esimo post)
        this.checkPendingActions?.(posts);
    }

    // metodo astratto che le sottoclassi DEVONO implementare per definire l'azione specifica (modifica, rimozione, ecc.)
    applyAction(wrapper, titleLink, currentPos, initialQuery, payload, isKeywordTarget) {
        throw new Error(`[Architecture Violation] ${this.fqn} NON ha implementato applyAction().`);
    }

    // metodo helper per estrarre TUTTI i payload validi (non solo il primo)
    _getAllMatchingPayloads(query, payload, dataKey = "data") {
        const matches = [];
        const lowerQuery = query.toLowerCase();

        for (const item of payload.dynamic_content) {
            const isMatch = !item.trigger_keywords?.length
                || item.trigger_keywords.some((k) => this._matchesKeyword(k, lowerQuery));
            if (isMatch && item[dataKey]) matches.push(item[dataKey]);
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
        
        // semplicemente chiamiamo l'ApiManager per inserire i dati in coda verso il backend
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