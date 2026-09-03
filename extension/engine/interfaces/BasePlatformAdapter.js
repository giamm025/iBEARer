/**
 * @class BasePlatformAdapter
 * @abstract
 * @description
 * Interfaccia astratta che ogni platform adapter concreto (Reddit, Twitter, ...) DEVE implementare.
 * Ogni metodo di questa classe dovrebbe esprime un'azione desiderata ("dammi il titolo del post", "nascondi questo post", 
 * "iniettami un warning") senza specificare come viene fatte (che ovviamente dipende dalla piattaforma specifica su cui
 * si lavora e, pertanto, viene completamebte delegato al platform adapter concreto Reddit, Twitter, ...)
 */
class BasePlatformAdapter {

    /** @throws {Error} Se si prova a istanziare direttamente BasePlatformAdapter (astratta) */
    constructor() {
        if (new.target === BasePlatformAdapter) { throw new Error("[Architecture Violation] BasePlatformAdapter è astratta. Instanzia una sottoclasse (es. RedditPlatformAdapter).");}
    }

    /** @returns {boolean} Ritorna true se la pagina corrente è una pagina di elenco post su cui gli interventi "post-based" possono operare (es. risultati di ricerca) */
    isPostPage() { this._notImplemented("isPostPage"); }

    /** @returns {string} La query di ricerca corrente (stringa vuota se assente) */
    getCurrentSearchQuery() { this._notImplemented("getCurrentSearchQuery"); }

    /** @returns {string|null} Il nome del subreddit in cui ci troviamo (es. "r/politics"). Se siamo in una pagina generica con più subreddit (es. pagina dei risultati) ritorna null. */
    getCurrentCommunityScope() { this._notImplemented("getCurrentCommunityScope"); }

    /**
     * @param {Object} [options]
     * @param {boolean} [options.includeSynthetic=false] true se la lista di ritorno deve includere anche i post finti iniettati da noi
     * @returns {PostHandle[]} L'elenco dei post attualmente visibili nel DOM. */
    getVisiblePosts({ includeSynthetic = false } = {}) { this._notImplemented("getVisiblePosts"); }

    /** 
     * @param {PostHandle} post 
     * @returns {number} La posizione originale del post, prima di qualsiasi intervento. */
    getPostOriginalPosition(post) { this._notImplemented("getPostOriginalPosition"); }

    /** 
     * @param {PostHandle} post 
     * @returns {string} Testo del Titolo del post. */
    getPostTitle(post) { this._notImplemented("getPostTitle"); }

    /** 
     * @param {PostHandle} post 
     * @returns {string} URL di destinazione del post. */
    getPostUrl(post) { this._notImplemented("getPostUrl"); }

    /** 
     * @param {PostHandle} post 
     * @returns {string} Nome del subreddit/community di appartenenza. */
    getPostCommunity(post) { this._notImplemented("getPostCommunity"); }

    /** 
     * @param {PostHandle} post 
     * @returns {{votes: string, comments: string}} Numero di voti e numero di commenti del post. */
    getPostCounters(post) { this._notImplemented("getPostCounters"); }

    /**
     * Sovrascrive uno o più atributi di un post (l'oggetto fields ha tutti campi opzionali):
     * @param {PostHandle} post
     * @param {Object} fields
     * @param {string} [fields.title]
     * @param {string} [fields.url]
     * @param {string} [fields.community]
     * @param {string} [fields.communityIconUrl]
     * @param {string} [fields.communityUrl]
     * @param {string} [fields.avatarUrl]
     * @param {string} [fields.bodyText]
     * @param {string} [fields.imageUrl]
     * @param {string} [fields.date]
     * @param {string|number} [fields.votes]
     * @param {string|number} [fields.comments] */
    formatPost(post, fields) { this._notImplemented("formatPost"); }

    /**
     * Evidenzia un post con un bordo/sfondo (originariamente utilizzato  in ModifyPost per segnalare un contenuto).
     * @param {PostHandle} post
     * @param {{backgroundColor?: string, borderColor?: string}} style */
    applyPostHighlight(post, style) { this._notImplemented("applyPostHighlight"); }

    /**
     * Permette di aggiungere un qualsiasi nodo HTML (es. un warning) all'interno del post.
     * @param {PostHandle} post
     * @param {HTMLElement} warningElement */
    injectWarningNode(post, warningElement) { this._notImplemented("injectWarningNode"); }

    /** 
     * Nasconde completamente un post. 
     * @param {PostHandle} post */
    hidePost(post) { this._notImplemented("hidePost"); }

