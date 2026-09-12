/**
 * @class BasePlatformAdapter
 * @description Interfaccia astratta che definisce i metodi obbligatori per tutti i Platform Adapter (es. RedditAdapter, TwitterAdapter).
 * Qualsiasi nuovo adapter DEVE estendere questa classe e implementarne tutti i metodi.
 */
class BasePlatformAdapter {
    
    constructor() {
        if (new.target === BasePlatformAdapter) {
            throw new TypeError("Impossibile istanziare direttamente BasePlatformAdapter. È una classe astratta.");
        }
    }

    // =======================================================================
    // SETUP & INIZIALIZZAZIONE
    // =======================================================================
    
    /**
     * @abstract
     * @description Inizializza l'Adapter, agganciandosi agli eventi del Core Engine e impostando i watcher di navigazione (es. per SPA).
     */
    run() { this._notImplemented('run'); }

    // =======================================================================
    // MANIPOLAZIONE QUESTIONARI
    // =======================================================================
    
    /**
     * @abstract
     * @description Mostra un modale bloccante sovrapposto all'interfaccia della piattaforma.
     * @param {Object} modalConfiguration Dati del modale (title, message, link, buttonText).
     */
    showModal(modalConfiguration) { this._notImplemented('showModal'); }
    
    /**
     * @abstract
     * @description Chiude il modale bloccante e ripristina la normale interazione con la pagina.
     */
    hideModal() { this._notImplemented('hideModal'); }

    // =======================================================================
    // MANIPOLAZIONE POST
    // =======================================================================
    
    /**
     * @abstract
     * @description Verifica se la pagina corrente è idonea all'applicazione degli interventi UI sui post.
     * @returns {boolean} True se gli interventi possono essere applicati, false altrimenti.
     */
    isValidInterventionPage() { this._notImplemented('isValidInterventionPage'); }
    
    /**
     * @abstract
     * @description Nasconde visivamente un post dal feed senza rimuoverlo dal DOM.
     * @param {HTMLElement} postWrapper L'elemento contenitore principale del post.
     */
    hidePost(postWrapper) { this._notImplemented('hidePost'); }
    
    /**
     * @abstract
     * @description Applica un colore di sfondo evidenziato al post.
     * @param {HTMLElement} postWrapper L'elemento contenitore principale del post.
     * @param {string} highlightColor Colore esadecimale o testuale (es. "#FF0000").
     */
    applyHighlightToPost(postWrapper, highlightColor) { this._notImplemented('applyHighlightToPost'); }
    
    /**
     * @abstract
     * @description Applica un bordo laterale colorato al post.
     * @param {HTMLElement} postWrapper L'elemento contenitore principale del post.
     * @param {string} borderColor Colore esadecimale o testuale.
     */
    applyBorderToPost(postWrapper, borderColor) { this._notImplemented('applyBorderToPost'); }
    
    /**
     * @abstract
     * @description Sovrascrive i metadati e il contenuto di un post esistente.
     * @param {HTMLElement} postNode L'elemento post da modificare.
     * @param {Object} payload Oggetto contenente i nuovi dati (titolo, immagine, autore, ecc.).
     */
    formatPost(postNode, payload) { this._notImplemented('formatPost'); }

    // =======================================================================
    // RERANKING & SCROLLING
    // =======================================================================
    
    /**
     * @abstract
     * @description Estrae la query di ricerca attuale dall'interfaccia o dall'URL della piattaforma.
     * @returns {string} La query di ricerca (es. "vaccini").
     */
    getCurrentSearchQuery() { this._notImplemented('getCurrentSearchQuery'); }
    
    /**
     * @abstract
     * @description Sposta fisicamente un post nel DOM verso una nuova posizione bersaglio.
     * @param {HTMLElement} targetWrapper Il post da spostare.
     * @param {number} newPosSlot La nuova posizione (1-based index).
     * @returns {boolean} True se lo spostamento ha successo, false altrimenti.
     */
    movePost(targetWrapper, newPosSlot) { this._notImplemented('movePost'); }
    
    /**
     * @abstract
     * @description Forza il caricamento di nuovi risultati simulando uno scroll, utile per le piattaforme con infinite-scroll.
     * @param {number} targetPos La posizione minima da raggiungere prima di interrompere lo scroll.
     */
    forceGhostScroll(targetPos) { this._notImplemented('forceGhostScroll'); }

    // =======================================================================
    // INIEZIONE FAKE POST
    // =======================================================================
    
