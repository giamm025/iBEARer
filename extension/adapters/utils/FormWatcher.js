// questo file ci serve per "estendere" la nostra estensione oltre Reddit ed osservare anche Google Forms.
// l'idea è di aggirare il problema di Google App Scripts iniettando un Watcher che osserva l'url di google
// forms e controlla quando passa da "questionario in corso" a "risposte caricate" (google.com/forms/.../formResponse) 

console.log("🕵️ [FormWatcher] In ascolto su Google Forms...");

// appena atterriamo sulla pagina di "Risposta registrata" (formResponse)
if (window.location.href.includes("formResponse")) {
    
    // scriviamo un log e mandiamo il messaggio al background
    console.log("✅ [FormWatcher] Questionario completato! Avviso il background...");

    // QUI DOVREMO AGGIUNGERE LA LOGICA PER CAPIRE SE è STATO COMPLETATO IL PRE O IL POST SURVEY
    // isPreSurvey = ...
    // status = isPreSurvey ? "PRE-SURVEY-COMPLETED" : "POST-SURVEY-COMPLETED";
    
    const status = "PRE-SURVEY-COMPLETED";
    chrome.runtime.sendMessage({ action: "UPDATE_STATUS", status: status }, (response) => {
        if (response && response.success) {
            console.log("✅ [FormWatcher] Backend aggiornato.");
            window.close(); 
        }
    });
}