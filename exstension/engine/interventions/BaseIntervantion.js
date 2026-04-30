/**
 * @typedef {Object} InterventionPayload
 * @description Payload generico letto dal config.json. Le sottoclassi specificheranno i campi attesi.
 */

class BaseIntervention {
    
    /**
     * @param {string} fqn - Fully Qualified Name (es. "interventions.ui.showDebunkingBanner")
     */
    constructor(fqn) {

        // check di consistenza: il FQN deve essere una stringa non vuota
        if (!fqn || typeof fqn !== 'string') { throw new Error(`[Architecture Violation] FQN non valido per l'intervento.`); }
        this.fqn = fqn;

        // ogni intervento quando verra creato deve registrarsi nel registro globale con il proprio FQN, associandolo 
        // al metodo execute(). Questo significa che quando un evento scattera e il Core Engine dovrà semplicemente fare:
        // window[interventionFqn](payload, eventData) 
        
        window[this.fqn] = this.execute.bind(this);
        Log.intervention_registry(`[Intervention Registered] ${this.fqn}`);
    }

    /**
     * ogni sotto-intervento deve implemnetare il suo metodo execute() che verra poi chiamato dal core_engine.js
     * 
     * @param {InterventionPayload} payload - I parametri configurati nel JSON per questa istanza
     * @param {Object} eventData - L'EventPayload dell'evento che ha fatto scattare il trigger
     */
    execute(payload, eventData) {
        throw new Error(`[Architecture Violation] L'intervento '${this.fqn}' NON ha implementato il metodo execute().`);
    }
}