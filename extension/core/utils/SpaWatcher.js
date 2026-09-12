// Questo è piu di un semplice Observer per i trigger. 
// Questo file implementa un Watcher NECESSARIO rilevare i cambiamenti negli URL delle applicazioni SPA (Single Page Applications)
// SpaWatcher espone un solo metodo watch che accetta una funzione da eseguire ogni volta che viene rilevato un cambio di URL 

const SpaWatcher = {

    watch: function(onPageChangeCallback) {
        
        // esecuzione iniziale al primissimo caricamento
        onPageChangeCallback();

        // per rilevare i cambiamenti di URL in una SPA, usiamo un MutationObserver che osserva i cambiamenti nel DOM.
        // ogni volta che viene rilevato un cambiamento, controlliamo se l'URL è cambiato rispetto all'ultimo URL registrato.
        let lastUrl = location.href; 
        const observer = new MutationObserver(() => {

            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;                
                setTimeout(onPageChangeCallback, 500); 
            }
        });

        // agganciamo l'observer all'intero body, osservando cambiamenti sia nei figli che nei discendenti (subtree)
        observer.observe(document.body, { subtree: true, childList: true });
    }
};