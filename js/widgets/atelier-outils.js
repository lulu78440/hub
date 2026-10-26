// Atelier · petits outils communs aux fenêtres Budget et Achats : construction du DOM (texte seulement, jamais de HTML),
// lecture d'un montant en euros, bouton « en deux temps » (rien n'est retiré sans un second geste), style des fenêtres.
// Le style est posé ici (balise <style>, permise par la CSP) pour ne pas toucher à css/ ; il reprend les variables du hub.

/** Crée un élément. attrs : class, on<Evenement>, tout autre attribut ; les enfants sont du texte ou des éléments. */
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [n, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (n === "class") e.className = v;
    else if (n.startsWith("on")) e.addEventListener(n.slice(2), v);
    else e.setAttribute(n, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

/** « 12,50 » ou « 12.5 » ou « 1 234,5 € » → 1250 (centimes) ; null si ce n'est pas un montant. Vide → 0 si videEstZero. */
export function lireEuros(texte, videEstZero = true) {
  const t = String(texte == null ? "" : texte).replace(/[\s  €]/g, "").replace(",", ".");
  if (!t) return videEstZero ? 0 : null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}
/** 125000 → « 1250,00 » (pour remplir un champ de saisie). */
export const euroChamp = (c) => (c / 100).toFixed(2).replace(".", ",");

/** Bouton qui demande confirmation par un second appui (4 s), puis exécute fn. Le texte annoncé change aussi pour les lecteurs d'écran. */
export function boutonDeuxTemps(libelle, libelleConfirm, fn, { classe = "btn danger", nom = "" } = {}) {
  let t = 0;
  const b = h("button", { type: "button", class: classe, "aria-label": nom ? libelle + " " + nom : null }, libelle);
  const reset = () => { clearTimeout(t); t = 0; b.textContent = libelle; b.removeAttribute("data-attente"); if (nom) b.setAttribute("aria-label", libelle + " " + nom); };
  b.addEventListener("click", () => {
    if (!t) { b.textContent = libelleConfirm; b.setAttribute("data-attente", "1"); if (nom) b.setAttribute("aria-label", libelleConfirm + " " + nom); t = setTimeout(reset, 4000); return; }
    reset(); fn();
  });
  b.addEventListener("blur", reset);
  return b;
}

/** Remet le focus sur l'élément qui portait la même clé data-k après un nouveau dessin. */
export function garderFocus(racine, dessiner) {
  const k = document.activeElement && racine.contains(document.activeElement) ? document.activeElement.getAttribute("data-k") : null;
  dessiner();
  if (k) { const e = racine.querySelector('[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]'); if (e) e.focus({ preventScroll: true }); }
}

const STYLE = `
.atl { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; padding-right: 4px; font-family: var(--ui); color: var(--ink); }
body.lite .atl { flex: none; max-height: 72vh; }
.atl * { box-sizing: border-box; min-width: 0; }
.atl h3 { margin: 4px 0 0; font: 500 10px var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
.atl p { margin: 0; }
.atl .rg { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.atl .rg > .grow { flex: 1 1 140px; }
.atl .card { border: 1px solid rgba(63,230,255,.2); background: rgba(63,230,255,.05); padding: 8px 10px; display: grid; gap: 6px; }
.atl .card.alerte { border-color: rgba(255,77,106,.6); }
.atl .tete { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; justify-content: space-between; }
.atl .nom { font-weight: 700; font-size: 16px; overflow-wrap: anywhere; }
.atl .gros { font: 700 20px var(--mono); }
.atl .dim { font: 12px/1.4 var(--mono); color: var(--dim); overflow-wrap: anywhere; }
.atl .txt { font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
.atl .bad { color: var(--red); } .atl .good { color: var(--ok); } .atl .warn { color: var(--amber); }
.atl label { display: grid; gap: 3px; flex: 1 1 120px; font: 500 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }
.atl .inl { width: 100%; }
.atl select.inl { background: rgba(12,10,32,.95); color-scheme: dark; font-family: var(--mono); font-size: 13px; }
.atl input.inl[type="date"] { color-scheme: dark; font-family: var(--mono); font-size: 13px; }
.atl .btn { padding: 8px 12px; }
body.lite .atl .btn { padding: 11px 14px; font-size: 11px; }
body.lite .atl .inl { font-size: 16px; padding: 9px 10px; }
.atl .btn.ok { background: rgba(79,227,168,.12); }
.atl .btn[data-attente] { background: var(--red); color: var(--void); border-color: var(--red); }
.atl .bar { height: 6px; background: rgba(63,230,255,.14); }
.atl .bar i { display: block; height: 100%; background: var(--ok); }
.atl .bar.bad i { background: var(--red); }
.atl details { border: 1px solid rgba(63,230,255,.15); padding: 6px 10px; }
.atl summary { cursor: pointer; font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink); padding: 4px 0; }
.atl pre { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.45 var(--mono); color: var(--ink); }
.atl ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.atl .vide { font: 12px/1.4 var(--mono); color: var(--dim); }
.atl .etat { min-height: 1.2em; font: 12px/1.4 var(--mono); color: var(--ink); }
`;
let pose = false;
export function poserStyle() {
  if (pose || document.getElementById("atelier-style")) { pose = true; return; }
  const s = document.createElement("style"); s.id = "atelier-style"; s.textContent = STYLE; document.head.append(s); pose = true;
}
