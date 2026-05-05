// prima di iniziare a impazzire con i log in ogni modulo, che una mia classe (wrapper) di console.log

// configurazione per attivare/disattivare i log (il primo flag è un interruttore generale, il secondo specifica i singoli moduli)
const LoggerConfig = {
    log_enable: true, 
    modules: {
        engine: true,
        adapter: true,
        telemetry: true,
        telemetry_flush: false,

        registry: false,
        intervention_registry: true,
        operator_registry: true,
        telemetry_registry: true,

        intervention: false,
        web_socket: true,
        heart_beat: false
    }
};

// definiamo cosa il log deve stampare per ogni modulo
const Log = {

    engine: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.engine) {
            console.log("⚙️ [Engine]", ...args);
        }
    },
    
    intervention_registry: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.intervention_registry && LoggerConfig.modules.registry) {
            console.log("📋 [Registry]", ...args);
        }
    },

    operator_registry: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.operator_registry && LoggerConfig.modules.registry) {
            console.log("➕ [Registry]", ...args);
        }
    },

    telemetry_registry: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.telemetry_registry && LoggerConfig.modules.registry) {
            console.log("📊 [Registry]", ...args);
        }
    },
    
    adapter: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.adapter) {
            console.log("🕵️ [Adapter]", ...args);
        }
    },

    telemetry: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.telemetry) {
            console.log("📊 [Telemetry]", ...args);
        }
    },

    telemetry_flush: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.telemetry_flush) {
            console.log("🔄 [Telemetry Flush]", ...args);
        }
    },

    intervention: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.intervention) {
            console.log("🚨 [Intervention]", ...args);
        }
    },

    web_socket: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.web_socket) {
            console.log("🌐 [WebSocket]", ...args);
        }
    },

    heart_beat: (...args) => {
        if (LoggerConfig.log_enable && LoggerConfig.modules.heart_beat) {
            console.log("💓 [ApiManager]", ...args);
        }
    },

    // gli errori chiaramente non si spengono
    error: (moduleName, ...args) => { console.error(`❌ [${moduleName}]`, ...args); }
};

// se il logger è abilitato, scriviamo che il logger è stato inizializzato
if (LoggerConfig.log_enable) { console.log("🛠️ [Utility] Logger inizializzato."); }