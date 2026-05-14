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
        return false;
    }

    /** 
     * metodo di utilità per fare parsing del config.json ed ottenere i dati specifici da iniettare sulla base della query di ricerca.
     * 
     * @param {string} search_query - La query di ricerca estratta dall'URL
     * @param {Object} payload - Il payload dell'intervento, estratto dal config.json, che DEVE contenere "dynamic_content"
    */
    resolvePayload(search_query, payload) {

        try {

            // se la search_query è vuota => fallback
            if (!search_query) {
                Log.intervention(`[${this.constructor.name}] Risoluzione ignorata: Nessuna search_query valida fornita.`);
                return payload.default_fallback || null;
            }

            // se il payload non ha dynamic content => errore
            if (!payload || !payload.dynamic_content || !Array.isArray(payload.dynamic_content)) {
                Log.error("BaseIntervention", `[${this.constructor.name}] Payload non valido: "dynamic_content" mancante o non è un array.`);
                return null; 
            }

            // per ogni regola in dynamic_content => controlliamo se la query matcha le keyword di trigger  
            for (const rule of payload.dynamic_content) {
                
                // usiamo l'operatore CONTAINS_ANY per capire quale post iniettare sulla base della query di ricerca 
                if (window["CONTAINS_ANY"](search_query, rule.trigger_keywords)) {
                    return rule.data;
                }
            }
            
            // se non troviamo nessun intervento per quella query restituiamo il default
            Log.intervention(`[${this.constructor.name}] Nessuna regola dinamica adatta alla query "${search_query}". Uso fallback.`);
            return payload.default_fallback || null;

        } catch (error) {
            Log.error("BaseIntervention", `Errore critico in resolvePayload per ${this.constructor.name}: ${error.message}`);
            return null;
        }
    }
}