    /** 
     * Rende di nuovo visibile un post precedentemente nascosto. 
     * @param {PostHandle} post */
    revealPost(post) { this._notImplemented("revealPost"); }

    /**
     * Sposta un post in modo che occupi la targetPosition nell'elenco dei currentPosts.
     * @param {PostHandle} post
     * @param {number} targetPosition
     * @param {PostHandle[]} currentPosts
     * @returns {boolean} true se lo spostamento è andato a buon fine. */
    movePostToSlot(post, targetPosition, currentPosts) { this._notImplemented("movePostToSlot"); }

    /**
     * Simula uno scroll utente verso il basso per forzare il caricamento di ulteriori post.
     * @param {number} minCount La posizione a cui si vuole arrivare
     * @returns {Promise<void>}*/
    ensurePostsLoadedUpTo(minCount) { this._notImplemented("ensurePostsLoadedUpTo"); }

    /**
     * Crea un clone di un post reale completamente ripulito (senza titolo, descrizione, foto, etc...) pronto per essere riempito con attributi personalizzati della funzione formatPost
     * @returns {PostHandle|null} */
    createSyntheticPost() { this._notImplemented("createSyntheticPost"); }

    /**
     * Inserisce un post in una posizione specifica (quella subito prima di beforePost) e lo marca con un id personalizzato così da poter essere ritrovato facilmente da chiamate successive.
     * @param {PostHandle} syntheticPost
     * @param {PostHandle} beforePost
     * @param {string} syntheticId */
    insertSyntheticPost(syntheticPost, beforePost, syntheticId) { this._notImplemented("insertSyntheticPost"); }

    /** 
     * Restituisce un post identificato tramite il suo id personalizzato (se non è presente restituisce null).
     * @param {string} syntheticId 
     * @returns {PostHandle|null} Il post trovato, o null se non è presente. */
    findSyntheticPost(syntheticId) { this._notImplemented("findSyntheticPost"); }

    /**
     * Rimuove tutti i link ed interazioni del post originale (link, hovercard, popup) così da poter "sovrascrivere" e personalizzare quelle opzioni.
     * @param {PostHandle} post */
    neutralizeNativeNavigation(post) { this._notImplemented("neutralizeNativeNavigation"); }

    /** 
     * Mostra un banner in cima al feed. 
     * @param {{id:string, render:(container:HTMLElement)=>void, onDismiss?:Function}} bannerConfig */
    showPageBanner(bannerConfig) { this._notImplemented("showPageBanner"); }

    /** 
     * Rimuove il banner mostrato con showPageBanner. 
     * @param {string} id */
    removePageBanner(id) { this._notImplemented("removePageBanner"); }

    /** Nasconde il feed principale (usato per simulare un ritardo di caricamento nella generazione dinamica di contenuti con AI). */
    hideFeedContent() { this._notImplemented("hideFeedContent"); }

    /** Ripristina la visibilità del feed nascosto con hideFeedContent. */
    revealFeedContent() { this._notImplemented("revealFeedContent"); }

    /** 
     * Mostra un modale bloccante a schermo intero (es. per i survey pre/post esperimento). 
     * @param {{title:string, message:string, link:string, buttonText:string}} modalConfig */
    showBlockingModal(modalConfig) { this._notImplemented("showBlockingModal"); }

    /** Chiude il modale bloccante aperto con showBlockingModal. */
    hideBlockingModal() { this._notImplemented("hideBlockingModal"); }

    /**
     * Permette di aggiungere un azione ad un post (es. mandare telemetria + cambia pagina).
     * @param {PostHandle} post
     * @param {(interaction: {targetUrl: string|null, openInNewTab: boolean}) => void} onInteract
     * @param {{scope?: PostHandle, openInNewTab?: boolean, targetUrl?: string}} [options] */
    attachInteractionTelemetry(post, onInteract, options = {}) { this._notImplemented("attachInteractionTelemetry"); }

    /**
     * Osserva possibili cambiamenti nel feed o nella query di ricerca ed, eventualmente, richiama la callback.
     * @param {(reason: "MUTATION"|"QUERY_CHANGED") => void} callback
     * @returns {{disconnect: () => void}} */
    observeFeedChanges(callback) { this._notImplemented("observeFeedChanges"); }

    // ==========================================================================
    // Metodi Privati
    // ==========================================================================

    /** Metodo privato per segnalare che un metodo astratto non è stato implementato da una sottoclasse. */
    _notImplemented(methodName) {
        throw new Error(`[Architecture Violation] ${this.constructor.name} non implementa il metodo richiesto '${methodName}()' di BasePlatformAdapter.`);
    }
}