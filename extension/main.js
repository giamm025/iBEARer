function startEngine() {
    const myEngine = new CoreEngine(); 
    myEngine.init();
}

function figthPreRendering() {
    document.addEventListener("visibilitychange", function onVisibilityChange() {
        if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            startEngine();
        }
    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------

// se siamo in prerender o la pagina è nascosta aggiungiamo un listener che aspetta che la pagina diventi visibile, poi avvia il motore
// altrimenti, se la pagina è già visibile, avviamo subito il motore
if (document.visibilityState === "prerender" || document.visibilityState === "hidden") { 
    figthPreRendering(); 
} else { 
    startEngine(); 
}
