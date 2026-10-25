// Bouton « Labo » : ouvre le laboratoire du Noyau dans un nouvel onglet.
// Seul un vrai clic ou une vraie touche de Lucien l'ouvre (`isTrusted`) : un script, une extension ou le Noyau lui-même ne peuvent pas le déclencher.
// Le laboratoire est réservé à Lucien pour que le système ne puisse pas se modifier lui-même.
const b = document.getElementById("b-labo");
if (b) {
  b.addEventListener("click", (e) => {
    if (!e.isTrusted) return;                                   // clic simulé : ignoré
    window.open("labo.html", "_blank", "noopener");
  });
  b.addEventListener("keydown", (e) => e.stopPropagation());     // les raccourcis du hub (touche D, etc.) ne doivent pas se déclencher ici
}
