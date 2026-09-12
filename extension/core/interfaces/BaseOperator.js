/**
 * @class BaseOperator
 * @description Classe base per registrare dinamicamente gli operatori logici.
 */
class BaseOperator {

    constructor() {

        // estriamo il FQN in automatico
        const leafClassName = new.target.name;
        this.fqn = BaseOperator._generateFQN(leafClassName);

        // check di consistenza: il FQN deve essere una stringa non vuota
        if (!this.fqn || typeof this.fqn !== 'string') { throw new Error(`[Architecture Violation] FQN non valido per l'operatore.`); }

        // aggiungiamo il nuovo operatore al regitro globale (se non esiste lo crea)
        if (!window.OperatorRegistry) { window.OperatorRegistry = []; }
        window.OperatorRegistry.push(this);    
        Log.operator_registry(`Operatore caricato: \t${this.fqn}`);
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
            console.warn(`[BaseOperator] Impossibile estrarre FQN automatico per ${leafClassName.constructor.name}`, e);
        }
    }

    execute() {
        throw new Error(`[Architecture Violation] Metodo execute() non implementato per l'operatore ${this.constructor.name}.`);
    }
}