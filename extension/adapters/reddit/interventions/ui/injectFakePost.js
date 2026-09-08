/**
 * @typedef {Object} InjectFakePostPayload
 * @property {number} new_position - La posizione esatta in cui iniettare il post fittizio (1-based).
 * @property {boolean} use_ai_generation - Se 'true', genera il post interpellando il backend AI.
 * @property {string} [ai_prompt_context] - Istruzioni specifiche per il prompt dell'AI (necessario se use_ai_generation è true).
 * @property {string} [title] - Titolo fisso (usato se l'AI è spenta).
 * @property {string} [subreddit] - Subreddit da mostrare.
 * @property {string} [subreddit_icon_url] - Icona del subreddit.
 * @property {string} [subreddit_target_url] - Indirizzo a cui si viene reindirizzati cliccando sul nome del subreddit.
 * @property {string} [author] - Autore (spesso nascosto dalla UI di ricerca Reddit).
 * @property {string} [content_text] - Corpo del testo/spiegazione da mostrare.
 * @property {string} [image_url] - Immagine in miniatura.
 * @property {string} [target_url] - Indirizzo a cui si viene reindirizzati al click.
 * @property {string} [date] - Finta data di pubblicazione (es. "2 anni fa").
 * @property {number|string} [votes] - Contatore voti fittizio.
 * @property {number|string} [comments] - Contatore commenti fittizio.
 */
class InjectFakePostIntervention extends BasePostIntervention {
    
    constructor() {
        super(); 
        this.instancesState = {}; 
        PlatformAdapter._injectHidingStyles();
        // iniettiamo subito gli stili CSS che usere per "nascondere" il feed ed i menu, dando l'idea di delay di caricamento
    }

    execute(payload, eventData) {
        
        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!PlatformAdapter.isValidInterventionPage()) return false;

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = (eventData && eventData.search_query) ? eventData.search_query : PlatformAdapter.getCurrentSearchQuery();
        
        // facciamo parsing del payload per capire quale post iniettare sulla base della query di ricerca
        let activePayloads = this._getAllMatchingPayloads(initialQuery, payload, "data");
        if (activePayloads.length === 0) return false;

        // se l'utente sta cercando all'interno di un contesto specifico (es. un subreddit), filtriamo il payload
        activePayloads = PlatformAdapter.filterPlatformSpecificPayloads(activePayloads);
        if (activePayloads.length === 0) return false;

        // se è stata richiesta la randomizzazione delle posizioni, sovrascriviamo dinamicamente il new_position di ogni post con quello pescato a caso
        if (payload.randomize_positions && Array.isArray(payload.randomize_positions)) {
            activePayloads = this._randomize_payload(payload, activePayloads, initialQuery);
        }

