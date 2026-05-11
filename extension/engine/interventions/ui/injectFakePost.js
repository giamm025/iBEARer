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
    }

    // metodo helper per ottenere lo stato di un singolo intervento in base alla posizone (es. se applichiamo piu fake post alla stessa ricerca)
    getState(position) {

        // se non esiste uno stato per questa posizione => stiamo applicando un nuovo intervento => creiamo un'istanza con stato di default
        if (!this.instancesState[position]) {
            this.instancesState[position] = {
                lastQuery: "",
                telemetrySent: false,
                aiFailed: false,
                cachedAiData: null
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

            // aggiorniamo l'ultima query salvata
            state.lastQuery = initialQuery;
        }

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
            const isAiPostMissing = !document.getElementById(`bear-fake-post-ai-${pos}`);
            if (isPostMissing && isAiPostMissing && !state.aiFailed) { this.injectFakePost(payload, initialQuery, pos, state); }
        });

        // avviamo l'observer
        observer.observe(document.body, { childList: true, subtree: true });
        window[observerKey] = observer;
        return true;
    }

    // ------------------------------------- DECISORE (deleghera all funzioni specifiche) -------------------------------------
    // metodo principale che fa i controlli DOM, clona e poi DELEGA il lavoro
    async injectFakePost(payload, initialQuery, pos, state) {  

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
        if (!mainFeedContainer) return;

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

        // se il config.json ci dice di usare l'AI, chiamiamo la funzione apposita, altrimenti usiamo quella solita
        if (payload.use_ai_generation) {
            await this.aiInjection(fakePost, originalPostWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state);
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
    }

    // ------------------------------------- INIEZIONE AI ---------------------------------------------
    async aiInjection(fakePost, originalPostWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state) {
        
        fakePost.id = `bear-fake-post-ai-${pos}`;
        
        // formattiamo lo "scheletro" (la zona in cui andranno i dati dell'AI)
        this.formatPost(
            fakePost, 
            "✨ Generazione risposta AI in corso...", 
            "r/AI_Analysis",                          
            "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png", 
            "Attendere prego. Il modello sta analizzando le fonti per questa ricerca...",
            null, null, "ora", "...", "..."
        );

        // effetto caricamento (opacità + animazione)
        fakePost.style.animation = "bear-pulse 1.5s infinite ease-in-out";
        if (!document.getElementById("bear-pulse-style")) {
            const style = document.createElement("style");
            style.id = "bear-pulse-style";
            style.innerHTML = `
                @keyframes bear-pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 0.8; }
                    100% { opacity: 0.5; }
                }
            `;
            document.head.appendChild(style);
        }

        // iniezione del post finto
        mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
        mainFeedContainer.insertBefore(divider, originalPostWrapper);

        // prendiamo i dati dalla "cache" (se esistono)
        let aiData = await this.retrieveAiData(initialQuery, payload, pos, state);

        // se nel frattempo l'utente ha cambiato query di ricerca o il post è stato rimosso da Reddit => usciamo senza fare nulla 
        const newQuery = new URLSearchParams(window.location.search).get('q');
        if (newQuery !== initialQuery || !document.getElementById(`bear-fake-post-ai-${pos}`)) {
            return; 
        }

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
                fakePost, mergedPayload.title, mergedPayload.subreddit, mergedPayload.subreddit_icon_url, 
                mergedPayload.content_text, mergedPayload.image_url, mergedPayload.target_url, 
                mergedPayload.date, mergedPayload.votes, mergedPayload.comments
            );

            this.killAllLinks(fakePost);
            // inviamo la telemetria
            this.sendTelemetry(mergedPayload.title, mergedPayload.subreddit, mergedPayload.target_url, initialQuery, pos, state);

        // altrimenti, se la generazione AI fallisce, rimuoviamo il post e settiamo un flag per evitare nuovi tentativi
        } else {
            Log.error("Intervention", `Generazione AI fallita, rimozione post AI (Posizione: ${pos}).`);
            state.aiFailed = true;
            fakePost.remove();
            divider.remove();
        }
    }

    // ----------------------------------------------------------------------------------
    // HELPER RECUPERO AI CON CACHE ISOLATA
    // ----------------------------------------------------------------------------------
    // metodo helper per recuperare i dati generati dall'AI
    async retrieveAiData(initialQuery, payload, pos, state) {

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
        const apiData = await ApiManager.generateAiPost(initialQuery, payload.ai_prompt_context || "");
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