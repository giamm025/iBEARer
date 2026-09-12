// questo file gestisce tutta la logica di parsing dei Survey 
// per cambiare il modo in cui i Survey sono mostrati modificare il platform adapter concreto (es. adapters/reddit/RedditAdapter.js)
// per cambiare link, aggiungere questionari, o modificare i messaggi scritti nei modali modificare il config.json

const SurveyManager = {

    // metodo helper per aprire il pop-up bloccante (finestra modale) per il Pre o Post-Survey
    async displaySurveyModal(surveyType, surveySettings, participantId) {
        
        return new Promise((resolve) => {
            
            // recuperiamo la configurazione del modale dal config.json (titolo, messaggio, testo del bottone, link al questionario)
            const parsed = this.parseSurveyConfig(surveyType, surveySettings);
            if (!parsed) { resolve(); return; } 
            const { surveyConfig, storageKey } = parsed;

            // creiamo il deep link al questionario
            const finalLink = this.createDeepLink(surveyConfig, participantId);

            // salviamo il link completo (con ID) nella memoria del browser (servirà al FormWatcher!)
            chrome.storage.local.set({ [storageKey]: finalLink }, () => {
            // solo dopo che è stato salvato:

                // creiamo l'oggetto di configurazione da passare all'adapter
                const modalConfiguration = {
                    title: surveyConfig.modal_ui.title,
                    message: surveyConfig.modal_ui.message,
                    buttonText: surveyConfig.modal_ui.button_text,
                    link: finalLink
                };

                // diciamo all'adapter di mostrare il pop-up
                PlatformAdapter.showModal(modalConfiguration);
                    
                // comunichiamo che l'operazione è finita
                resolve(); 
            });
        });
    },

    // metodo helper per chiudere il modale in modo astratto
    hideModal() {
        PlatformAdapter.hideModal();
    },

    // metodo heper per fare il parsing del config.json e recuperare i survey_settings
    parseSurveyConfig(surveyType, surveySettings) {

        switch (surveyType) {
            case "PRE":
                return {
                    surveyConfig: surveySettings.pre_survey,
                    storageKey: "preSurveyLink"
                };
            
            case "POST":
                return {
                    surveyConfig: surveySettings.post_survey,
                    storageKey: "postSurveyLink"
                };

            default:
                Log.error("SurveyManager", `Tipo di survey sconosciuto: ${surveyType}`);
                return null; 
        }
    },

    // metodo helper per creare un deep link al questionario
    createDeepLink(surveyConfig, participantId) {
        const baseUrl = surveyConfig.base_url;
        const paramKey = surveyConfig.id_param;
        const joinChar = baseUrl.includes('?') ? '&' : '?';
        const finalLink = `${baseUrl}${joinChar}${paramKey}=${participantId}`; 
        return finalLink;
    }
};