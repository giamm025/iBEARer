class EngineReadyEvent extends CustomEvent {

    // questo evento non ha payload ne FQN. Serve solo per mandare un segnale a tutti gli observers
    // che possono iniziare a lavorare, visto che il motore è pronto. 
    constructor() {
        super("EngineReady");
    }
}