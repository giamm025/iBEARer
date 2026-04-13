
InterventionsRegistry["interventions.ui.showDebunkingBanner"] = function(payload, eventData) {
    
    // event_data contiene il CONTESTO di cui parlava il prof (in questo caso la query di ricerca)
    const searchedWord = eventData.search_query.toLowerCase();

    // in base al contesto mostriamo un messaggio di debunking specifico 
    let debunkingMessage = "";
    let debunkingLink = "";
    if (searchedWord.includes("vaccini")) {
        debunkingMessage = "Attenzione: I vaccini sono sicuri ed efficaci secondo l'OMS.";
        debunkingLink = "https://www.who.int/news-room/questions-and-answers/item/vaccines-and-immunization-vaccine-safety";

    } else if (searchedWord.includes("5g")) {
        debunkingMessage = "Attenzione: Le reti 5G utilizzano onde radio non ionizzanti sicure.";
        debunkingLink = "https://www.europarl.europa.eu/RegData/etudes/STUD/2021/690012/EPRS_STU(2021)690012_EN.pdf";

    } else if (searchedWord.includes("terra piatta")) {
        debunkingMessage = "Attenzione: La forma sferica della Terra è un fatto scientifico provato.";
        debunkingLink = "https://www.nasa.gov/earth/how-do-we-know-the-earth-isnt-flat-we-asked-a-nasa-expert-episode-53/";
    }

    // --------------- CREAZIONE BANNER ---------------
    // rimuoviamo vecchi banner se essitono
    const existingBanner = document.getElementById("reddit-debunk-banner");
    if (existingBanner) { existingBanner.remove(); }

    // creiamo un contenitore principale (div)
    const banner = document.createElement("div");
    banner.id = "reddit-debunk-banner";
    
    // Stili CSS applicati direttamente all'elemento
    banner.style.position = "relative"; 
    banner.style.width = "100%";
    banner.style.backgroundColor = "#D32F2F"; 
    banner.style.color = "#FFFFFF";
    banner.style.padding = "16px";
    banner.style.textAlign = "center";
    banner.style.fontFamily = "Arial, sans-serif";
    banner.style.fontSize = "16px";
    banner.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.3)";
    banner.style.marginBottom = "16px"; 
    banner.style.borderRadius = "8px";  
    banner.style.zIndex = "1";

    banner.style.height = "fit-content"; 
    banner.style.alignSelf = "start";    
    banner.style.boxSizing = "border-box"; 
    banner.style.lineHeight = "1.5";

    // Creazione del testo del messaggio
    const textSpan = document.createElement("span");
    textSpan.style.fontWeight = "bold";
    textSpan.innerText = debunkingMessage + " ";

    // Creazione del link cliccabile
    const linkAnchor = document.createElement("a");
    linkAnchor.href = debunkingLink;
    linkAnchor.target = "_blank"; 
    linkAnchor.style.color = "#FFFFFF";
    linkAnchor.style.textDecoration = "underline";
    linkAnchor.style.marginLeft = "10px";
    linkAnchor.style.fontWeight = "bold";
    linkAnchor.innerText = "Scopri di più";

    // Creazione del pulsante di chiusura (X)
    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;"; 
    closeBtn.style.position = "absolute";
    closeBtn.style.right = "20px";
    closeBtn.style.top = "12px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "24px";
    closeBtn.style.fontWeight = "bold";
    
    closeBtn.addEventListener("click", () => {
        banner.remove();
        Log.intervention("L'utente ha chiuso il banner di debunking.");
    });

    // Assembliamo inserendo i pezzi (figli) dentro il banner (padre)
    banner.appendChild(textSpan);
    banner.appendChild(linkAnchor);
    banner.appendChild(closeBtn);

    // Aggiungiamo il banner al documento
    const redditContainer = document.querySelector("shreddit-app .grid-container");
    redditContainer.parentNode.insertBefore(banner, redditContainer);
};

Log.registry("Modulo caricato: interventions.ui.showDebunkingBanner");