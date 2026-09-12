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
    run() { this._notImplemented('run'); }

    // =======================================================================
    // MANIPOLAZIONE QUESTIONARI
    // =======================================================================
    showModal(modalConfiguration) { this._notImplemented('showModal'); }
    hideModal() { this._notImplemented('hideModal'); }

    // =======================================================================
    // MANIPOLAZIONE POST
    // =======================================================================
    isValidInterventionPage() { this._notImplemented('isValidInterventionPage'); }
    hidePost(postWrapper) { this._notImplemented('hidePost'); }
    applyHighlightToPost(postWrapper, highlightColor) { this._notImplemented('applyHighlightToPost'); }
    applyBorderToPost(postWrapper, borderColor) { this._notImplemented('applyBorderToPost'); }
    formatPost(postNode, payload) { this._notImplemented('formatPost'); }

    // =======================================================================
    // RERANKING & SCROLLING
    // =======================================================================
    getCurrentSearchQuery() { this._notImplemented('getCurrentSearchQuery'); }
    movePost(targetWrapper, newPosSlot) { this._notImplemented('movePost'); }
    forceGhostScroll(targetPos) { this._notImplemented('forceGhostScroll'); }

    // =======================================================================
    // INIEZIONE FAKE POST
    // =======================================================================
    getDomReferences(pos, countInjectedPosts = true) { this._notImplemented('getInjectionReferences'); }
    scrapeContext() { this._notImplemented('scrapeContext'); }
    createCleanClone(postToCloneWrapper) { this._notImplemented('createCleanClone'); }
    sanitizeFakePostLinks(fakePost) { this._notImplemented('sanitizeFakePostLinks'); }
    filterPlatformSpecificPayloads(payloads) { this._notImplemented('filterPlatformSpecificPayloads'); }

    // =======================================================================
    // BANNER DI DEBUNKING
    // =======================================================================
    insertDebunkingBanner(bannerElement) { this._notImplemented('insertDebunkingBanner'); }
    isSameSearchPage(expectedQuery) { this._notImplemented('isSameSearchPage'); }
    isBannerTargetReady() { this._notImplemented('isBannerTargetReady'); }

    // =======================================================================
    // TELEMETRIA: CONTESTO & CLICK
    // =======================================================================
    isHomePage() { this._notImplemented('isHomePage'); }
    isSearchPage() { this._notImplemented('isSearchPage'); }
    isPostUrl(url) { this._notImplemented('isPostUrl'); }
    getPostDetails(node) { this._notImplemented('getPostDetails'); }

    // =======================================================================
    // SCRAPING RISULTATI
    // =======================================================================
    scrapePageResults() { this._notImplemented('scrapePageResults'); }

    // =======================================================================
    // HELPER INTERNO
    // =======================================================================
    _notImplemented(methodName) {
        throw new Error(`[Architecture Violation] Il metodo '${methodName}()' non è stato implementato dall'Adapter corrente.`);
    }
}
