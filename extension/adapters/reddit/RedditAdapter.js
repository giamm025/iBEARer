/**
 * @class RedditAdapter
 * @extends BasePlatformAdapter
 * @description Implementazione specifica per il DOM e la logica SPA di Reddit (shreddit-app).
 */
class RedditAdapter extends BasePlatformAdapter {
    
    /** 
     * @override 
     * @description Attende l'evento "EngineReady" e aggancia lo SpaWatcher ai cambiamenti di routing di React.
     */
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

    /** 
     * @override
     * @description Crea un overlay assoluto (z-index elevato) per bloccare l'UI di Reddit. 
     */    
    showModal(modalConfiguration) {

    constructor() {
        super();
        this._feedObserver = null;
        this._bannerObserver = null;
        this._dismissedBanners = new Set();
    }

    /** Avvia l'Adapter. Dovrebbe essere chiamato SOLO UNA VOLTA da main.js */
    run() {
        document.addEventListener("EngineReady", () => {
            Log.adapter("Avvio Reddit Adapter...");

            const notifyObservers = () => {
                if (window.ObserverRegistry) {
                    for (const observer of window.ObserverRegistry) observer.check();
                } else {
                    Log.adapter("Nessun Observer registrato.");
                }
            };

            SpaWatcher.watch(() => notifyObservers());
        });
    }

    isPostPage() {
        const tabType = new URLSearchParams(window.location.search).get('type');
        if (tabType && tabType !== 'posts' && tabType !== 'all') {
            Log.adapter(`[Reddit] Schermata incompatibile (type=${tabType}).`);
            return false;
        }
        return true;
    }

    getCurrentSearchQuery() {
        return new URLSearchParams(window.location.search).get('q') || "";
    }

    getCurrentCommunityScope() {
        const match = window.location.pathname.match(/^\/r\/([^/]+)\/search/i);
        return match ? `r/${match[1].toLowerCase()}` : null;
    }

    getVisiblePosts({ includeSynthetic = false } = {}) {

        // prendiamo tutti i titoli dei post
        const allTitleLinks = Array.from(document.querySelectorAll('a[data-testid="post-title"]'));
        const titleLinks = includeSynthetic
            ? allTitleLinks
            : allTitleLinks.filter(link => !link.closest('[id^="bear-fake-post"]'));

        // iteriamo su tutti i titoli per verificare se corrispondono a keyword o posizione
        const posts = [];
        titleLinks.forEach((titleLink, index) => {

            // estriamo posizione e testo del post
            const wrapper = this._getSinglePostWrapper(titleLink);
            if (!wrapper) return;

            // la prima volta che incontriamo un post gli aggiungiamo un attributo che indica la sua posizione ORIGINALE (prima dei nostri reranking)
            if (!wrapper.dataset.bearOriginalPos) { wrapper.dataset.bearOriginalPos = index + 1; }
            posts.push(wrapper);
        });
        return posts;
    }

    getPostOriginalPosition(post) {
        return parseInt(post.dataset.bearOriginalPos, 10);
    }

    getPostTitle(post) {
        const titleLink = post.querySelector('a[data-testid="post-title"]');
        const raw = titleLink ? (titleLink.innerText || titleLink.getAttribute('aria-label') || titleLink.textContent || "") : "";
        return raw.replace(/\s+/g, ' ').trim() || "Sconosciuto";
    }

    getPostUrl(post) {
        const titleLink = post.querySelector('a[data-testid="post-title"]');
        return titleLink ? titleLink.href : null;
    }

    getPostCommunity(post) {
        const subLink = Array.from(post.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
        return subLink ? subLink.innerText.trim() : "Sconosciuto";
    }

    getPostCounters(post) {
        const counterRow = post.querySelector('div[data-testid="search-counter-row"]');
        const result = { votes: "0", comments: "0" };
        if (!counterRow) return result;

        const faceplateNumbers = counterRow.querySelectorAll('faceplate-number');
        if (faceplateNumbers.length > 0) {
            result.votes = faceplateNumbers[0].getAttribute('pretty') || faceplateNumbers[0].textContent.trim();
        }
        if (faceplateNumbers.length > 1) {
            result.comments = faceplateNumbers[1].getAttribute('pretty') || faceplateNumbers[1].textContent.trim();
        } else if (faceplateNumbers.length === 0) {
            const spans = counterRow.querySelectorAll('span');
            const matchV = spans[0]?.innerText.match(/[\d.,kKMB]+/);
            const matchC = spans[2]?.innerText.match(/[\d.,kKMB]+/);
            if (matchV) result.votes = matchV[0];
            if (matchC) result.comments = matchC[0];
        }
        return result;
    }

    formatPost(post, fields = {}) {
        const { title, url, community, communityIconUrl, avatarUrl, bodyText, imageUrl, date, votes, comments } = fields;

        // A) Overlay che rende cliccabile l'area del titolo
        if (title || url) {
            const overlayLink = post.querySelector('a[data-testid="post-title"]');
            const visibleTitle = post.querySelector('a[data-testid="post-title-text"]');
            if (overlayLink) {
                if (url) overlayLink.href = url;
                if (title) {
                    overlayLink.setAttribute('aria-label', title);
                    overlayLink.innerHTML = `<faceplate-screen-reader-content>${title}</faceplate-screen-reader-content>`;
                }
            }

            // B) Il VERO Titolo Visibile
            if (visibleTitle) {
                if (url) visibleTitle.href = url;
                if (title) visibleTitle.innerText = title;
            }
        }

        // C) Modifichiamo il Subreddit (Escludendo i link che vanno ai commenti!)
        if (community) {
            Array.from(post.querySelectorAll('a[href*="/r/"]'))
                .filter(a => !a.href.includes('/comments/'))
                .forEach(link => {
                    if (url) link.href = "#";
                    const textSpan = link.querySelector('.truncate') || link;
                    textSpan.innerText = community;
                    link.dataset.bearIsSubLink = "true"; // usato internamente da attachInteractionTelemetry
                });
        }

        // D) Sostituiamo l'icona/avatar del subreddit
        if (communityIconUrl) {
            const avatarImg = post.querySelector('span[avatar] img') || post.querySelector('img[width="24"]');
            if (avatarImg) {
                avatarImg.src = communityIconUrl;
                avatarImg.style.backgroundColor = "transparent";
            }
        }

        // E) Aggiungiamo data
        if (date) {
            const timeContainer = post.querySelector('faceplate-timeago');
            if (timeContainer) {
                const customDateSpan = document.createElement('span');
                customDateSpan.innerText = date;
                timeContainer.replaceWith(customDateSpan);
            }
        }

        // F) Aggiungiamo numero commenti e numero voti
        if (votes !== undefined || comments !== undefined) {
            const counterRow = post.querySelector('div[data-testid="search-counter-row"]');
            if (counterRow) {
                const current = this.getPostCounters(post);
                const finalVotes = votes ?? current.votes;
                const finalComments = comments ?? current.comments;
                counterRow.innerHTML = `<span>${finalVotes} voti</span><span class="mx-2xs">·</span><span>${finalComments} commenti</span>`;
            }
        }

        // G) Inseriamo descrizione ed immagine del post
        if (bodyText || imageUrl) {
            this._setPostBody(post, bodyText, imageUrl);
        }
    }

    applyPostHighlight(post, { backgroundColor, borderColor } = {}) {
        const innerBox = post.querySelector('div[data-testid="search-post-with-content-preview"]')
            || post.querySelector('div[data-testid="search-post-unit"]')
            || post.firstElementChild;
        if (!innerBox) return;
        if (backgroundColor) innerBox.style.backgroundColor = backgroundColor;
        if (borderColor) innerBox.style.borderLeft = `4px solid ${borderColor}`;
    }

    injectWarningNode(post, warningElement) {
        const innerBox = post.querySelector('div[data-testid="search-post-with-content-preview"]')
            || post.querySelector('div[data-testid="search-post-unit"]')
            || post.firstElementChild;
        if (innerBox) innerBox.insertBefore(warningElement, innerBox.firstChild);
    }

    hidePost(post) {
        post.style.display = 'none';
        // Reddit inserisce un <hr> dopo ogni post nei risultati di ricerca: va nascosto
        // anche quello, altrimenti restano spazi vuoti "fantasma" nella UI.
        const nextSibling = post.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'HR') {
            nextSibling.style.display = 'none';
        }
    }

    revealPost(post) {
        post.style.display = '';
        const nextSibling = post.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'HR') {
            nextSibling.style.display = '';
        }
    }

