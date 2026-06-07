class ContainsAnyOperator extends BaseOperator {

    constructor() {
        super();
    }

    execute(actualValue, targetValues) {

        // Check di consistenza: actualValue deve essere una stringa e targetValues un array
        if (typeof actualValue !== "string" || !Array.isArray(targetValues)) {
            Log.error("OperatorsRegistry", `Operatore NOT_CONTAINS_ANY: tipi di dato non validi.`);
            return false;
        };

        // ritorniamo true se actualValue contiene almeno una delle parole chiave in targetValues (ignorando maiuscole/minuscole)
        return !targetValues.some(keyword => actualValue.toLowerCase().includes(keyword.toLowerCase()));
    }
}   
new ContainsAnyOperator();