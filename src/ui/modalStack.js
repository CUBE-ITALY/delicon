/**
 * Pila dei dialog aperti: il tasto indietro di Android chiude prima il
 * dialog in cima, come ci si aspetta su un'app nativa.
 */

const stack = [];

/**
 * @param {() => void} requestClose  Chiusura "gentile" del dialog (rispetta busy/dismissible).
 * @returns {() => void} funzione per togliere il dialog dalla pila
 */
export function pushModal(requestClose) {
    stack.push(requestClose);
    return () => {
        const i = stack.lastIndexOf(requestClose);
        if (i !== -1) {
            stack.splice(i, 1);
        }
    };
}

/** @returns {boolean} true se c'era un dialog aperto (il tasto indietro è stato "consumato") */
export function closeTopModal() {
    const top = stack[stack.length - 1];
    if (!top) {
        return false;
    }
    top();
    return true;
}
