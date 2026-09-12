class NotContainsAnyOperator extends BaseOperator {

    constructor() {
        super();
    }

    execute(actualValue, targetValues) {

        if (typeof actualValue !== "string" || !Array.isArray(targetValues)) {
            Log.error("OperatorsRegistry", `Operatore NOT_CONTAINS_ANY: tipi di dato non validi. Valore attuale: ${actualValue}, Valori target: ${targetValues}`);
            return false;
        };

        return !targetValues.some(keyword => 
            actualValue.toLowerCase().includes(keyword.toLowerCase())
        );
    };
}
new NotContainsAnyOperator();