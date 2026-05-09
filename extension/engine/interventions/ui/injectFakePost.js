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
        // Usa il FQN esatto che scriverai nel config.json
        super("injectFakePost"); 
    }

    /**
     * @param {InjectFakePostPayload} payload 
     * @param {Object} eventData 
     */
    execute(payload, eventData) {

        // se siamo in una schermata incompatibile, usciamo subito dall'intervento (e non applichiamo la telemetria) 
        if (!this.isPostPage()) { return false; } 
    
        // se c'è gia un post fake (abbiamo gia applicato l'intervento) non facciamo nulla
        if (document.getElementById("bear-fake-post")) { return false; }

        // salviamo la query di ricerca iniziale. la useremo per rimuovere l'intervento nel momento in cui l'utente effettua una nuova ricerca
        const initialQuery = new URLSearchParams(window.location.search).get('q') || "";

        // chiamiamo la funzione responsabile della clonazione 
        const finder = setInterval(() => {
            this.attemptInjection(payload, initialQuery, finder);
        }, 200); 
        // NB. Usiamo un timer di pochi ms per dare tempo a Reddit di caricare i risultati (in particolare il primo post, che è quello che cloniamo). In questo modo evitiamo problemi di "elemento non trovato" e rendiamo l'intervento più robusto.

        return true;
    }

    attemptInjection(payload, initialQuery, finder) {

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
                
        // cerchiamo il link del primo post (usando il titolo) che sarà quello che andremo a clonare
        const firstTitleLink = document.querySelector('a[data-testid="post-title"]');
        if (firstTitleLink) {

            // appena troviamo un post originale, fermiamo il setInterval (ma proseguiamo con la costruzione del post fake)
            clearInterval(finder); 

            // 1. TROVIAMO LA COLONNA CENTRALE DI REDDIT
            const mainFeedContainer = firstTitleLink.closest('main#main-content > div') || firstTitleLink.closest('div.bg-neutral-background');
            if (!mainFeedContainer) {
                Log.error("Intervention", "Impossibile trovare la colonna principale dei risultati.");
                return false;
            }

            // 2. RISALIAMO FINO AL FIGLIO DIRETTO DELLA COLONNA
            let originalPostWrapper = firstTitleLink;
            while (originalPostWrapper.parentElement && originalPostWrapper.parentElement !== mainFeedContainer) {
                originalPostWrapper = originalPostWrapper.parentElement;
            }

            // 3. CLONAZIONE DEL WRAPPER COMPLETO
            const fakePost = originalPostWrapper.cloneNode(true);
            fakePost.id = "bear-fake-post";

            // 4. MODIFICA DEL DOM CLONATO (funzione helper)
            this.formatPost(fakePost, f_title, f_subreddit, f_avatar, f_content, f_image, f_link, f_date, f_votes, f_comments);

            // 5. INSERIMENTO NELLA PAGINA
            mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
            
            const divider = document.createElement("hr");
            divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";
            mainFeedContainer.insertBefore(divider, originalPostWrapper);
            
            // --- 6. TELEMETRIA: INVIAMO I DATI AL BACKEND ---
            const search_query = new URLSearchParams(window.location.search).get('q') || "";
            this.sendPostToBackend("INJECTED", search_query, f_new_position, f_title, f_subreddit, f_link);
        }
        return true;
    }
}

new InjectFakePostIntervention();