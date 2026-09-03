/**
 * @class BasePostIntervention
 * @extends BaseIntervention
 * @description Classe base per interventi che iterano sui post (Modify, Remove, ReRank, ...).
 * Delega OGNI accesso al DOM a this.platform. Le sottoclassi non toccano mai il DOM: implementano solo `applyAction()`.
 */
class BasePostIntervention extends BaseIntervention {

    execute(payload, eventData) {
        if (!this.platform.isPostPage()) return false;

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = eventData?.search_query ?? this.platform.getCurrentSearchQuery();
        
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
            if (reason === "QUERY_CHANGED") return; 
            runProcess();
        });

        return true;
    }

    // metodo helper che processa i post visibili ed applica la funzione specifica su quelli che corrispondono ai target
    processPosts(initialQuery, activePayloads, processedPositions) {        
        
        // se la query di ricerca è cambiata => l'utente ha cambiato pagina => non facciamo nulla 
        if (this.platform.getCurrentSearchQuery() !== initialQuery) return;

        // prendiamo tutti i post
        const posts = this.platform.getVisiblePosts();

        posts.forEach((post) => {
            const originalPos = this.platform.getPostOriginalPosition(post);
            const text        = this.platform.getPostTitle(post).toLowerCase();

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

    /** Metodo astratto che le sottoclassi DEVONO implementare per definire l'azione specifica (modifica, rimozione, riordino, ...). */
    applyAction(post, originalPosition, initialQuery, payload, isKeywordTarget) {
        throw new Error(`[Architecture Violation] ${this.fqn} NON ha implementato applyAction().`);
    }

    // ==========================================================================
    // Metodi Privati
    // ==========================================================================

    /** 
     * @param {string} keyword - La keyword da confrontare.
     * @param {string} text - Il testo del post.
     * @returns {boolean} true se la keyword corrisponde al testo del post (match esatto o regex)
     */
    _matchesKeyword(keyword, text) {
        const regexMatch = keyword.match(/^\/(.+)\/([a-z]*)$/);
        if (regexMatch) {
            try { return new RegExp(regexMatch[1], regexMatch[2] || 'i').test(text); }
            catch { return false; }
        }
        return text.includes(keyword.toLowerCase());
    }

    /** Metodo helper per estrarre TUTTI i payload relativi a questa query di ricerca (altrimenti, javascript restituisce solo il primo)
     * @param {string} query - La query di ricerca.
     * @param {Object} payload - Il payload da analizzare.
     * @param {string} dataKey - La chiave del dato da estrarre.
     * @returns {Array} - Un array di payload validi.
     */
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

    /** Metodo helper per invper inviare i dati al backend tramite l'ApiManager.
     * @param {string} actionType - Il tipo di azione eseguita.
     * @param {string} searchQuery - La query di ricerca.
     * @param {number} targetPosition - La posizione target del post.
     * @param {string} originalTitle - Il titolo originale del post.
     * @param {string} originalSubreddit - Il subreddit originale del post.
     * @param {string} originalCommunity - La community originale del post.
     * @param {string} originalUrl - L'URL originale del post.
     * @param {number} newPosition - La nuova posizione del post (opzionale).
     */
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