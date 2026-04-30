// Aggiunge l'operatore CONTAINS_ANY al registro degli operatori (vedere data-dictionary.yaml per scoprire cosa fa ogni operatore)
window["CONTAINS_ANY"] = function(actualValue, targetValues) {

    if (typeof actualValue !== "string" || !Array.isArray(targetValues)) {
        Log.error("OperatorsRegistry", `Operatore CONTAINS_ANY: tipi di dato non validi. Valore attuale: ${actualValue}, Valori target: ${targetValues}`);
        return false;
    };

    return targetValues.some(keyword => 
        actualValue.toLowerCase().includes(keyword.toLowerCase())
    );
};

Log.operator_registry("Operatore caricato: operators.CONTAINS_ANY");