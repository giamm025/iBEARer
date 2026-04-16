// Questo file si occupa di ricevere le richieste dal content script (ApiManager) e di fare le chiamate effettive
// (fetch) al backend. In questo modo funge da "ponte" tra il content script (ApiManager) e il backend (Django). 

// Purtroppo questa cosa è FONDAMENTALE per aggirare le limitazione di sicurezza CORS.

// DEBUG: forse ha piu senso fare una var globale? se non sbaglio ho gia una const del genere altrove
const BASE_URL = "http://localhost:8000";

// quando ApiManager invia un messaggio, questo listener lo intercetta e legge l'azione richiesta
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
// -------------------------------------------- POST /participants: enrollParticipant --------------------------------------------
    if (request.action === "ENROLL") {
        fetch(`${BASE_URL}/participants/`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true;
    }

// -------------------------------------------- GET /config: getConfig --------------------------------------------
    if (request.action === "GET_CONFIG") {
        fetch(`${BASE_URL}/config/`)
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        
        return true;
    }

// -------------------------------------------- POST /telemetry: addEventToQueue --------------------------------------------
    if (request.action === "SYNC_TELEMETRY") {
        fetch(`${BASE_URL}/participants/${request.participantId}/telemetry/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.payload)
        })
        .then(res => sendResponse({ success: res.ok }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});