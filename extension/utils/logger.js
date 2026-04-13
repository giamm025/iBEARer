// prima di iniziare a impazzire con i log in ogni modulo, che una mia classe (wrapper) di console.log

// configurazione per attivare/disattivare i log (il primo flag è un interruttore generale, il secondo specifica i singoli moduli)
const LoggerConfig = {
    log_enable: true, 
    modules: {
        engine: true,
        adapter: true,
        registry: true, 
        intervention: true
    }
};

// definiamo cosa il log deve stampare per ogni modulo
const Log = {

    engine: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.engine) {
            console.log("⚙️ [Engine]", ...args);
        }
    },
    
    registry: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.registry) {
            console.log("📋 [Registry]", ...args);
        }
    },
    
    adapter: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.adapter) {
            console.log("🕵️ [Adapter]", ...args);
        }
    },
    
    intervention: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.intervention) {
            console.log("🚨 [Intervention]", ...args);
        }
    },
    
    // gli errori chiaramente non si spengono
    error: (moduleName, ...args) => { console.error(`❌ [${moduleName}]`, ...args); }
};

// se il logger è abilitato, scriviamo che il logger è stato inizializzato
if (LoggerConfig.log_enable) { console.log("🛠️ [Utility] Logger inizializzato."); }