    movePostToSlot(post, targetSlot, currentPosts) {
        const referencePost = currentPosts[targetSlot - 1];
        if (!referencePost || referencePost === post) return false;

        const container = referencePost.parentNode;
        const currentIndex = currentPosts.indexOf(post);
        const targetIndex = targetSlot - 1;
        if (currentIndex === -1) return false;

        try {
            if (currentIndex > targetIndex) {
                container.insertBefore(post, referencePost);
            } else {
                container.insertBefore(post, referencePost.nextSibling);
            }
            return true;
        } catch (e) {
            Log.error("RedditPlatformAdapter", "Errore durante movePostToSlot", e);
            return false;
        }
    }

    ensurePostsLoadedUpTo(minCount) {
        return new Promise((resolve) => {
            this.hideFeedContent();
            let attempts = 0;
            const maxAttempts = 20;
            const scrollInterval = setInterval(() => {
                const loaded = this.getVisiblePosts().length;
                if (loaded >= minCount || attempts >= maxAttempts) {
                    clearInterval(scrollInterval);
                    window.scrollTo(0, 0);
                    setTimeout(() => { this.revealFeedContent(); resolve(); }, 300);
                } else {
                    window.scrollTo(0, document.body.scrollHeight);
                    attempts++;
                }
            }, 300);
        });
    }

