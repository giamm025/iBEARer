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
    }

    execute(payload, eventData) {
        
        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!this.isPostPage()) { return false; } 

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = new URLSearchParams(window.location.search).get('q') || "";
        
        // aggiungiamo un MutationObserver per reinserire il post nel caso React lo rimuova per sbaglio
        const observerKey = `_bearInjectObserver`;

        // resettiamo il flag della telemetria per questa ricerca
        this.telemetrySent = false;

        // se ci sono observer derivanti da iniezioni precedenti => li rimuoviamo
        if (window[observerKey]) { window[observerKey].disconnect(); }

        // facciamo un primo tentativo immediato
        this.attemptInjection(payload, initialQuery);

        // Se il primo tentativo non ha funzionato lanciamo un secondo tentativo
        // dopo un timer di pochi ms per dare tempo a Reddit di caricare i risultati (in particolare il primo post, che è quello che cloniamo). 
        setTimeout(() => this.attemptInjection(payload, initialQuery), 500);

        // MutationObserver: se React carica nuovi dati e ci cancella il post, lo rimettiamo
        const observer = new MutationObserver((mutations) => {

            // estraiamo la query di ricerca attuale
            const currentQuery = new URLSearchParams(window.location.search).get('q');
            
            // se la query attuale è diversa a quella iniziale => abbiamo cambiato pagina => disconnettiamo l'observer e usciamo
            if (currentQuery !== initialQuery) { observer.disconnect(); return; }

            // altrimenti, se il post è stato rimosso, lo reinseriamo
            if (!document.getElementById("bear-fake-post")) { this.attemptInjection(payload, initialQuery); }
        });

        // avviamo l'observer
        observer.observe(document.body, { childList: true, subtree: true });
        window[observerKey] = observer;
        return true;
    }

    // metodo helper per iniettare il post
    attemptInjection(payload, initialQuery) {  

        // estraiamo la query di ricerca attuale per verificare che sia ancora la stessa (se l'utente ha cambiato ricerca, non facciamo nulla)
        const currentQuery = new URLSearchParams(window.location.search).get('q');
        if (currentQuery !== initialQuery) return;

        // se c'è già un nostro fake post iniettato, non facciamo nulla
        if (document.getElementById("bear-fake-post")) return;

        // estraiamo i dati dal config.json (se alcuni valori mancano usiamo dei Default)
        const f_title = payload.title || "Attenzione: Informazione Scientifica";
        const f_subreddit = payload.subreddit || "r/SanitaPubblica";
        const f_avatar = payload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png";
        const f_author = payload.author || "MinisteroDellaVerita";
        const f_content = payload.content_text || "Questo è un messaggio di debunking inserito dall'estensione.";
        const f_image = payload.image_url || null;
        const f_link = payload.target_url || "#";
        const f_date = payload.date || null;
        const f_votes = payload.votes || null;
        const f_comments = payload.comments || null;
        const f_new_position = payload.new_position || 1;  

        // cerchiamo il primo post (quello da clonare)
        const firstTitleLink = document.querySelector('a[data-testid="post-title"]');
        if (!firstTitleLink) return;

        // cerchiamo il container principale dei post (dove inseriremo il nostro finto post)
        const mainFeedContainer = firstTitleLink.closest('main#main-content > div') || firstTitleLink.closest('div.bg-neutral-background');
        if (!mainFeedContainer) return;

        // estriamo il wrapper del post da clonare
        let originalPostWrapper = firstTitleLink;
        while (originalPostWrapper.parentElement && originalPostWrapper.parentElement !== mainFeedContainer) {
            originalPostWrapper = originalPostWrapper.parentElement;
        }

        // cloniamo il post originale
        const fakePost = originalPostWrapper.cloneNode(true);
        fakePost.id = "bear-fake-post";

        // Modifichiamo il post clonato usando i dati del payload
        this.formatPost(
            fakePost, 
            f_title,
            f_subreddit,
            f_avatar,
            f_content,
            f_image,
            f_link,
            f_date,
            f_votes, 
            f_comments
        );

        // iniettiamo il post fake
        mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
        const divider = document.createElement("hr");
        divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";
        mainFeedContainer.insertBefore(divider, originalPostWrapper);
        
        // inviamo la telemetria SOLO LA PRIMA VOLTA
        if (!this.telemetrySent) {
            this.sendPostToBackend("INJECTED", initialQuery, payload.new_position || 1, payload.title, payload.subreddit, payload.target_url);
            this.telemetrySent = true;
        }
    }
}

new InjectFakePostIntervention();