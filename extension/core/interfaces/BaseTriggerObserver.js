/**
 * @class BaseTriggerObserver
 * @extends BaseObserver
 * @description Classe astratta per i Trigger Observers che obbliga le sottoclassi a dichiarare quale evento lanceranno.
 * Se i Trigger Observer non dichiarassero l'evento che registrano, il CoreEngine.js non saprebbe rintracciarli.
 * 
 * (Per gli Observer di Telemetria invece, il config.json contiene direttamente il nome dell'observer. 
 *  Puo quindi leggere quello senza bisogno di ricordare a quale evento corrispondono)
 */
class BaseTriggerObserver extends BaseObserver {

    constructor(targetEventFqn) {

        // check di consistenza: se lo sviluppatore non passa l'evento, blocchiamo tutto!
        if (!targetEventFqn || typeof targetEventFqn !== 'string') {
            throw new Error(`[Architecture Violation] ${new.target.name} DEVE passare un 'targetEventFqn' valido al costruttore di BaseTriggerObserver.`);
        }
        
        // Passiamo l'evento validato al costruttore originale di BaseObserver
        super(targetEventFqn);
    }
}