    createSyntheticPost() {
        const realPosts = this.getVisiblePosts();
        if (realPosts.length === 0) return null;

        const clone = realPosts[0].cloneNode(true);
        clone.removeAttribute('id');
        clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

        // rimuoviamo i media originali (immagini/video), preservando avatar/icone community
        clone.querySelectorAll('img, video, picture, shreddit-post-image, faceplate-img').forEach(media => {
            if (!media.closest('span[avatar]') && !media.src?.includes('avatar') && !media.src?.includes('communityIcon')) {
                const mediaWrapper = media.closest('div[data-testid="post-thumbnail"], .thumbnail');
                (mediaWrapper || media).remove();
            }
        });
        return clone;
    }

    insertSyntheticPost(syntheticPost, beforePost, syntheticId) {
        syntheticPost.id = syntheticId;
        const divider = document.createElement("hr");
        divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";
        const container = beforePost.parentNode;
        container.insertBefore(syntheticPost, beforePost);
        container.insertBefore(divider, beforePost);
    }

    findSyntheticPost(syntheticId) {
        return document.getElementById(syntheticId);
    }

    neutralizeNativeNavigation(post) {
        post.querySelectorAll('a').forEach(link => {
            link.removeAttribute("href");
            link.removeAttribute("target");
            link.removeAttribute("aria-haspopup");
            link.removeAttribute("aria-expanded");
            link.onclick = (e) => e.preventDefault();
        });
        post.querySelectorAll('faceplate-hovercard').forEach(card => {
            card.querySelector('[slot="content"]')?.remove();
            card.removeAttribute('enter-delay');
            card.removeAttribute('data-id');
            card.removeAttribute('label');
        });
        post.style.cursor = "pointer";
    }

    showPageBanner({ id, render, onDismiss }) {
        if (document.getElementById(id)) return;

        const redditContainer = document.querySelector("shreddit-app .grid-container");
        if (!redditContainer || !redditContainer.parentNode) return;

        const banner = document.createElement("div");
        banner.id = id;
        render(banner, () => {
            this._dismissedBanners.add(id);
            banner.remove();
            if (onDismiss) onDismiss();
        });
        redditContainer.parentNode.insertBefore(banner, redditContainer);

        // Reddit ricarica spesso lo shell React: se il banner sparisce e non è stato
        // chiuso volontariamente dall'utente, lo re-iniettiamo.
        if (this._bannerObserver) this._bannerObserver.disconnect();
        this._bannerObserver = new MutationObserver(() => {
            if (!this._dismissedBanners.has(id) && !document.getElementById(id)) {
                const container = document.querySelector("shreddit-app .grid-container");
                if (container?.parentNode) container.parentNode.insertBefore(banner, container);
            }
        });
        this._bannerObserver.observe(document.body, { childList: true, subtree: true });
    }

    removePageBanner(id) {
        document.getElementById(id)?.remove();
        this._bannerObserver?.disconnect();
        this._bannerObserver = null;
    }

