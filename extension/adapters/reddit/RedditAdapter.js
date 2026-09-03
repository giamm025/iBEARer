/**
 * @class RedditAdapter
 * @extends BasePlatformAdapter
 * @description
 * Espone i metodi che modificano o identificano la UI specifica di Reddit (es. funzione per estrarre, nascondere, riordinare i post) 
 */
class RedditAdapter extends BasePlatformAdapter {

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

    hideBlockingModal() {
        document.getElementById('reddit-cospiracy-survey-modal')?.remove();
        document.body.style.overflow = '';
    }

    attachInteractionTelemetry(post, onInteract, { scope = null, openInNewTab = false, targetUrl = null } = {}) {
        const component = scope || post;
        if (!component) return;

        component.addEventListener('click', (e) => {
            const path = e.composedPath();
            const isClickOnCommunityLink = path.some(el => el.dataset && el.dataset.bearIsSubLink);

            // se stiamo ascoltando sul post intero MA l'utente ha mirato al link della
            // community (che ha il proprio listener separato), lasciamo propagare l'evento.
            if (component === post && component.id?.startsWith('bear-fake-post') && isClickOnCommunityLink && scope === null) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            onInteract({ targetUrl, openInNewTab });
        }, { capture: true });
    }

    observeFeedChanges(callback) {
        const initialQuery = this.getCurrentSearchQuery();
        const observer = new MutationObserver((mutations) => {
            const currentQuery = this.getCurrentSearchQuery();
            if (currentQuery !== initialQuery) {
                observer.disconnect();
                callback("QUERY_CHANGED");
                return;
            }
            if (mutations.some(m => m.addedNodes.length > 0)) {
                callback("MUTATION");
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return { disconnect: () => observer.disconnect() };
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