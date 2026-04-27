// EDIT: piuttosto che impazzire creando un vero e proprio post con i tag di reddit e tutto quanto (che se un domani cambiano 
// nemmeno funzionerebbe piu), conviene CLONARE un post già esistente (es. prendiamo il primo post, lo cloniamo e cambiamo gli attriobuti)

window.injectFakePost = function(payload, eventData) {
    
    // come abbiamo gia fatto per il debunking banner:
    // se c'è gia un post fake (abbiamo gia applicato l'intervento) non facciamo nulla
    if (document.getElementById("bear-fake-post")) return;

    // estraiamo i dati dal config.json (se alcuni valori mancano usiamo dei Default)
    const f_title = payload.title || "Attenzione: Informazione Scientifica";
    const f_subreddit = payload.subreddit || "r/SanitaPubblica";
    const f_avatar = payload.subreddit_icon_url || "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_2.png";
    const f_author = payload.author || "MinisteroDellaVerita";
    const f_content = payload.content_text || "Questo è un messaggio di debunking inserito dall'estensione.";
    const f_image = payload.image_url || null;
    const f_link = payload.target_url || "#";
    
    // come abbiamo gia visto in altri casi 8es. Observers) i risultati veri di Reddit potrebbero metterci 1-2 secondi 
    // a caricare. Impostiamo quindi un setInterval per ritardare l'operazione
    const finder = setInterval(() => {
        
        // cerchiamo il primo link di un post. In particolare cerchiamo il link del titolo, perché è quello che 
        // ci serve per costruire il nostro post fake
        const firstTitleLink = document.querySelector('a[data-testid="post-title"]');
        if (firstTitleLink) {

            // appena troviamo un post originale, fermiamo il setInterval (ma proseguiamo con la costruzione del post fake)
            clearInterval(finder); 

            // 1. TROVIAMO LA COLONNA CENTRALE DI REDDIT
            const mainFeedContainer = firstTitleLink.closest('main#main-content > div') || firstTitleLink.closest('div.bg-neutral-background');
            if (!mainFeedContainer) {
                Log.error("Intervention", "Impossibile trovare la colonna principale dei risultati.");
                return;
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
            window.formatPost(fakePost, f_title, f_subreddit, f_avatar, f_content, f_image, f_link);

            // 5. INSERIMENTO NELLA PAGINA
            mainFeedContainer.insertBefore(fakePost, originalPostWrapper);
            
            const divider = document.createElement("hr");
            divider.className = "list-divider-line border-0 border-b-sm border-solid border-b-neutral-border-weak xs:mx-md";
            mainFeedContainer.insertBefore(divider, originalPostWrapper);
            
            Log.intervention("Fake Post inserito con successo (100% Camuffato)!");

        }
    }, 150); 
};

Log.intervention("Intervento caricato: injectFakePost");