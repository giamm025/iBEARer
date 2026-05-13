// Aggiunge l'operatore CONTAINS_ANY al registro degli operatori (vedere data-dictionary.yaml per scoprire cosa fa ogni operatore)
window["CONTAINS_ANY"] = function(actualValue, targetValues) {

    if (typeof actualValue !== "string" || !Array.isArray(targetValues)) {
        Log.error("OperatorsRegistry", `Operatore CONTAINS_ANY: tipi di dato non validi. Valore attuale: ${actualValue}, Valori target: ${targetValues}`);
        return false;
    }

    return targetValues.some(keyword => {
        
        // controlliamo se il target è una Regex (inizia e finisce con uno slash "/", con eventuali flag opzionali alla fine)
        const regexMatch = keyword.match(/^\/(.+)\/([a-z]*)$/);
        
        // se non è una regex, facciamo un semplice confronto case-insensitive
        if (!regexMatch) { return actualValue.toLowerCase().includes(keyword.toLowerCase()); }
        
        // altrimenti, se è una regex, costruiamo la regex e la testiamo sul valore attuale
        try {
            const pattern = regexMatch[1];
            let flags = regexMatch[2];
            
            // siccome vogliamo tutto case-insensitive aggiungiamo la 'i' finale se il ricercatore se l'è dimenticata
            if (!flags.includes('i')) { flags += 'i'; }

            // creiamo la regex e testiamo il valore attuale
            const regex = new RegExp(pattern, flags);
            return regex.test(actualValue);

        } catch (e) {
            Log.error("OperatorsRegistry", `Regex non valida nel config.json: ${keyword}`);
            return false; 
        }
    });
};

Log.operator_registry("Operatore caricato: operators.CONTAINS_ANY");