        activePayloads.sort((a, b) => (a.new_position || 1) - (b.new_position || 1));
        activePayloads.forEach(activePayload => {
        
            // recuperiamo la posizione dal config.json 
            const pos = activePayload.new_position || 1;
            
            // recuperiamo lo stato della singola istanza dell'intervento. utilizziamo la posizione di ogni post per 
            // differenziare le varie istanze, in questo modo possiamo inserire piu post sulla stessa ricerca
            const state = this.getState(pos);
            
            // aggiungiamo un MutationObserver per reinserire il post nel caso React lo rimuova per sbaglio
            const observerKey = `_bearInjectObserver_${pos}`;
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
                if (!state.contentRevealed && !state.waitingForScroll) { 
                    state.aiAborted = true;         
                    state.aiFailed = true;          
                    PlatformAdapter._revealPageContent();  
                    state.contentRevealed = true;                } 
            }, 8000);
        });
        return true;
    }

    // metodo per randomizzare le posizioni dei post, rispettando eventuali post con posizione fissa
    _randomize_payload(rootPayload, activePayloads, initialQuery) {
                        
        // per non ricalcolare le posizioni ogni volta che scatta l'observer (es. scroll utente o refresh con F5)
        // salviamo le coppie (searchQuery, new_position) nella Session Storage
        const cacheKey = `bear_rand_pos_${initialQuery}`;
        let assignedPos = JSON.parse(sessionStorage.getItem(cacheKey));
        
        // prendiamo solo i fake post che NON hanno gia una new_position fissa 
        const payloadsToRandomize = activePayloads.filter(ap => !ap.new_position);
        if (payloadsToRandomize.length === 0) return activePayloads;

        // se è la prima volta che l'utente fa questa ricerca, generiamo le posizioni
        if (!assignedPos) {

            // troviamo le posizioni che sono GIÀ STATE PRESE dai post con new_position fissa
            const takenPositions = activePayloads.filter(ap => ap.new_position).map(ap => ap.new_position);

            // rimuoviamo dal pool le posizioni già occupate
            let availablePositions = rootPayload.randomize_positions.filter(pos => !takenPositions.includes(pos));

            // mischiamo l'array delle posizioni richieste dal config (es. [2,5,10])
            for (let i = availablePositions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
            }
            
            // estraiamo solo le posizioni che ci servono e le salviamo in cache
            assignedPos = availablePositions.slice(0, payloadsToRandomize.length);
            sessionStorage.setItem(cacheKey, JSON.stringify(assignedPos));
        }
        
        // sovrascriviamo dinamicamente il new_position di ogni post con quello pescato a caso
        let randomIndex = 0;
        activePayloads.forEach(ap => {
            // se non c'è la posizione fissa, peschiamo dal pool random
            if (!ap.new_position) {
                ap.new_position = assignedPos[randomIndex] || (randomIndex + 1); 
                randomIndex++;
            }
            // se c'è già new_position, non facciamo assolutamente nulla! La mantiene
        });
        return activePayloads;
    }

   // ==========================================================================
    // INIEZIONE DEL FAKE POST (scorre il DOM, trova il primo post, lo clona, trova la new_position e poi DELEGA il lavoro)
    // ==========================================================================
    async injectFakePost(payload, initialQuery, pos, state) {  

        // se stiamo gia generando non accettiamo altre chiamate (in questo modo gli inserimenti statici avverranno dopo la generazione AI, evitando casini di mostra/nascondi continui del feed)
        if (state.isGenerating) return;

        // se la query attuale è diversa da quella iniziale (l'utente ha cambiato ricerca) => non facciamo nulla
        const currentQuery = PlatformAdapter.getCurrentSearchQuery();
        if (currentQuery !== initialQuery) return;

        // se abbiamo gia una fake post (nostro o dell'AI) iniettato => non facciamo nulla
        if (document.getElementById(`bear-fake-post-${pos}`) || document.getElementById(`bear-fake-post-ai-${pos}`) || state.aiFailed) return;
        
        // estriamo i riferimenti al DOM necessari per clonare/inserire il post 
        const useAbsolute = payload.absolute_positioning !== false;
        const domRefs = PlatformAdapter.getInjectionReferences(pos, useAbsolute);
        if (!domRefs) return;

        // se stiamo in attesa => segnaliamo waiting = true e blocchiamo l'esecuzione. il MutationObserver riproverà in automatico appena l'utente scrolla
        if (domRefs.isPending) { 
            this._handlePendingInjection(payload, initialQuery, pos, state);
            return;
        }

        // se siamo arrivati qui significa che la posizione cercata è presente nel dom => estriamo i dati ed iniettiamo il fake post
        state.waitingForScroll = false;
        const { cloneWrapper, insertWrapper, mainFeedContainer } = domRefs;

        // nascondiamo il feed SOLO se stiamo inserendo nei primissimi risultati.
        // se stiamo inserendo al post 15, nascondergli improvvisamente la pagina mentre scrolla sarebbe terribile!
        if (pos <= 8) { PlatformAdapter._hidePageContent(mainFeedContainer); }
        
        // creiamo il clone "pulito" da tutti i campi e lo popoliamo con le funzioni specifiche (AI o STATIC)
        const { fakePost, divider } = PlatformAdapter.createCleanClone(cloneWrapper);

        if (payload.use_ai_generation) { 
            const scrapedPostsText = PlatformAdapter.scrapeContext();
            await this.aiInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state, scrapedPostsText); 
        } else {       
            this.staticInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state); 
        }
    }

    // ==========================================================================
    // INIEZIONE STATICA (SENZA AI)
    // ==========================================================================
    staticInjection(fakePost, insertWrapper, mainFeedContainer, divider, payload, initialQuery, pos, state) {
        
        // formattiamo il post con i dati letti dal config.json
        fakePost.id = `bear-fake-post-${pos}`;

        // uniamo i dati specifici del config.json con quelli di default (es. se manca il subreddit_icon_url usiamo quella di default di Reddit)
        const finalPayload = this.mergePostData(payload);
        PlatformAdapter.formatPost(fakePost, finalPayload);
        this._finalizeInjection(fakePost, insertWrapper, mainFeedContainer, divider, finalPayload, initialQuery, pos, state, false);
        // concludiamo l'iniezione rimuovendo i link, aggiungendo la telemetria e iniettando fisicamente il post
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
            const newQuery = PlatformAdapter.getCurrentSearchQuery();
            if (newQuery !== initialQuery) return;

            // se la generazione AI ha successo, aggiorniamo il post con i nuovi dati. 
            if (aiData) {
                
                Log.intervention(`Post AI Generato con successo (Posizione: ${pos})!`);
                
                // uniamo i dati dell'AI con quelli statici del config.json 
                const mergedPayload = this.mergePostData(payload, aiData);

                // formattiamo il post
                fakePost.id = `bear-fake-post-${pos}`; 
                PlatformAdapter.formatPost(fakePost, mergedPayload);

                // prima di iniettare il post, rifacciamo un controllo sul DOM per essere sicuri che i riferimenti non siano cambiati 
                const useAbsolute = payload.absolute_positioning !== false;
                const freshDomRefs = PlatformAdapter.getInjectionReferences(pos, useAbsolute);
                if (!freshDomRefs) { Log.error("Intervention", "DOM mutato durante l'attesa AI. Abortisco inserimento per riprovare."); return; }
                this._finalizeInjection(fakePost, insertWrapper, mainFeedContainer, divider, mergedPayload, initialQuery, pos, state, true);
                // concludiamo l'iniezione rimuovendo i link, aggiungendo la telemetria e iniettando fisicamente il post

            } else {
                Log.error("Intervention", `Generazione AI fallita, rimozione post AI (Posizione: ${pos}).`);
                state.aiFailed = true;
            }
            
        } catch (error) {
            Log.error("Intervention", `Errore critico durante l'iniezione AI: ${error}`);
            state.aiFailed = true;

        } finally {
            state.isGenerating = false; 
            PlatformAdapter.__revealPageContent();   
            state.contentRevealed = true; 
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
        const prompt = `${basePrompt}\n\nCURRENT PAGE CONTEXT (Use these titles to blend in naturally and match the subreddit):\n${scrapedPostsText}`;        const apiData = await ApiManager.generateAiPost(initialQuery, prompt);
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
                aiAborted: false,
                waitingForScroll: false
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
            const currentQuery = PlatformAdapter.getCurrentSearchQuery();
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
        PlatformAdapter.sanitizeFakePostLinks(fakePost);

        // aggiunge la telemetria per segnalare al backend quando l'utente clicca il nostro fake post
        this._attachClickTelemetry(fakePost, payload, initialQuery, pos, isAiGenerated);
        
        // iniezione fisica del post nel DOM
        const parent = insertWrapper.parentElement || mainFeedContainer;
        parent.insertBefore(fakePost, insertWrapper);
        parent.insertBefore(divider, insertWrapper);

        // invia la telemetria per segnalare al backend che l'intervento è terminato
        this._sendTelemetry(payload.title, payload.subreddit, payload.target_url, initialQuery, pos, state);
        
        // concludiamo il "finto caricamento" mostrando la pagina all'utente
        PlatformAdapter._revealPageContent();
        state.contentRevealed = true;
    }

    /** Gestisce il caso in cui la posizione del post non sia ancora stata caricata nel DOM. */
    _handlePendingInjection(payload, initialQuery, pos, state) {
        
        // segnaliamo che stiamo aspettando lo scroll dell'utente per arrivare alla posizione desiderata
        state.waitingForScroll = true; 

        // inoltre, se dobbiamo generare il post con l'AI e non abbiamo ancora i dati in cache, inviamo il contesto all'AI ed aspettiamo che i dati siano pronti
        if (payload.use_ai_generation && !state.cachedAiData) {
            this._prefetchAiDataInBackground(initialQuery, payload, pos, state);
        }
    }

    /** Inizia il caricamento di contenuti AI in background. */
    _prefetchAiDataInBackground(initialQuery, payload, pos, state) {
        
        state.isGenerating = true; 
        const scrapedPostsText = PlatformAdapter.scrapeContext();
        
        this.retrieveAiData(initialQuery, payload, pos, state, scrapedPostsText)
            .then(() => {
                state.isGenerating = false; 
                this.injectFakePost(payload, initialQuery, pos, state);
            })
            .catch((err) => {
                Log.error("Intervention", "Errore AI in background", err);
                state.isGenerating = false;
                state.aiFailed = true;
            });
    }
    
    // ==========================================================================
    // TELEMETRIA
    // ==========================================================================

    _attachClickTelemetry(fakePost, payload, initialQuery, pos, isAiGenerated) {
        
        const baseEventName = isAiGenerated ? "ClickOnAiGeneratedFakePost" : "ClickOnStaticFakePost";
        
        // aggiungiamo la telemetria ed il subreddit_target_url SOLO al subreddit
        if (payload.subreddit_target_url) {
            const subLinks = Array.from(fakePost.querySelectorAll('a[data-bear-is-sub-link="true"]'));            
            subLinks.forEach(subLink => {
                this._addTargetLink(
                    subLink, 
                    payload.subreddit_target_url, 
                    `telemetry.events.${baseEventName}_Subreddit`, 
                    payload, 
                    initialQuery, 
                    pos
                );
            });
        }

        // aggiungiamo la telemetria ed il target_url a tutto il resto del post
        this._addTargetLink(
            fakePost, 
            payload.target_url, 
            `telemetry.events.${baseEventName}`, 
            payload, 
            initialQuery, 
            pos
        );
    }

    _sendTelemetry(title, subreddit, target_url, initialQuery, position, state) {
        if (!state.telemetrySent) {
            this.sendPostToBackend("INJECTED", initialQuery, position, title, subreddit, target_url);
            state.telemetrySent = true;
        }
    }
}

new InjectFakePostIntervention();