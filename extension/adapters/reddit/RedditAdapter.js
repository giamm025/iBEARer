// espone i metodi che modificano la UI specifica di Reddit
class RedditAdapter {
    
    // metodo per far apparire il pop-up bloccante (valido sia per Pre che Post-Survey)
    showSurveyModal(modalConfiguration) {

        // usiamo un id fisso per il nostro pop-up, in modo da poterlo identificare e rimuovere facilmente in seguito
        if (document.getElementById('reddit-cospiracy-survey-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'reddit-cospiracy-survey-modal';
        
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); z-index: 9999999;
            display: flex; justify-content: center; align-items: center;
            font-family: Arial, sans-serif; backdrop-filter: blur(5px);
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: white; padding: 40px; border-radius: 12px;
            text-align: center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;

        // Inseriamo dinamicamente i valori passati tramite l'oggetto modalConfiguration
        box.innerHTML = `
            <h2 style="color: #1a1a1b; margin-top: 0; font-size: 24px;">${modalConfiguration.title}</h2>
            <p style="color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                ${modalConfiguration.message}
            </p>
            <a href="${modalConfiguration.link}" target="_blank" style="
                background: #ff4500; color: white; padding: 14px 28px;
                text-decoration: none; font-weight: bold; border-radius: 999px;
                font-size: 16px; display: inline-block; cursor: pointer;
            ">${modalConfiguration.buttonText}</a>
        `;

        modal.appendChild(box);
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    // metodo per chiudere il pop-up bloccante (valido sia per Pre che Post-Survey)
    hideSurveyModal() {
        const modal = document.getElementById('reddit-cospiracy-survey-modal');
        if (modal) modal.remove();
        document.body.style.overflow = ''; 
    }

    // metodo per avviare l'esperimento su REDDIT
    run() {

        // facciamo partire l'adapter per intercettare eventi SOLO DOPO che l'engine è partito
        // altrimenti rischiamo di intercettare eventi prima che l'engine sia pronto a gestirli
        document.addEventListener("EngineReady", () => {

            Log.adapter("Avvio Reddit Adapter...");

            // definiamo la funzione che "sveglia" TUTTI gli observers attivi 
            const notifyObservers = () => {

                // se ci sono observer registrati, chiamiamo il loro metodo check() per svegliarli
                if (window.ObserverRegistry) {
                    for (const observer of window.ObserverRegistry) {
                        observer.check();
                    }     

                // altrimenti logghiamo che non ci sono observer registrati (DEBUG)
                } else {
                    Log.adapter("Nessun Observer registrato.");
                }
            };

            // definiamo la funzione che l'SpaWatcher drovrà eseguire AD OGNI CAMBIO URL. 
            // nel nostro caso si occuperà solo di attivare gli Observer registrati.
            SpaWatcher.watch(() => {
                notifyObservers()
            });
        });
    }
};