    hideFeedContent() {
        this._injectHidingStylesOnce();
        const container = document.querySelector('shreddit-feed') || document.querySelector('main') || document.body;
        if (container.classList.contains('bear-feed-hidden')) return;
        container.classList.add('bear-feed-hidden');

        const upperMenu = document.querySelector('reddit-sidebar-nav, #left-sidebar-container, nav');
        const leftMenu = document.querySelector('#left-sidebar, reddit-sidebar-nav, #left-sidebar-container');
        const rightMenu = document.querySelector('[slot="right-sidebar"], right-sidebar, #right-sidebar-container, aside');
        [upperMenu, leftMenu, rightMenu].forEach(el => el?.classList.add('bear-stagger-hidden'));

        setTimeout(() => upperMenu?.classList.remove('bear-stagger-hidden'), 1500);
        setTimeout(() => rightMenu?.classList.remove('bear-stagger-hidden'), 3000);
        setTimeout(() => leftMenu?.classList.remove('bear-stagger-hidden'), 3500);
    }

    revealFeedContent() {
        document.querySelectorAll('.bear-feed-hidden').forEach(el => el.classList.remove('bear-feed-hidden'));
        document.querySelectorAll('.bear-stagger-hidden').forEach(el => el.classList.remove('bear-stagger-hidden'));
    }

    showBlockingModal({ title, message, link, buttonText }) {
        if (document.getElementById('reddit-cospiracy-survey-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'reddit-cospiracy-survey-modal';
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); z-index: 9999999; display: flex; justify-content: center;
            align-items: center; font-family: Arial, sans-serif; backdrop-filter: blur(5px);`;

        const box = document.createElement('div');
        box.style.cssText = `background: white; padding: 40px; border-radius: 12px; text-align: center;
            max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);`;
        box.innerHTML = `
            <h2 style="color:#1a1a1b;margin-top:0;font-size:24px;">${title}</h2>
            <p style="color:#444;font-size:16px;line-height:1.6;margin-bottom:30px;">${message}</p>
            <a href="${link}" target="_blank" style="background:#ff4500;color:white;padding:14px 28px;
                text-decoration:none;font-weight:bold;border-radius:999px;font-size:16px;
                display:inline-block;cursor:pointer;">${buttonText}</a>`;

        modal.appendChild(box);
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    /** 
     * @override
     * @description Chiude il Modale aperto con showModal() e ripristina lo scroll della pagina. 
     */
    hideModal() {
        const modal = document.getElementById('reddit-cospiracy-survey-modal');
        if (modal) modal.remove();
        document.body.style.overflow = ''; 
    }

    // =======================================================================
    // MANIPOLAZIONE POST
    // =======================================================================
    
    /** 
     * @override
     * @description Su Reddit, gli interventi sono validi solo se l'URL parameter 'type' è 'posts', 'all' o nullo. 
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

    /** 
     * @override
     * @description Nasconde sia lo shreddit-post che il tag <hr> (per evitare spazi vuoti nel feed) con display: none.
     */
    hidePost(postWrapper) {

        // nascondiamo il post principale 
        postWrapper.style.display = 'none';
        
        // nascondiamo anche l'hr sottostante per evitare brutti spazi vuoti nella UI.
        const nextSibling = postWrapper.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'HR') nextSibling.style.display = 'none';
    }

    /** 
     * @override
     * @description Trova l'inner-box usando data-testid="search-post-unit" per applicare il colore senza sbordare.
     */
    applyHighlightToPost(postWrapper, highlightColor) {
        if (!highlightColor) { Log.Error("highlightColor is required"); return; }
        const innerBox = this._getInnerBox(postWrapper);
        if (innerBox) {
            innerBox.style.backgroundColor = highlightColor;
        }
    }

    /** 
     * @override
     * @description Applica un bordo colorato al post.
     */
    applyBorderToPost(postWrapper, borderColor) {
        if (!borderColor) { Log.Error("borderColor is required"); return; }
        const innerBox = this._getInnerBox(postWrapper);
        if (innerBox) {
            innerBox.style.borderLeft = `4px solid ${borderColor}`;
        }
    }

    /** @override
     * @description Interviene sui web-components di Reddit (es. faceplate-timeago, faceplate-number) per iniettare le fake-info senza rompere i listener React.
     */
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

