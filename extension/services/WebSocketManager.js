

export class WebSocketManager {

    constructor(wsUrl) {
        this.wsUrl = wsUrl;                 // url della web socket
        this.socket = null;                 // ci dice se siamo connessi o no
        this.reconnectInterval = null;      // ci dice se stiamo gia provando a riconnetterci dopo una connessione caduta
    }

    connect(participantId) {

        // se c'è già una connessione aperta, non ne apro una nuova (evitiamo doppie connessioni)
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;

        // costruiamo l'url web socket a cui dobbiamo conneterci (ovviamente basato sul participantId)
        const wsEndpoint = `${this.wsUrl}/ws/participants/${participantId}/status/`;
        console.log(`🌐 [WebSocketManager] Tentativo di connessione a: ${wsEndpoint}`);
        this.socket = new WebSocket(wsEndpoint);


        // --------------------------------------- on open ---------------------------------------
        this.socket.onopen = () => {
            console.log("🌐 [WebSocketManager] WebSocket Connesso! DEBUG DEBUG DEBUG");
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        };


        // --------------------------------------- on message ---------------------------------------
        this.socket.onmessage = (event) => {

            // ottiene il nuovo stato
            const data = JSON.parse(event.data);
            console.log("🌐 [WebSocketManager] Aggiornamento Stato Ricevuto:", data);

            // se il nuovo stato è PRE-SURVEY-COMPLETED 
            if (data.status === 'PRE-SURVEY-COMPLETED') {
                
                // avvisa tutte le tab attive di far partire il motore!
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { 
                            action: "START_EXPERIMENT", 
                            group: data.group 
                        }).catch(() => {}); 
                    });
                });
            }
        };

        // --------------------------------------- on close ---------------------------------------
        
        // se riceve un messaggio di chiusura della connessione (es. server down), prova a riconnettere ogni 5 secondi
        this.socket.onclose = () => {
            console.log("🔴 [WebSocketManager] WebSocket Disconnesso. Riprovo tra 5 secondi...");
            if (!this.reconnectInterval) {
                this.reconnectInterval = setInterval(() => this.connect(participantId), 5000);
            }
        };

        // --------------------------------------- on error ---------------------------------------
        this.socket.onerror = (error) => {
            console.error("🔴 [WebSocketManager] Errore WebSocket:", error);
            this.socket.close();
        };
    }
}