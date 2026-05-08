// Dal momento che usiamo un unico dizionario globale con dentro tutti gli interventi i singoli file degli interventi 
// dovranno solo aggiungere la propria funzione al registro (come chiave nel dizionario usiamo il fqn)

/**
 * @typedef {Object} ApplyBorderPayload
 * @property {string} border_style - Es. "10px solid red"
 */

class ApplyBorderIntervention extends BaseIntervention {
    
    constructor() {
        super("interventions.debug.applyBorder");
    }

    /**
     * @param {ApplyBorderPayload} payload 
     * @param {Object} eventData 
     */
    execute(payload, eventData) {
        Log.intervention("Bordo Applicato!");
        document.body.style.border = payload.border_style;
        document.body.style.boxSizing = "border-box"; 
        return true;
    }
}

// istanziamo l'intervento per registrarlo nel sistema 
// (la registrazione avviene nel costruttore della classe base)
new ApplyBorderIntervention();