    /** 
     * @override
     * @description Rileva i post reali di Reddit ignorando gli elementi con id che inizia per "bear-fake-post".
     */
    getRealPosts() {
        const allTitles = document.querySelectorAll('a[data-testid="post-title"]');
        return Array.from(allTitles).filter(link => !link.closest('[id^="bear-fake-post"]'));
    }

    /** 
     * @override
     * @description Restituisce l'array di tutti i titoli dei post (compresi quelli fittizi iniettati da noi).
     */
    getAllPosts() {
        return Array.from(document.querySelectorAll('a[data-testid="post-title"]'))
    }

    /** 
     * @override
     * @description Legge la stringa di ricerca dal parametro 'q' dell'URL di Reddit.
     */
    getCurrentSearchQuery() {
        return new URLSearchParams(window.location.search).get('q') || ""
    }

    /** 
     * @override
     * @description Ricalcola il target usando insertBefore() nel parent 'shreddit-feed' o 'main-content'.
     */
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

    /** 
     * @override
     * @description Inietta un CSS temporaneo che oscura il feed (per evitare sfarfallii) ed esegue scroll lenti e distanziati per non allarmare l'anti-scraping di Reddit (ReCAPTCHA timeout).
     */
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

    /** @override */
    getDomReferences(pos, countInjectedPosts = true) {
        
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

    /** 
     * @override
     * @description Isola i primi 7 <shreddit-post> leggendo i loro attributi shadow-dom.
     */
    scrapeContext() {
        return Array.from(document.querySelectorAll('shreddit-post'))
            .filter(p => !p.id.includes('bear-fake-post'))
            .slice(0, 7) 
            .map(p => `- Subreddit: ${p.getAttribute('subreddit-prefixed-name')} | Titolo: ${p.getAttribute('post-title')}`)
            .join("\n");
    }

    /** 
     * @override
     * @description Spoglia il nodo degli id nativi e rimuove i tag 'shreddit-post-image' e 'faceplate-img' nativi di Reddit.
     */
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

    /** 
     * @override
     * @description Rimuove attributi aria-* specifici di Reddit e neutralizza i popup 'faceplate-hovercard' sulle informazioni autore.
     */
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

    /** 
     * @override
     * @description Valuta se ci troviamo in una ricerca confinata a un sub (es. /r/politics/search) scartando i payload di altri subreddit.
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
     * @override
     * @description Ancóra il banner prima del nodo 'shreddit-app .grid-container'.
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
     * @override
     * @description Verifica se l'utente si trova ancora sulla pagina dei risultati per la query originale.
     * Utile per le SPA (Single Page Applications) che aggiornano l'URL senza ricaricare il DOM.
     */
    isSameSearchPage(expectedQuery) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentQuery = urlParams.get('q') ? urlParams.get('q').toLowerCase() : "";
        
        return window.location.pathname.includes('/search') && currentQuery === expectedQuery.toLowerCase();
    }

    /** 
     * @override
     * @description Controlla se il contenitore target per il banner è già stato renderizzato nel DOM.
     */
    isBannerTargetReady() {
        const redditContainer = document.querySelector("shreddit-app .grid-container");
        return redditContainer && redditContainer.parentNode;
    }

    // =======================================================================
    // TELEMETRIA: CONTESTO & CLICK
    // =======================================================================

    /** 
     * @override
     * @description Verifica se l'utente si trova nella home page della piattaforma
     */
    isHomePage() {
        return window.location.pathname === '/';
    }

    /** 
     * @override
     * @description Verifica se l'utente si trova nella pagina dei risultati di ricerca con una query valida.
     */
    isSearchPage() {
        const urlParams = new URLSearchParams(window.location.search);
        return window.location.pathname.includes('/search') && urlParams.has('q');
    }

    /** 
     * @override
     * @description Identifica i post verificando la presenza di '/comments/' nel percorso.
     */
    isPostUrl(url) {
        return Boolean(url && url.includes('/comments/'));
    }

