// Dal momento che usiamo un unico dizionario globale con dentro tutti gli interventi
// i singoli file degli interventi dovranno solo aggiungere la propria funzione al registro
// (chiaramente come chiave nel dizionario usiamo il fqn altrimenti il core_engine non saprebbe come chiamarla)

InterventionsRegistry["interventions.debug.applyRedBorder"] = function(payload) {
    Log.intervention("Bordo Rosso Applicato!");
    document.body.style.border = payload.border_style;
    document.header.style.border = payload.border_style;
    document.body.style.boxSizing = "border-box"; 
};

Log.registry("Modulo caricato: interventions.debug.applyRedBorder");