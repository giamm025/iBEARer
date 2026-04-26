// questo file ci serve per "estendere" la nostra estensione oltre Reddit ed osservare anche Google Forms.
// l'idea è di aggirare il problema di Google App Scripts iniettando un Watcher che osserva l'url di google
// forms e controlla quando passa da "questionario in corso" a "risposte caricate" (google.com/forms/.../formResponse) 

console.log("🕵️ [FormWatcher] In ascolto su Google Forms...");

// appena atterriamo sulla pagina di "Risposta registrata" (formResponse)
if (window.location.href.includes("formResponse")) {
    
    // scriviamo un log e mandiamo il messaggio al background
    console.log("✅ [FormWatcher] Questionario completato! Avviso il background...");
    chrome.runtime.sendMessage({ action: "SURVEY_COMPLETED" }, (response) => {
        if (response && response.success) {
            console.log("✅ [FormWatcher] Backend aggiornato.");
            window.close(); 
        }
    });
}