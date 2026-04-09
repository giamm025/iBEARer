// Dal momento che usiamo un unico dizionario globale con dentro tutti gli interventi
// i singoli file degli interventi dovranno solo aggiungere la propria funzione al registro
// (come chiave nel dizionario usiamo il fqn altrimenti il core_engine non saprebbe come chiamarla)

const interventionFQN = "interventions.debug.applyBorder";
InterventionsRegistry[interventionFQN] = function(payload) {
    Log.intervention("Bordo Applicato!");
    document.body.style.border = payload.border_style;
    document.body.style.boxSizing = "border-box"; 
};

Log.registry("Modulo caricato:" + interventionFQN);