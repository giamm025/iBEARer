// EDIT: piuttosto che impazzire creando un vero e proprio post con i tag di reddit e tutto quanto (che se un domani cambiano 
// nemmeno funzionerebbe piu), conviene CLONARE un post già esistente (es. prendiamo il primo post, lo cloniamo e cambiamo gli attriobuti)


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
 */
class InjectFakePostIntervention extends PostProcessorIntervention {
    
    constructor() {
        super("injectFakePost"); 
        this.instancesState = {}; 

        // chiamiamo il metodo per "nascondere il feed" finche l'ai non ci genera il fake post
        this.injectHidingStyles();
    }

    // metodo per nascondere il feed finche l'ai non ci genera il fake post
    injectHidingStyles() {
        if (!document.getElementById("bear-curtain-style")) {
            const style = document.createElement("style");
            style.id = "bear-curtain-style";
            style.innerHTML = `
                .bear-feed-hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                .bear-stagger-hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                .bear-fade-in {
                    animation: bearFadeIn 0.5s ease-in forwards;
                }
                @keyframes bearFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // metodo per "abbassare il sipario" (nascondere) il feed originale 
    hidePageContent(mainFeedContainer) {

        // se il feed non è già nascosto => nascondiamolo
        if (!mainFeedContainer.classList.contains('bear-feed-hidden')) {
            mainFeedContainer.classList.add('bear-feed-hidden');
            
            // cerchiamo i menu laterali usando tag specifici di Reddit
            const upperMenu = document.querySelector('reddit-sidebar-nav, #left-sidebar-container, nav');
            const leftMenu = document.querySelector('#left-sidebar, reddit-sidebar-nav, #left-sidebar-container');
            const rightMenu = document.querySelector('[slot="right-sidebar"], right-sidebar, #right-sidebar-container, aside');

            // nascondiamo i menu laterali
            if (upperMenu) upperMenu.classList.add('bear-stagger-hidden');
            if (leftMenu) leftMenu.classList.add('bear-stagger-hidden');
            if (rightMenu) rightMenu.classList.add('bear-stagger-hidden');

            // mostriamo il menu sinistro dopo 1.5 secondi
            setTimeout(() => {
                if (upperMenu) upperMenu.classList.remove('bear-stagger-hidden');
            }, 1500); 

            // mostriamo il menu destro dopo 3 secondi
            setTimeout(() => {
                if (rightMenu) rightMenu.classList.remove('bear-stagger-hidden');
            }, 3000); 

            setTimeout(() => {
                if (leftMenu) leftMenu.classList.remove('bear-stagger-hidden');
            }, 4000); 
        }
    }

    // metodo per "alzare il sipario" (mostrare) il feed originale
    revealPageContent(state) {
        state.contentRevealed = true;
        
        // rendiamo visibile il feed centrale
        const hiddenFeeds = document.querySelectorAll('.bear-feed-hidden');
        hiddenFeeds.forEach(feed => feed.classList.remove('bear-feed-hidden'));

        // inoltre, se la chiamata all'AI fallisce o termina prima del previsto => mostriamo anche i menu laterali subito
        const hiddenMenus = document.querySelectorAll('.bear-stagger-hidden');
        hiddenMenus.forEach(menu => menu.classList.remove('bear-stagger-hidden'));
    }

    // metodo helper per ottenere lo stato di un singolo intervento in base alla posizone (es. se applichiamo piu fake post alla stessa ricerca)
    getState(position) {

        // se non esiste uno stato per questa posizione => stiamo applicando un nuovo intervento => creiamo un'istanza con stato di default
        if (!this.instancesState[position]) {
            this.instancesState[position] = {
                lastQuery: "",
                telemetrySent: false,
                aiFailed: false,
                cachedAiData: null,
                contentRevealed: false,
                isGenerating: false
            };
        }

        // altrimenti (abbiamo trovat l'istanza) => restituiamo
        return this.instancesState[position];
    }

    execute(payload, eventData) {

        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!this.isPostPage()) { return false; } 

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = new URLSearchParams(window.location.search).get('q') || "";
        
        // recuperiamo la posizione dal config.json e lo stato della singola istanza
        const pos = payload.new_position || 1;
        const state = this.getState(pos);

        // aggiungiamo un MutationObserver per reinserire il post nel caso React lo rimuova per sbaglio
        // EDIT: differenziamo ogni chiave usando la posizione in cui inseriremo il fakePost. questo di permettera di inserire piu post sulla stessa ricerca
        const observerKey = `_bearInjectObserver_${pos}`;

        // se ci sono observer derivanti da iniezioni precedenti => li rimuoviamo
        if (window[observerKey]) { window[observerKey].disconnect(); }

        // se la query di ricerca è cambiata  => è stata fatta una nuova ricerca => resettiamo tutto
        if (state.lastQuery !== initialQuery) {
            
            // resettiamo il flag della telemetria per questa ricerca
            state.telemetrySent = false;

            // resettiamo il flag che ci avverte quando la generazione AI fallisce (per evitare che il backend mandi richieste all'infinito (consumando token che poi io pago :,)
            state.aiFailed = false;

            // resettiamo la cache dei dati generati dall'AI (per evitare di mostrare dati di ricerche passate)
            state.cachedAiData = null;

            // resettiamo il flag per nascondere il feed
            state.contentRevealed = false;

            // resettiamo il flag che indica se stiamo aspettando la generazione dell'AI 
            state.isGenerating = false;

            // aggiorniamo l'ultima query salvata
            state.lastQuery = initialQuery;
        }

        // aggiungiamo un timer di sicurezza per cui: se l'ai dopo 5 sec ancora non ha caricato il post mostriamo il feed all'utente SENZA il fake post
        setTimeout(() => { if (!state.contentRevealed) this.revealPageContent(state); }, 150000)

        // facciamo un primo tentativo dopo un timer di pochi ms per dare tempo a Reddit di caricare i risultati (in particolare il primo post, che è quello che cloniamo). 
        setTimeout(() => this.injectFakePost(payload, initialQuery, pos, state), 500);

        // MutationObserver: se React carica nuovi dati e ci cancella il post, lo rimettiamo
        const observer = new MutationObserver((mutations) => {
            
            // estraiamo la query di ricerca attuale
           const currentQuery = new URLSearchParams(window.location.search).get('q');
            
           // se la query attuale è diversa a quella iniziale => abbiamo cambiato pagina => disconnettiamo l'observer e usciamo
            if (currentQuery !== initialQuery) { observer.disconnect(); return; }

            // altrimenti, se il post è stato rimosso (e l'ai non ha fallito) => lo reinseriamo
            const isPostMissing = !document.getElementById(`bear-fake-post-${pos}`);
            if (isPostMissing && !state.aiFailed) { this.injectFakePost(payload, initialQuery, pos, state); }
        });

        // avviamo l'observer
        observer.observe(document.body, { childList: true, subtree: true });
        window[observerKey] = observer;
        return true;
    }

    // ------------------------------------- DECISORE (deleghera all funzioni specifiche) -------------------------------------
    // metodo principale che fa i controlli DOM, clona e poi DELEGA il lavoro
    async injectFakePost(payload, initialQuery, pos, state) {  

        // se stiamo gia generando non accettiamo altre chiamate
        if (state.isGenerating) return;

        // se la query attuale è diversa da quella iniziale (l'utente ha cambiato ricerca) => non facciamo nulla
        const currentQuery = new URLSearchParams(window.location.search).get('q');
        if (currentQuery !== initialQuery) return;

        // se abbiamo gia una fake post (nostro o dell'AI) iniettato => non facciamo nulla
        if (document.getElementById(`bear-fake-post-${pos}`) || document.getElementById(`bear-fake-post-ai-${pos}`) || state.aiFailed) return;
        
        // estraiamo il primo post (quello che cloneremo) escludendo quelli che abbiamo gia iniettato noi 
        const allTitleLinks = Array.from(document.querySelectorAll('a[data-testid="post-title"]'));
        const firstTitleLink = allTitleLinks.find(link => !link.closest('[id^="bear-fake-post"]'));
        if (!firstTitleLink) return;

        // estriamo il container principale dove sono tutti i post 
        const mainFeedContainer = firstTitleLink.closest('main#main-content > div') || firstTitleLink.closest('div.bg-neutral-background');
        if (!firstTitleLink || !mainFeedContainer) return;

        // se c'è il main feed ma non abbiamo ancora i dati dell'ai => nascondiamo il feed
        if (mainFeedContainer && !state.contentRevealed) { this.hidePageContent(mainFeedContainer); }

        // prendiamo i primi 7 post visibili (escludendo quelli che abbiamo gia iniettato noi) per darli in pasto all'AI e farci generare il nostro post finto
        const scrapedPostsText = Array.from(document.querySelectorAll('shreddit-post'))
            .filter(p => !p.id.includes('bear-fake-post')) // Escludiamo i nostri post
            .slice(0, 7) 
            .map(p => `- Subreddit: ${p.getAttribute('subreddit-prefixed-name')} | Titolo: ${p.getAttribute('post-title')}`)
            .join("\n");

        // estriamo il wrapper del primo post (per clonarlo)
        let originalPostWrapper = firstTitleLink;
        while (originalPostWrapper.parentElement && originalPostWrapper.parentElement !== mainFeedContainer) {
            originalPostWrapper = originalPostWrapper.parentElement;
        }

        // cloniamo il post originale
        const fakePost = originalPostWrapper.cloneNode(true);
        const divider = document.createElement("hr");
        divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";

        // rimuoviamo immagini, testo e altre info 
        const mediaElements = fakePost.querySelectorAll('img, video, picture, shreddit-post-image, faceplate-img');
        mediaElements.forEach(media => {
            if (!media.closest('span[avatar]') && !media.src?.includes('avatar') && !media.src?.includes('communityIcon')) {
                const wrapper = media.closest('div[data-testid="post-thumbnail"], .thumbnail, div[data-testid="search-post-with-content-preview"]');
                if (wrapper) wrapper.remove();
                else media.remove();
            }
        });

        // rimuoviamo l'avatar/immagine del subreddit
        const avatars = fakePost.querySelectorAll('img[src*="avatar"], img[src*="communityIcon"]');
        const defaultIcon = payload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png";
        avatars.forEach(img => {
            img.removeAttribute('srcset'); 
            img.src = defaultIcon;
        });

        // inseriamo la data 
        const timeElements = fakePost.querySelectorAll('faceplate-timeago');
        timeElements.forEach(timeEl => {
            timeEl.removeAttribute('ts');
            timeEl.innerHTML = ""; 
            timeEl.innerText = "2 mesi fa"; 
        });

        // se il config.json ci dice di usare l'AI, chiamiamo la funzione apposita, altrimenti usiamo quella solita
        if (payload.use_ai_generation) {
            await this.aiInjection(fakePost, originalPostWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, scrapedPostsText);
        } else {
            this.staticInjection(fakePost, originalPostWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state);
        }
    }

    // ------------------------------------- INIEZIONE STATICA -------------------------------------
    // la vecchia logica di iniezione, che prende i dati dal payload e li mette direttamente nel post clonato.
    staticInjection(fakePost, originalPostWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state) {

        fakePost.id = `bear-fake-post-${pos}`;

        // puliamo eventuali stili lasciati da interventi AI precedenti
        fakePost.style.animation = "none";
        fakePost.style.opacity = "1";
        
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

        this.killAllLinks(fakePost);

        mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
        mainFeedContainer.insertBefore(divider, originalPostWrapper);
        this.sendTelemetry(payload.title, payload.subreddit, payload.target_url, initialQuery, pos, state);

        // appena abbiamo finito mostriamo il feed all'utente
        this.revealPageContent(state);
    }

    // ------------------------------------- INIEZIONE AI ---------------------------------------------
    async aiInjection(fakePost, originalPostWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, scrapedPostsText) {

        fakePost.id = `bear-fake-post-ai-${pos}`;
        state.isGenerating = true;

        try {

            // prendiamo i dati dalla "cache" (se esistono)
            let aiData = await this.retrieveAiData(initialQuery, payload, pos, state, scrapedPostsText);

            // se nel frattempo l'utente ha cambiato query di ricerca => usciamo senza fare nulla 
            const newQuery = new URLSearchParams(window.location.search).get('q');
            if (newQuery !== initialQuery) { return; }

            // se la generazione AI ha successo, aggiorniamo il post con i nuovi dati. 
            if (aiData) {
            
                Log.intervention(`Post AI Generato con successo (Posizione: ${pos})!`);
            
                // uniamo i dati dell'AI con quelli statici del payload (in modo che se l'AI non restituisce qualche campo, usiamo quello statico)
                const mergedPayload = { ...payload, ...aiData };

                // (ri)formattiamo il post per far sparire l'effetto "caricamento" ed inserire i dati generati dall'AI
                fakePost.style.animation = "none";
                fakePost.style.opacity = "1";
                fakePost.id = `bear-fake-post-${pos}`; 
                this.formatPost(
                    fakePost, mergedPayload.title, mergedPayload.subreddit, mergedPayload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png", 
                    mergedPayload.content_text, mergedPayload.image_url, mergedPayload.target_url, 
                    mergedPayload.date, mergedPayload.votes, mergedPayload.comments
                );

                this.killAllLinks(fakePost);

                // iniettiamo il post nel DOM
                mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
                mainFeedContainer.insertBefore(divider, originalPostWrapper);

                // inviamo la telemetria
                this.sendTelemetry(mergedPayload.title, mergedPayload.subreddit, mergedPayload.target_url, initialQuery, pos, state);

            // altrimenti, se la generazione AI fallisce, rimuoviamo il post e settiamo un flag per evitare nuovi tentativi
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

    // ----------------------------------------------------------------------------------
    // HELPER RECUPERO AI CON CACHE ISOLATA
    // ----------------------------------------------------------------------------------
    // metodo helper per recuperare i dati generati dall'AI
    async retrieveAiData(initialQuery, payload, pos, state, scrapedPostsText) {

        // se abbiamo gia i dati in cache => restituiamo quelli
        if (state.cachedAiData) { return state.cachedAiData; }
        
        // altrimenti (non abbiamo i dati in cache) => cerchiamo nella memoria di sessione (magari l'utente ha solo premuto F5)
        // NB. per poter salvare piu dati nella stessa sessione, creiamo una chiave che dipende dalla search_query (es. "bear_ai_vaccini")
        const cacheKey = `bear_ai_${initialQuery}_pos_${pos}`;
        const savedData = sessionStorage.getItem(cacheKey);
        if (savedData) {
            Log.intervention(`Dati AI recuperati dal Session Storage per Posizione ${pos}.`);
            state.cachedAiData = JSON.parse(savedData);
            return state.cachedAiData;
        }

        // se non abbiamo trovato i dati nè in cache nè nel Session Storage => è la prima volta che generiamo il post => facciamo la chiamata API
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

    // ----------------------------------------------------------------------------------
    // HELPER PER DISINNESCARE I LINK
    // ----------------------------------------------------------------------------------
    // NB. la funzione formatPost GIA' è in grado di sotituire i link (es. quando clicco il post api wikipedia per debunking)
    //     QUESTA FUNZIONE SERVE SOLO A "PULIRE" TUTTI GLI ALTRI LINK! Ad esempio il link al subreddit originale, o l'autore.
    killAllLinks(fakePost) {
        // estriamo tutti i tag <a> del post originale
        const allLinks = fakePost.querySelectorAll('a');
         
        // per ogni link estratto (tag <a>) => rimuoviamo il link cliccabile (tag <href> e target) 
        allLinks.forEach(link => {
            link.removeAttribute("href");
            link.removeAttribute("target");
            link.removeAttribute("aria-haspopup"); 
            link.removeAttribute("aria-expanded");

            link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
        });

        // oltre ai link, disinneschiamo anche le hovercard (es. quella del subreddit) che si aprono al pasaggio del mouse
        const hoverCards = fakePost.querySelectorAll('faceplate-hovercard');
        hoverCards.forEach(card => {
            const hoverContent = card.querySelector('[slot="content"]');
            if (hoverContent) hoverContent.remove();
            card.removeAttribute('enter-delay');
            card.removeAttribute('data-id');
            card.removeAttribute('label');
        });
    }

    // ----------------------------------------------------------------------------------
    // HELPER PER LA TELEMETRIA
    // ----------------------------------------------------------------------------------
    sendTelemetry(title, subreddit, target_url, initialQuery, position, state) {
        if (!state.telemetrySent) {
            this.sendPostToBackend(
                "INJECTED", 
                initialQuery, 
                position, 
                title,
                subreddit, 
                target_url
            );
            state.telemetrySent = true;
        }
    }
}

new InjectFakePostIntervention();