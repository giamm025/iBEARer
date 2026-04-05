// prima di iniziare a impazzire con i log in ogni modulo, che una mia classe (wrapper) di console.log
const Log = {

    engine: (...args) => console.log("⚙️ [Engine]", ...args),
    registry: (...args) => console.log("📋 [Registry]", ...args),
    adapter: (...args) => console.log("🕵️ [Adapter]", ...args),
    intervention: (...args) => console.log("🚨 [Intervention]", ...args),
    error: (moduleName, ...args) => console.error(`❌ [Error -> ${moduleName}]`, ...args),
    utility: (...args) => console.log("🛠️ [Utility]", ...args)
};