    /**
     * @abstract
     * @description Restituisce i nodi necessari per clonare e inserire un post fittizio.
     * @param {number} pos La posizione in cui inserire il post.
     * @param {boolean} countInjectedPosts Se true, calcola la posizione tenendo conto dei fake post già inseriti.
     * @returns {Object|null} Oggetto con { cloneWrapper, insertWrapper, parent } o null se non trovati.
     */
    getDomReferences(pos, countInjectedPosts = true) { this._notImplemented('getDomReferences'); }
    
    /**
     * @abstract
     * @description Estrae i titoli e i metadati dei primi post visibili per fornire contesto a un eventuale generatore AI.
     * @returns {string} Stringa di testo formattata con il contesto della pagina.
     */
    scrapeContext() { this._notImplemented('scrapeContext'); }
    
    /**
     * @abstract
     * @description Crea una copia strutturale di un post rimuovendo ID univoci e media.
     * @param {HTMLElement} postToCloneWrapper Il post da clonare.
     * @returns {Object} Oggetto contenente il post clonato (fakePost) ed eventuali separatori (divider).
     */
    createCleanClone(postToCloneWrapper) { this._notImplemented('createCleanClone'); }
    
    /**
     * @abstract
     * @description Rimuove i link e gli script nativi dal post clonato per evitare fughe di navigazione non previste.
     * @param {HTMLElement} fakePost Il post fittizio da sanitizzare.
     */
    sanitizeFakePostLinks(fakePost) { this._notImplemented('sanitizeFakePostLinks'); }
    
    /**
     * @abstract
     * @description Filtra i payload in base al contesto specifico della piattaforma (es. gruppi, subreddit, canali).
     * @param {Array} payloads Lista di payload disponibili per l'iniezione.
     * @returns {Array} Lista filtrata dei payload applicabili.
     */
    filterPlatformSpecificPayloads(payloads) { this._notImplemented('filterPlatformSpecificPayloads'); }

    // =======================================================================
    // BANNER DI DEBUNKING
    // =======================================================================
    
    /**
     * @abstract
     * @description Inserisce il banner di debunking nel contenitore principale della piattaforma.
     * @param {HTMLElement} bannerElement L'elemento HTML del banner.
     * @returns {boolean} True se inserito correttamente.
     */
    insertDebunkingBanner(bannerElement) { this._notImplemented('insertDebunkingBanner'); }
    
    /**
     * @abstract
     * @description Verifica se la navigazione SPA ha mantenuto l'utente sulla stessa ricerca.
     * @param {string} expectedQuery La query di ricerca originaria da confrontare.
     * @returns {boolean} True se la ricerca è invariata.
     */
    isSameSearchPage(expectedQuery) { this._notImplemented('isSameSearchPage'); }
    
    /**
     * @abstract
     * @description Verifica se il contenitore fisico in cui andrà inserito il banner è pronto nel DOM.
     * @returns {boolean}
     */
    isBannerTargetReady() { this._notImplemented('isBannerTargetReady'); }

    // =======================================================================
    // TELEMETRIA: CONTESTO & CLICK
    // =======================================================================
    
    /** @abstract @returns {boolean} True se ci si trova nella home page. */
    isHomePage() { this._notImplemented('isHomePage'); }
    
    /** @abstract @returns {boolean} True se ci si trova in una pagina di risultati di ricerca validi. */
    isSearchPage() { this._notImplemented('isSearchPage'); }
    
    /** 
     * @abstract 
     * @param {string} url L'URL da verificare.
     * @returns {boolean} True se l'URL appartiene a un post organico della piattaforma. 
     */
    isPostUrl(url) { this._notImplemented('isPostUrl'); }
    
    /**
     * @abstract
     * @description Estrae dinamicamente i dati di un post partendo da un suo nodo interno (es. un link cliccato).
     * @param {HTMLElement} node L'elemento target (es. link, immagine o contenitore cliccato).
     * @returns {Object} Dati del post { title, url, subreddit/channel, postWrapper }.
     */
    getPostDetails(node) { this._notImplemented('getPostDetails'); }

    // =======================================================================
    // SCRAPING RISULTATI
    // =======================================================================
    
    /**
     * @abstract
     * @description Scansiona il DOM per estrarre tutti i risultati visibili (post, profili, gruppi) formattati per la telemetria.
     * @returns {Array<Object>} Lista di oggetti con { type, title, url, subreddit, content_text }.
     */
    scrapePageResults() { this._notImplemented('scrapePageResults'); }

    // =======================================================================
    // HELPER INTERNO
    // =======================================================================
    _notImplemented(methodName) {
        throw new Error(`[Architecture Violation] Il metodo '${methodName}()' non è stato implementato dall'Adapter corrente.`);
    }
}