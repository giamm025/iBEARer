// Questo file si occupa di ricevere le richieste dal content script (ApiManager) e di fare le chiamate effettive
// (fetch) al backend. In questo modo funge da "ponte" tra il content script (ApiManager) e il backend (Django). 

// Purtroppo questa cosa è FONDAMENTALE per aggirare le limitazione di sicurezza CORS.

// DEBUG: forse ha piu senso fare una var globale? se non sbaglio ho gia una const del genere altrove
const BASE_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";       

// variabili globali che useremo per la gestione delle Web Sockets
let statusSocket = null;        // ci dice se siamo connessi o no 
let reconnectInterval = null;   // ci dice se stiamo gia provando a riconnetterci dopo una connessione caduta

// quando ApiManager invia un messaggio, questo listener lo intercetta e legge l'azione richiesta
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
// -------------------------------------------- POST /participants: enrollParticipant --------------------------------------------
    if (request.action === "ENROLL") {
        fetch(`${BASE_URL}/participants/`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        
        // se il backend risponde con un errore (404, 500, ecc...)
        .then(async res => {
            if (!res.ok) {
                const errorData = await res.json(); 
                throw new Error(errorData.message || `HTTP status: ${res.status}`);
            }
            return res.json();
        })
        // se invece è andato tutto bene (200-299)
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true;
    }

// -------------------------------------------- GET /config: getConfig --------------------------------------------
    if (request.action === "GET_CONFIG") {
        fetch(`${BASE_URL}/config/`)

        // se il backend risponde con un errore (404, 500, ecc...)
        .then(async res => {
            if (!res.ok) {
                const errorData = await res.json(); 
                throw new Error(errorData.message || `HTTP status: ${res.status}`);
            }
            return res.json();
        })
        // se invece è andato tutto bene (200-299)
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true;
    }

// ---------------------------------- POST participants/{participantId}/telemetry: sendTelemetry ----------------------------------
    if (request.action === "SYNC_TELEMETRY") {
        fetch(`${BASE_URL}/participants/${request.participantId}/telemetry/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.payload)
        })

        // se il backend risponde con un errore (404, 500, ecc...)
        .then(async res => {
            if (!res.ok) {
                const errorData = await res.json(); 
                throw new Error(errorData.message || `HTTP status: ${res.status}`);
            }
            return null;    // null poiche in caso di successo ritorna 201 CREATED senza body. 
                            // Se facessimo res.json() come negli altri endpoint otterremmo errore (Unexpected end of JSON input) 
                            // in quanto non c'è nessun res da parare...
        })
        // se invece è andato tutto bene (200-299)
        .then(data => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

// ---------------------------------- GET participants/{participantId}/status: getStatus ----------------------------------
    if (request.action === "GET_STATUS") {
        fetch(`${BASE_URL}/participants/${request.participantId}/status/`)
        .then(async res => {
            if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
            return res.json();
        })
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true;
    }

// -------------------------------------------- WEBSOCKET CONNECT --------------------------------------------
    if (request.action === "CONNECT_WEBSOCKET") {
        connectWebSocket(request.participantId);
        sendResponse({ success: true });
        return false; // sincrono
    }
});

function connectWebSocket(participantId) {

    // se c'è già una connessione aperta, non ne apro una nuova (evitiamo doppie connessioni)
    if (statusSocket && statusSocket.readyState !== WebSocket.CLOSED) return; // Evita doppie connessioni

    // costruiamo l'url web socket a cui dobbiamo conneterci (ovviamente basato sul participantId)
    const wsEndpoint = `${WS_URL}/ws/participants/${participantId}/status/`;
    console.log(`Tentativo di connessione a: ${wsEndpoint}`);
    statusSocket = new WebSocket(wsEndpoint);


    // --------------------------------------- on open ---------------------------------------
    statusSocket.onopen = () => {
        console.log("WebSocket Connesso!");
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };


    // --------------------------------------- on message ---------------------------------------
    statusSocket.onmessage = (event) => {

        // ottiene il nuovo stato
        const data = JSON.parse(event.data);
        console.log("Aggiornamento Stato Ricevuto:", data);

        // se il nuovo stato è PRE-SURVEY-COMPLETED 
        if (data.status === 'PRE-SURVEY-COMPLETED' || data.status === 'EXPERIMENT') {
            
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
    statusSocket.onclose = () => {
        console.log("WebSocket Disconnesso. Riprovo tra 5 secondi...");
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => connectWebSocket(participantId), 5000);
        }
    };

    // --------------------------------------- on error ---------------------------------------
    statusSocket.onerror = (error) => {
        console.error("[WebSocket]", error);
        statusSocket.close();
    };
}