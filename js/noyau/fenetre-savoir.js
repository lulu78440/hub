// Noyau · fenêtre « Savoir » : la carte 3D de ce que le Noyau a appris, le % réel par domaine, et les prochaines étapes.
// Texte inséré uniquement avec textContent. Rien n'est appris sans ta validation : « Étudier » dépose des propositions dans « À valider ».
import { monterCarte3d } from "./carte3d.js";
import { PROGRAMME } from "./curriculum.js";

function h(tag, a = {}, ...k) { const e = document.createElement(tag); for (const [n, v] of Object.entries(a || {})) { if (v == null || v === false) continue; if (n === "class") e.className = v; else if (n.startsWith("on")) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; }

export function monterSavoir(conteneur, noyau) {
  const savoir = noyau.savoir;
  conteneur.textContent = "";
  const racine = h("div", { class: "nx nx-savoir" });
  const canvas = h("canvas", { class: "nx-carte", tabindex: "0" });
  const entete = h("div", { class: "nx-sv-haut" });
  const detail = h("div", { class: "nx-sv-detail", "aria-live": "polite" });
  const suite = h("div", { class: "nx-sv-suite" });
  const cur = h("div", { class: "nx-sv-cur" });
  racine.append(entete, h("div", { class: "nx-carte-cadre" }, canvas), detail, suite, cur,
    h("details", { class: "nx-aide" }, h("summary", {}, "Comment ce pourcentage est calculé"),
      h("p", {}, "Chaque domaine est découpé en sous-thèmes (le programme). Un sous-thème est couvert à 100 % quand le Noyau a retenu, et que tu as validé, des fiches sourcées qui totalisent 2 points : une fiche vérifiée vaut 1, une fiche non vérifiée 0,5, un fait sur toi 0,5, un souvenir d'échange 0,25."),
      h("p", {}, "Le pourcentage d'un domaine est la moyenne de ses sous-thèmes. Il part de 0 % et ne monte que par ce que tu valides. Il mesure la couverture du programme, pas tout ce qui existe sur le sujet."),
      h("p", {}, "Glisser pour tourner, molette pour zoomer, double-clic pour recentrer. Chaque point est un neurone. Un sous-thème en cours d'apprentissage est relié à son domaine par un axone qui crépite, avec des influx par salves ; un sous-thème validé a des influx réguliers et un cœur blanc ; un axone violet relie deux connaissances qui se recoupent.")));
  conteneur.append(racine);

  let choix = null, etudeEnCours = false;
  const carte3d = monterCarte3d(canvas, { surSelection: (id, dom) => { choix = dom ? { id, dom } : null; rendreDetail(); } });
  const barre = (n, couleur) => h("span", { class: "nx-sv-barre", role: "presentation" }, h("i", { style: `width:${Math.round(n * 100)}%;background:${couleur}` }));

  function rafraichir() {
    const c = savoir.carte(); carte3d.definir(c);
    entete.textContent = "";
    entete.append(...[h("div", { class: "nx-sv-global" }, h("b", {}, c.global + " %"), h("span", { class: "nx-dim" }, ` du programme couvert · ${c.couverts} / ${c.total} sous-thèmes · ${c.fiches} fiches`)),
      c.fiches === 0 ? h("p", { class: "nx-dim" }, "Rien n'est encore appris : tout est à 0 %. Choisis un domaine, puis « Étudier » : les propositions arrivent dans « À valider ».") : null].filter(Boolean));
    const p = savoir.prochain(c); suite.textContent = "";
    if (p) suite.append(h("span", { class: "nx-dim" }, "Prochaine étape conseillée : "), h("b", {}, `${p.domaineNom} · ${p.titre}`), h("button", { class: "nx-btn", type: "button", disabled: etudeEnCours, onclick: () => etudier(p.sousTheme) }, "Étudier"));
    rendreDetail(c); rendreCur();
  }
  function rendreCur() {
    cur.textContent = ""; const on = noyau.reglage("curiosite") === "on", st = noyau.initiative.etatCuriosite();
    cur.append(h("span", { class: "nx-dim" }, "Curiosité autonome : "), h("b", {}, on ? "active" : "coupée"),
      h("button", { class: "nx-btn", type: "button", onclick: () => { noyau.reglage("curiosite", on ? "off" : "on"); rendreCur(); } }, on ? "Couper" : "Activer"),
      h("span", { class: "nx-dim" }, on ? ` Une étude toutes les 30 min au plus, 6 par jour (${st.prog || 0} aujourd'hui), jamais en Focus, la nuit ou écran verrouillé. Elle propose, tu valides.` : " Le Noyau n'étudie que sur ta demande."));
  }
  function rendreDetail(c = savoir.carte()) {
    detail.textContent = "";
    if (!choix) { detail.append(h("p", { class: "nx-dim" }, "Clique sur un domaine de la carte pour voir ses sous-thèmes.")); return; }
    const d = c.domaines.find((x) => x.id === choix.dom); if (!d) return;
    detail.append(h("div", { class: "nx-av-t" }, h("b", {}, `${d.symbole} ${d.nom}`), h("span", { class: "nx-puce", style: `color:${d.couleur};border-color:${d.couleur}` }, d.pct + " %")),
      h("p", { class: "nx-dim" }, `${d.couverts} couverts, ${d.entames} entamés sur ${d.total} · ${d.fiches} fiches`));
    d.sousThemes.forEach((s) => detail.append(h("div", { class: "nx-sv-st" + (choix.id === s.id ? " sel" : "") }, h("span", {}, s.titre), barre(s.niveau, d.couleur), h("span", { class: "nx-dim" }, Math.round(s.niveau * 100) + " %"),
      h("button", { class: "nx-lien", type: "button", disabled: etudeEnCours || s.niveau >= 1, onclick: () => etudier(s.id) }, s.niveau >= 1 ? "couvert" : "Étudier"))));
  }
  async function etudier(id) {
    if (etudeEnCours) return; etudeEnCours = true; rafraichir();
    const note = h("p", { class: "nx-dim" }, "Recherche dans les références…"); detail.prepend(note);
    try {
      const r = await savoir.etudier(id);
      note.textContent = r.ok ? (r.propose ? `${r.propose} proposition(s) déposée(s) dans « À valider » (${r.interrogees} références interrogées). Le pourcentage monte quand tu les gardes.` : `Rien de nouveau trouvé (${r.interrogees} références interrogées).`) : "Étude impossible : " + r.erreur;
      if (r.ok && r.propose) document.dispatchEvent(new CustomEvent("noyau:a-valider"));
    } catch (e) { note.textContent = "Étude impossible : " + (e.message || e); }
    etudeEnCours = false; const t = note.textContent; rafraichir(); detail.prepend(h("p", { class: "nx-dim" }, t));
  }

  rafraichir();
  const vers = setInterval(() => { if (!document.hidden && canvas.offsetParent) rafraichir(); }, 15000);
  document.addEventListener("noyau:memoire", rafraichir);
  return {
    racine, rafraichir, arreter() { clearInterval(vers); carte3d.arreter(); },
    ouvrir() { const w = conteneur.closest(".win"); if (w) { document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: w.dataset.id })); w.classList.remove("hid"); } rafraichir(); }
  };
}
