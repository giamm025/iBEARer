class EqualsOperator extends BaseOperator {

    constructor() {
        super();
    }

    execute(actualValue, targetValue) {
        return actualValue === targetValue;
    }
}
new EqualsOperator();