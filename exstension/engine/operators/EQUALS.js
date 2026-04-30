// Aggiunge l'operatore EQUALS al registro degli operatori (vedere data-dictionary.yaml per scoprire cosa fa ogni operatore)
window["EQUALS"] = function(actualValue, targetValue) {
    return actualValue === targetValue; 
};

Log.operator_registry("Operatore caricato: operators.EQUALS");