    /** 
     * @override
     * @description Risale il DOM per trovare il titolo e il Subreddit dai componenti specifici (es. data-testid="post-title").
     */
    getPostDetails(node) {
        
        // estraiamo il wrapper del post
        const postWrapper = this._getPostWrapper(node) || node;
        
        // estriamo il titolo
        let rawTitle = postWrapper.getAttribute('post-title') || node.getAttribute('aria-label') || node.innerText || "";
        const title = rawTitle.replace(/\s+/g, ' ').trim() || "Sconosciuto";
        
        // estriamo il subreddit
        const validSubLink = Array.from(postWrapper.querySelectorAll('a[href*="/r/"]')).find(a => !a.href.includes('/comments/'));
        const subreddit = validSubLink ? validSubLink.innerText.trim() : "Sconosciuto";

        // estraiamo l'url del post (fallback al link del titolo se non presente)
        const url = node.href || postWrapper.querySelector('a[data-testid="post-title"]')?.href || "";

        return { title, url, subreddit, postWrapper };
    }

    // =======================================================================
    // SCRAPING RISULTATI (Platform-Specific)
    // =======================================================================

    /** 
     * @override
     * @description Direziona lo scraping specifico (Post, Community, Commenti, Utenti) valutando il parametro URL 'type' tipico della ricerca Reddit.
     */
    scrapePageResults() {

        // estraiamo il parametro "type" per capire quale tab è aperto (es. posts, communities, people, comments)
        const urlParams = new URLSearchParams(window.location.search);
        const tabType = urlParams.get('type') || "all";
        let rawResults = [];

        switch (tabType) {
            case "all":
            case "posts":
            case "media":
                rawResults = this._scrapePosts();
                break;

            case "communities":
                rawResults = this._scrapeCommunities(); 
                break;

            case "comments":
                rawResults = this._scrapeComments();
                break;

            case "people":
                rawResults = this._scrapePeople();
                break;

            default:
                Log.adapter(`ResultsLoadedObserver: Tab type '${tabType}' sconosciuto o non tracciato.`);
                break;
        }
        return rawResults;
    }

