// questo file ci serve per "estendere" la nostra estensione oltre Reddit ed osservare anche Google Forms.
// l'idea è di aggirare il problema di Google App Scripts iniettando un Watcher che osserva l'url di google
// forms e controlla quando passa da "questionario in corso" a "risposte caricate" (google.com/forms/.../formResponse) 

console.log("🕵️ [FormWatcher] In ascolto su Google Forms...");

// appena atterriamo sulla pagina di "Risposta registrata" (formResponse)
if (window.location.href.includes("formResponse")) {
    
    // estraiamo i link dei questionari 
    chrome.storage.local.get(['preSurveyLink', 'postSurveyLink'], (data) => {
        
        // facciamo parsing degli url per estrarre gli ID dei questionari
        const { preSurveyId, postSurveyId } = extractFormIds(data);
        const currentUrl = window.location.href;

        // tramite gli idcerchiamo di capire quale questionario è stato completato 
        let status = null;
        if (window.location.href.includes(preSurveyId)) {
            status = "PRE-SURVEY-COMPLETED";
            console.log("✅ [FormWatcher] PRE-Survey completato!");
        }
        else if (window.location.href.includes(postSurveyId)) {
            status = "POST-SURVEY-COMPLETED";
            console.log("✅ [FormWatcher] POST-Survey completato!");
        }

        // se abbiamo riconosciuto il questionario, aggiorniamo lo stato dell'utente 
        if (status) {
            chrome.runtime.sendMessage({ action: "UPDATE_STATUS", status: status }, (response) => {
                if (response && response.success) {
                    chrome.runtime.sendMessage({ action: "CLOSE_CURRENT_TAB" });
                }
            });
            
        } else {
            console.log("⚠️ [FormWatcher] Questionario sconosciuto. Nessuna azione intrapresa.");
        }
    });
}

// funzione helper per estrarre gli ID dei questionari dagli url
function extractFormIds(data) {

    const extractId = (url) => {
        if (!url) return null;
        const match = url.match(/\/d\/e\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    };

    return {
        preSurveyId: extractId(data.preSurveyLink),
        postSurveyId: extractId(data.postSurveyLink)
    };
}