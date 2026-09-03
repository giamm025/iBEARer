function figthPreRendering() {
    document.addEventListener("visibilitychange", function onVisibilityChange() {
        if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            const myEngine = new Engine(); 
        }
    });
}

// ------------------------------------------------- AVVIO -------------------------------------------------

const PlatformAdapter = new RedditAdapter();
PlatformAdapter.run();

// se siamo in prerender o la pagina è nascosta aggiungiamo un listener che aspetta che la pagina diventi visibile, poi avvia il motore
if (document.visibilityState === "prerender" || document.visibilityState === "hidden") { figthPreRendering(); } 
else { const myEngine = new Engine(); }