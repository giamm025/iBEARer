/**
 * @typedef {Object} InterventionPayload
 * @description Payload generico letto dal config.json. Le sottoclassi specificheranno i campi attesi.
 */

class BaseIntervention {
    
    constructor() {

        // estriamo il FQN in automatico
        const leafClassName = new.target.name;
        this.fqn = BaseIntervention._generateFQN(leafClassName);

        // check di consistenza: il FQN deve essere una stringa non vuota
        if (!this.fqn || typeof this.fqn !== 'string') { throw new Error(`[Architecture Violation] FQN automatico fallito per l'intervento ${this.constructor.name}.`); }

        // aggiungiamo il nuovo intervento al regitro globale (se non esiste lo crea)
        if (!window.InterventionRegistry) { window.InterventionRegistry = []; }
        if (!window.InterventionRegistry.includes(this.fqn)) {  window.InterventionRegistry.push(this); }
        Log.intervention_registry(`Intervention caricato: \t${this.fqn}`);
    }

    // metodo per estrarre il FQN in automatico (genera un errore fittizzio e silenzioso, poi analizza lo stack trace)
    static _generateFQN(leafClassName) {
        try {
            // generiamo un errore silenzioso per leggere la cronologia delle chiamate
            const stack = new Error().stack;
            
            // prendiamo l'URL base della nostra estensione (es. chrome-extension://abcdefgh...)
            const baseUrl = chrome.runtime.getURL('');

            // dividiamo lo stack trace in righe e filtriamo solo quelle della nostra estensione
            const extensionLines = stack.split('\n').filter(line => line.includes(baseUrl));
            
            // prendiamo il nome della classe che ha generato l'evento (la "foglia" più profonda nello stack)
            let targetPath = null;
            for (let line of extensionLines) {
                
                // estraiamo tutto ciò che c'è DOPO l'URL base e PRIMA dei due punti (es. "chrome-extension://ID/adapters/events/Search.js:10:5" -> "adapters/events/Search.js")
                const match = line.match(new RegExp(baseUrl + "([^:]+)"));
                if (match && match[1]) { 
                    const path = match[1];
                    
                    // cerchiamo la riga esatta in cui la classe foglia viene istanziata
                    if (line.includes(leafClassName)) {
                        targetPath = path;
                        break;
                    }
                }
            }

            // trasformiamo "adapters/events/SearchSubmitted.js" in "adapters.events.SearchSubmitted"
            if (targetPath) { 
                return targetPath.replace('.js', '').split('/').join('.'); 
            }

        } catch (e) {
            console.warn(`[BaseIntervention] Impossibile estrarre FQN automatico per ${leafClassName.constructor.name}`, e);
        }
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
                if (window.OperatorRegistry[rule.operator || "CONTAINS_ANY"](search_query, rule.trigger_keywords)) {
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