    _scrapePosts() {
        const titleLinks = document.querySelectorAll('a[data-testid="post-title"]');
        const results = [];
        titleLinks.forEach((link) => {
            const url = link.href.split('?')[0].split('#')[0]; 
            if (!url || url.includes('/comment/')) return; 
            
            const title = link.innerText.replace(/\s+/g, ' ').trim();
            const subMatch = url.match(/\/r\/([^\/]+)\/comments\//i);
            const subreddit = subMatch ? "r/" + subMatch[1] : "";

            results.push({ type: "POST", title, url, subreddit, content_text: "" });
        });
        return results;
    }

    _scrapeCommunities() {
        const communityBlocks = document.querySelectorAll('div[data-testid="search-community"]');
        const results = [];
        communityBlocks.forEach((block) => {
            const link = block.querySelector('a[href^="/r/"]');
            if (!link) return;

            const url = link.href.split('?')[0].split('#')[0];
            const titleElement = block.querySelector('h2');
            let communityName = titleElement ? titleElement.innerText.trim() : "";
            
            if (!communityName) {
                const subMatch = url.match(/\/r\/([^\/]+)/i);
                communityName = subMatch ? "r/" + subMatch[1] : "Comunità Sconosciuta";
            }

            const subreddit = communityName.startsWith("r/") ? communityName : "";
            results.push({ type: "COMMUNITY", title: communityName, url, subreddit, content_text: "" });
        });
        return results;
    }

    _scrapeComments() {
        const commentBlocks = document.querySelectorAll('div[data-testid="search-sdui-comment-unit"]');
        const results = [];
        commentBlocks.forEach((block) => {
            const commentLink = block.querySelector('a[aria-labelledby^="comment-content-"]');
            if (!commentLink) return;

            const url = commentLink.href.split('?')[0].split('#')[0];
            const postTitleElement = block.querySelector('h2.i18n-search-comment-post-title');
            const postTitle = postTitleElement ? postTitleElement.innerText.trim() : "Titolo Sconosciuto";

            const commentContentElement = block.querySelector('.i18n-search-comment-content');
            const commentText = commentContentElement ? commentContentElement.innerText.trim() : "";

            const subMatch = url.match(/\/r\/([^\/]+)/i);
            const subreddit = subMatch ? "r/" + subMatch[1] : "";

            results.push({ type: "COMMENT", title: postTitle, url, subreddit, content_text: commentText });
        });
        return results;
    }

    _scrapePeople() {
        const peopleBlocks = document.querySelectorAll('div[data-testid="search-author"]');
        const results = [];
        peopleBlocks.forEach((block) => {
            const link = block.querySelector('a[href^="/user/"]');
            if (!link) return;

            const url = link.href.split('?')[0].split('#')[0];
            const titleElement = block.querySelector('h2');
            let username = titleElement ? titleElement.innerText.trim() : "";
            
            if (!username) {
                const userMatch = url.match(/\/user\/([^\/]+)/i);
                username = userMatch ? "u/" + userMatch[1] : "Utente Sconosciuto";
            }

            const descElement = block.querySelector('p[data-testid="search-subreddit-desc-text"]');
            const description = descElement ? descElement.innerText.trim() : "";

            results.push({ type: "PERSON", title: username, url, subreddit: "", content_text: description });
        });
        return results;
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

    // ==========================================================================
    // Metodi Privati
    // ==========================================================================

    //metodo ricorsivo per trovare il wrapper esatto di un singolo post. Risaliamo la gerarchia dei post finche raggiungiamo:
    //      1) il feed principale (shreddit-feed) o il contenitore principale dei post (main-content)
    //      2) un oggetto che contiene più titoli (sisgnifica che non è un singolo post, ma un insieme di post)
    // in tutti gli altri casi, andiamo in ricorsione verso l'alto fino a trovare il wrapper corretto
    _getSinglePostWrapper(titleLink) {

        let current = titleLink.closest('shreddit-post') || titleLink.closest('article') || titleLink;
        while (current.parentElement) {
            const parent = current.parentElement;
            if (parent.tagName === 'SHREDDIT-FEED' || parent.id === 'main-content') return current;
            if (parent.querySelectorAll('a[data-testid="post-title"]').length > 1)  return current;
            current = parent;
        }
        return current;
    }

    _setPostBody(post, bodyText, imageUrl) {
        const textColumn = post.querySelector('div[data-testid="sdui-post-unit"]');
        const innerBox = post.querySelector('div[data-testid="search-post-with-content-preview"]')
            || post.querySelector('div[data-testid="search-post-unit"]')
            || post.firstElementChild;
        const counterRow = post.querySelector('div[data-testid="search-counter-row"]');

        if (textColumn) {
            const oldSnippet = textColumn.querySelector('search-telemetry-tracker[click-events="search/click/post"] a.text-14') || textColumn.lastElementChild;
            if (oldSnippet && oldSnippet !== counterRow) oldSnippet.remove();

            if (bodyText) {
                textColumn.querySelector('.bear-custom-text-box')?.remove();
                const box = document.createElement("div");
                box.className = "bear-custom-text-box";
                box.style.cssText = "margin-top:2px;margin-bottom:6px;font-size:14px;line-height:1.4;color:var(--color-neutral-content-strong);";
                const p = document.createElement("p");
                p.innerText = bodyText;
                p.style.margin = "0";
                box.appendChild(p);
                if (counterRow?.parentElement) counterRow.parentElement.insertBefore(box, counterRow);
                else textColumn.appendChild(box);
            }
        }

        if (imageUrl && innerBox) {
            innerBox.querySelectorAll('img').forEach(img => {
                if (img.closest('span[avatar]')) return;
                let node = img;
                while (node.parentElement && node.parentElement !== innerBox) node = node.parentElement;
                (node !== textColumn && node !== counterRow ? node : img).remove();
            });
            innerBox.style.alignItems = "flex-start";
            if (textColumn) textColumn.style.paddingRight = "16px";

            const wrapper = document.createElement("div");
            wrapper.style.cssText = "flex-shrink:0;margin-left:auto;";
            const img = document.createElement("img");
            img.src = imageUrl;
            img.style.cssText = "width:120px;height:95px;object-fit:cover;border-radius:8px;margin:0;margin-top:4px;";
            wrapper.appendChild(img);
            innerBox.appendChild(wrapper);
        }
    }

    _injectHidingStylesOnce() {
        if (document.getElementById("bear-curtain-style")) return;
        const style = document.createElement("style");
        style.id = "bear-curtain-style";
        style.innerHTML = `
            .bear-feed-hidden, .bear-feed-hidden > * { opacity: 0 !important; pointer-events: none !important; }
            .bear-stagger-hidden { opacity: 0 !important; pointer-events: none !important; }
            .bear-fade-in { animation: bearFadeIn 0.5s ease-in forwards; }
            @keyframes bearFadeIn { from { opacity: 0; } to { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
}