/**
 * @typedef {Object} InjectFakePostPayload
 * @property {string} [title]
 * @property {string} [subreddit]
 * @property {string} [subreddit_icon_url]
 * @property {string} [author]
 * @property {string} [content_text]
 * @property {string} [image_url]
 * @property {string} [target_url]
 * @property {string} [date]
 * @property {string} [votes]
 * @property {string} [comments]
 * @property {number} [new_position]
 * @property {boolean} [use_ai_generation]
 * @property {string} [ai_prompt_context]
 */
class InjectFakePostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super("injectFakePost"); 
        this.instancesState = {}; 
        this.injectHidingStyles();
        // iniettiamo subito gli stili CSS che usere per "nascondere" il feed ed i menu, dando l'idea di delay di caricamento
    }

    execute(payload, eventData) {
        
        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!this.isPostPage()) return false;

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = new URLSearchParams(window.location.search).get('q') || "";
        
        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        const activePayload = this.resolvePayload(initialQuery, payload, "post_data");
        if (!activePayload) return false;
        
        // recuperiamo la posizione dal config.json 
        const pos = activePayload.new_position || 1;
        
        // recuperiamo lo stato della singola istanza dell'intervento. utilizziamo la posizione di ogni post per 
        // differenziare le varie istanze, in questo modo possiamo inserire piu post sulla stessa ricerca
        const state = this.getState(pos);
        
        // aggiungiamo un MutationObserver per reinserire il post nel caso React lo rimuova per sbaglio
        const observerKey = `_bearInjectObserver_${pos}`;

        // se ci sono observer derivanti da iniezioni precedenti => li rimuoviamo
        if (window[observerKey]) { window[observerKey].disconnect(); }

        // se la query di ricerca è cambiata  => è stata fatta una nuova ricerca => resettiamo tutto
        if (state.lastQuery !== initialQuery) {
            this._resetState(state, initialQuery, observerKey);
        }

        // lanciamo la funzione per iniettare il fake post dopo pochi ms, per dare tempo a Reddit di caricare i risultati (in particolare il primo post, che è quello che cloniamo). 
        setTimeout(() => this.injectFakePost(activePayload, initialQuery, pos, state), 500);

        // aggiungiamo un MutationObserver che re-inserisce il post ogni volta che React ci cancella il post (es. quando carica nuovi chunk dei risultati)
        this._setupObserver(observerKey, initialQuery, pos, state, activePayload);
        
        // se dopo 8s l'ai  ancora non ha caricato il post => mostriamo il feed all'utente SENZA il fake post
        setTimeout(() => { 
            if (!state.contentRevealed) { 
                state.aiAborted = true;         
                state.aiFailed = true;          
                this.revealPageContent(state);  
            } 
        }, 8000);

        return true;
    }

    // ==========================================================================
    // INIEZIONE DEL FAKE POST (scorre il DOM, trova il primo post, lo clona, trova la new_position e poi DELEGA il lavoro)
    // ==========================================================================
   async injectFakePost(payload, initialQuery, pos, state) {  

        // se stiamo gia generando non accettiamo altre chiamate (in questo modo gli inserimenti statici avverranno dopo la generazione AI, evitando casini di mostra/nascondi continui del feed)
        if (state.isGenerating) return;

        // se la query attuale è diversa da quella iniziale (l'utente ha cambiato ricerca) => non facciamo nulla
        const currentQuery = new URLSearchParams(window.location.search).get('q');
        if (currentQuery !== initialQuery) return;

        // se abbiamo gia una fake post (nostro o dell'AI) iniettato => non facciamo nulla
        if (document.getElementById(`bear-fake-post-${pos}`) || document.getElementById(`bear-fake-post-ai-${pos}`) || state.aiFailed) return;
        
        // estriamo i riferimenti al DOM necessari per clonare/inserire il post 
        const domRefs = this._getDomReferences(pos);
        if (!domRefs) return;
        const { cloneWrapper, insertWrapper, mainFeedContainer } = domRefs;

        // finche non abbiamo i dati pronti => nascondiamo il feed
        this.hidePageContent(mainFeedContainer);
        
        // creiamo il clone "pulito" da tutti i campi e lo popoliamo con le funzioni specifiche (AI o STATIC)
        const { fakePost, divider } = this._createCleanClone(cloneWrapper, payload);
        if (payload.use_ai_generation) { 
            const scrapedPostsText = this._scrapeContext();
            await this.aiInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, scrapedPostsText); 
        } else {       
            this.staticInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state); 
        }

        // AGGIUNGERE QUI this.revealContent ??????
    }


    // ==========================================================================
    // INIEZIONE STATICA (SENZA AI)
    // ==========================================================================
    staticInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state) {
        
        // formattiamo il post con i dati letti dal config.json
        fakePost.id = `bear-fake-post-${pos}`;
        this.formatPost(
            fakePost, 
            payload.title || "Attenzione: Informazione Scientifica", 
            payload.subreddit || "r/SanitaPubblica", 
            payload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png", 
            payload.content_text || "Questo è un messaggio di debunking inserito dall'estensione.", 
            payload.image_url || null, 
            payload.target_url || null, 
            payload.date || null, 
            payload.votes || null, 
            payload.comments || null
        );

        // concludiamo l'iniezione rimuovendo i link, aggiungendo la telemetria e iniettando fisicamente il post
        this._finalizeInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, false);
    }

    // ==========================================================================
    // INIEZIONE AI
    // ==========================================================================
    async aiInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, scrapedPostsText) {

        state.isGenerating = true;
        try {
            
            // prendiamo i dati dalla "cache" (se esistono)
            let aiData = await this.retrieveAiData(initialQuery, payload, pos, state, scrapedPostsText);

            // se ci è stato detto di abortire => non facciamo nulla
            if (state.aiAborted) return;

            // se nel frattempo l'utente ha cambiato query di ricerca => usciamo senza fare nulla 
            const newQuery = new URLSearchParams(window.location.search).get('q');
            if (newQuery !== initialQuery) return;

            // se la generazione AI ha successo, aggiorniamo il post con i nuovi dati. 
            if (aiData) {
                
                Log.intervention(`Post AI Generato con successo (Posizione: ${pos})!`);
                
                // uniamo i dati dell'AI con quelli statici del config.json 
                const mergedPayload = { ...payload, ...aiData };

                // formattiamo il post
                fakePost.id = `bear-fake-post-${pos}`; 
                this.formatPost(
                    fakePost, mergedPayload.title, mergedPayload.subreddit, mergedPayload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png", 
                    mergedPayload.content_text, mergedPayload.image_url, mergedPayload.target_url, 
                    mergedPayload.date, mergedPayload.votes, mergedPayload.comments
                );

                // concludiamo l'iniezione rimuovendo i link, aggiungendo la telemetria e iniettando fisicamente il post
                this._finalizeInjection(fakePost, insertWrapper, mainFeedContainer, divider, mergedPayload, initialQuery, pos, state, true);

            } else {
                Log.error("Intervention", `Generazione AI fallita, rimozione post AI (Posizione: ${pos}).`);
                state.aiFailed = true;
            }
            
        } catch (error) {
            Log.error("Intervention", `Errore critico durante l'iniezione AI: ${error}`);
            state.aiFailed = true;

        } finally {
            state.isGenerating = false; 
            this.revealPageContent(state);    
        }
    }

    async retrieveAiData(initialQuery, payload, pos, state, scrapedPostsText) {

        // se abbiamo gia i dati in cache => restituiamo direttamente quelli
        if (state.cachedAiData) return state.cachedAiData; 
        
        // altrimenti, controlliamo se abbiamo i dati nella sessionStorage
        const cacheKey = `bear_ai_${initialQuery}_pos_${pos}`;
        const savedData = sessionStorage.getItem(cacheKey);
        if (savedData) {
            Log.intervention(`Dati AI recuperati dal Session Storage per Posizione ${pos}.`);
            state.cachedAiData = JSON.parse(savedData);
            return state.cachedAiData;
        }

        // se non abbiamo trovato i dati in nessuna cache => facciamo la chiamata API
        Log.intervention(`Nessuna cache trovata. Richiesta Post AI in corso per Posizione ${pos}...`);
        const basePrompt = payload.ai_prompt_context || "";
        const prompt = `${basePrompt}\n\nCONTESTO ATTUALE DELLA PAGINA (Usa questi titoli come ispirazione per mimetizzarti o smentirli):\n${scrapedPostsText}`;        
        const apiData = await ApiManager.generateAiPost(initialQuery, prompt);
        if (apiData) {
            state.cachedAiData = apiData;
            sessionStorage.setItem(cacheKey, JSON.stringify(apiData)); 
        }
        return state.cachedAiData;
    }


    // ==========================================================================
    // HELPER STATE MANAGEMENT
    // ==========================================================================

    // recupera lo stato dell'istanza dell'intervento (identificata tramite posizione). 
    getState(position) {

        // se non esiste uno'istanza per questa posizione => inizializza con i valori di default
        if (!this.instancesState[position]) {
            this.instancesState[position] = {
                lastQuery: "",
                telemetrySent: false,
                aiFailed: false,
                cachedAiData: null,
                contentRevealed: false,
                isGenerating: false,
                aiAborted: false
            };
        }
        return this.instancesState[position];
    }

    // resetta lo stato dell'istanza quando viene fatta una nuova ricerca (quindi cambia la query). 
    _resetState(state, initialQuery, observerKey) {
        state.telemetrySent = false;
        state.aiFailed = false;
        state.cachedAiData = null;
        state.contentRevealed = false;
        state.isGenerating = false;
        state.aiAborted = false;
        state.lastQuery = initialQuery;
    }

    // aggiunge un MutationObserver che re-inserisce il post ogni volta che React ci cancella il post (es. quando carica nuovi chunk dei risultati)
    _setupObserver(observerKey, initialQuery, pos, state, activePayload) {
        const observer = new MutationObserver((mutations) => {

            // se cambia la query di ricerca => disconnettiamo l'observer e usciamo 
            const currentQuery = new URLSearchParams(window.location.search).get('q');
            if (currentQuery !== initialQuery) { observer.disconnect(); return; }

            // altrimenti, se il post è stato rimosso e non stiamo generando l'AI => reinseriamo il post
            const isPostMissing = !document.getElementById(`bear-fake-post-${pos}`);
            if (isPostMissing && !state.aiFailed) {  this.injectFakePost(activePayload, initialQuery, pos, state); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window[observerKey] = observer;
    }

    // "finalizza" l'iniezione rimuovendo i link secondari, aggiungendo la telemetria e iniettando fisicamente il post nel DOM
    _finalizeInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, isAiGenerated) {
        
        // rimuove tutti i link del post originale non popolati da noi (es. subreddit, autore, ecc) 
        this._killAllLinks(fakePost);

        // aggiunge la telemetria per segnalare al backend quando l'utente clicca il nostro fake post
        this._attachClickTelemetry(fakePost, payload, initialQuery, pos, isAiGenerated);

        // iniezione fisica del post nel DOM
        mainFeedContainer.insertBefore(fakePost, insertWrapper);
        mainFeedContainer.insertBefore(divider, insertWrapper);

        // invia la telemetria per segnalare al backend che l'intervento è terminato
        this._sendTelemetry(payload.title, payload.subreddit, payload.target_url, initialQuery, pos, state);
        
        // concludiamo il "finto caricamento" mostrando la pagina all'utente
        this.revealPageContent(state);
    }


    // ==========================================================================
    // HELPER DOM
    // ==========================================================================

    _getDomReferences(pos) {

        // estraiamo i link ai post (escludendo quelli initettati da noi)
        const allTitleLinks = Array.from(document.querySelectorAll('a[data-testid="post-title"]')).filter(link => !link.closest('[id^="bear-fake-post"]'));
        if (allTitleLinks.length === 0) return null;

        // estraiamo il primo link (quello da clonare) ed il link di riferimento in cui effettuare l'inserimento
        const cloneReferenceLink = allTitleLinks[0];
        const insertReferenceLink = allTitleLinks[pos - 1] || allTitleLinks[allTitleLinks.length - 1];

        // estraiamo il container principale del feed 
        const mainFeedContainer = cloneReferenceLink.closest('main#main-content > div') || cloneReferenceLink.closest('div.bg-neutral-background');
        if (!mainFeedContainer) return null;

        // estriamo il wrapper da clonare
        let cloneWrapper = cloneReferenceLink;
        while (cloneWrapper.parentElement && cloneWrapper.parentElement !== mainFeedContainer) {
            cloneWrapper = cloneWrapper.parentElement;
        }

        // estraiamo il wrapper in cui effettuare l'inserimento 
        let insertWrapper = insertReferenceLink;
        while (insertWrapper.parentElement && insertWrapper.parentElement !== mainFeedContainer) {
            insertWrapper = insertWrapper.parentElement;
        }

        return { cloneWrapper, insertWrapper, mainFeedContainer };
    }

    // estrae i primi 7 post dei risultati di ricerca (escludendo quelli iniettati da noi) 
    _scrapeContext() {
        return Array.from(document.querySelectorAll('shreddit-post'))
            .filter(p => !p.id.includes('bear-fake-post'))
            .slice(0, 7) 
            .map(p => `- Subreddit: ${p.getAttribute('subreddit-prefixed-name')} | Titolo: ${p.getAttribute('post-title')}`)
            .join("\n");
    }

    _createCleanClone(postToCloneWrapper, payload) {

        // clona il primo post, rimuovendo tutti i dati specifici (testo, immagini, link, ecc) 
        const fakePost = postToCloneWrapper.cloneNode(true);
        const divider = document.createElement("hr");
        divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";

        // estraiamo e rimuoviamo tutti i media (immagini, video, ecc) del post originale
        const mediaElements = fakePost.querySelectorAll('img, video, picture, shreddit-post-image, faceplate-img');
        mediaElements.forEach(media => {
            if (!media.closest('span[avatar]') && !media.src?.includes('avatar') && !media.src?.includes('communityIcon')) {
                const wrapper = media.closest('div[data-testid="post-thumbnail"], .thumbnail'); 
                if (wrapper) wrapper.remove();
                else media.remove();
            }
        });

        // estraiamo e rimuoviamo l'avatar del subreddit originale
        const avatars = fakePost.querySelectorAll('img[src*="avatar"], img[src*="communityIcon"]');
        const defaultIcon = payload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png";
        avatars.forEach(img => {
            img.removeAttribute('srcset'); 
            img.src = defaultIcon;
        });

        // estraiamo e rimuoviamo la data del post originale
        const timeElements = fakePost.querySelectorAll('faceplate-timeago');
        timeElements.forEach(timeEl => {
            const fakeTimeSpan = document.createElement('span');
            fakeTimeSpan.className = timeEl.className;
            timeEl.innerHTML = ""; 
            timeEl.innerText = "2 mesi fa"; 
        });

        return { fakePost, divider };
    }

    // rimuove tutti i link del post originale non popolati da noi (es. subreddit, autore, ecc) 
    _killAllLinks(fakePost) {

        // prendiamo tutti i ink (tag <a>) e rimuoviamo i loro attributi cliccabili (<href>, target, ecc)
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

    // ==========================================================================
    // DELAY DI CARICAMENTO
    // ==========================================================================
    injectHidingStyles() {
        if (!document.getElementById("bear-curtain-style")) {
            const style = document.createElement("style");
            style.id = "bear-curtain-style";
            style.innerHTML = `
                .bear-feed-hidden, .bear-stagger-hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                .bear-fade-in {
                    animation: bearFadeIn 0.5s ease-in forwards;
                }
                @keyframes bearFadeIn { from { opacity: 0; } to { opacity: 1; } }
            `;
            document.head.appendChild(style);
        }
    }

    hidePageContent(mainFeedContainer) {
        if (!mainFeedContainer.classList.contains('bear-feed-hidden')) {
            mainFeedContainer.classList.add('bear-feed-hidden');
            
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

    revealPageContent(state) {
        state.contentRevealed = true;
        document.querySelectorAll('.bear-feed-hidden').forEach(feed => feed.classList.remove('bear-feed-hidden'));
        document.querySelectorAll('.bear-stagger-hidden').forEach(menu => menu.classList.remove('bear-stagger-hidden'));
    }

    // ==========================================================================
    // TELEMETRIA
    // ==========================================================================
    _attachClickTelemetry(fakePost, payload, initialQuery, pos, isAiGenerated) {
        const eventName = isAiGenerated ? "ClickOnAiGeneratedFakePost" : "ClickOnStaticFakePost";
        
        fakePost.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            ApiManager.addEventToQueue(`telemetry.events.${eventName}`, {
                search_query: initialQuery,
                post_position: pos,
                title: payload.title,
                subreddit: payload.subreddit,
            });
            
            if (payload.target_url) { window.open(payload.target_url, '_blank'); }
        }, { capture: true });
    }

    _sendTelemetry(title, subreddit, target_url, initialQuery, position, state) {
        if (!state.telemetrySent) {
            this.sendPostToBackend("INJECTED", initialQuery, position, title, subreddit, target_url);
            state.telemetrySent = true;
        }
    }
}

new InjectFakePostIntervention();