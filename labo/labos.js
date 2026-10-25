// Laboratoire · les deux labos : « social » (ton, chaleur, honnêteté) et « réflexion » (raisonnement, prudence, utilité).
// On essaie une situation, on note la réponse sur une grille de 5 critères, et on compare deux consignes (A/B). Les moyennes montrent la progression réelle.
import { h, barre, courbe, garnir } from "./ui-labo.js";
import { GRILLES } from "./etat-labo.js";
import { SITUATIONS, VARIANTES_DEFAUT } from "./situations.js";

const TITRES = { social: "Labo social", reflexion: "Labo réflexion" };
const INTRO = {
  social: "Ici on améliore la façon dont le Noyau parle : chaleur sans flatterie, ton juste, honnêteté, initiative discrète. Essaie une situation, note la réponse, et regarde les moyennes bouger.",
  reflexion: "Ici on améliore la façon dont le Noyau pense : raisonnement visible, prudence, usage des sources, utilité pour décider. Essaie une situation, note la réponse, et suis la progression."
};

export function rendreLabo(conteneur, labo, ctx) {
  const { etat } = ctx, noyau = () => ctx.noyau(), sits = SITUATIONS[labo], grille = GRILLES[labo];
  conteneur.textContent = ""; garnir(conteneur);
  const reel = () => ctx.mode() === "gemini" && !!ctx.cle();
  const zoneNote = garnir(h("div", { class: "lab-note" })), zoneMoy = garnir(h("div")), zoneAB = garnir(h("div"));
  const dernier = () => { const t = noyau().inspecteur()[0]; return t && t.reponse ? { question: t.question, reponse: t.reponse.texte, ms: t.ms, requetes: t.requetes } : null; };

  // ----- Situations -----
  const liste = h("div", { class: "lab-sits" });
  sits.forEach((s) => liste.append(h("div", { class: "lab-sit" }, h("div", {}, h("b", {}, s.titre), h("div", { class: "dim" }, "« " + s.texte + " »")),
    h("button", { class: "lab-btn", type: "button", onclick: () => { document.dispatchEvent(new CustomEvent("noyau:saisir", { detail: { texte: s.texte, envoyer: true } })); setTimeout(rendreNote, 400); } }, "Essayer"))));

  // ----- Noter la dernière réponse -----
  let notes = {};
  function rendreNote() {
    zoneNote.textContent = ""; const d = dernier();
    if (!d) { zoneNote.append(h("p", { class: "dim" }, "Pas encore de réponse à noter : essaie une situation ci-dessus (ou parle au Noyau).")); return; }
    notes = {};
    zoneNote.append(h("p", { class: "dim" }, "Dernière question : « " + d.question.slice(0, 120) + " »"), h("pre", { class: "i" }, d.reponse));
    grille.forEach(([k, nom, aide]) => {
      const ligne = h("div", { class: "lab-crit" }, h("span", {}, h("b", {}, nom), h("small", { class: "dim" }, " " + aide)));
      const bs = h("span", { class: "lab-notes", role: "group", "aria-label": nom });
      for (let n = 1; n <= 5; n++) bs.append(h("button", { class: "lab-n", type: "button", "aria-pressed": "false", onclick: (e) => { notes[k] = n; [...bs.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i + 1 === n))); } }, String(n)));
      ligne.append(bs); zoneNote.append(ligne);
    });
    const msg = h("span", { class: "dim" });
    zoneNote.append(h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: () => {
      try {
        const sit = sits.find((s) => s.texte === d.question);
        etat.ajouterNote({ labo, situation: sit ? sit.id : "libre", question: d.question, reponse: d.reponse, moteur: noyau().statut().moteur, criteres: notes });
        msg.textContent = "Note enregistrée."; notes = {}; rendreMoyennes(); ctx.surChangement && ctx.surChangement();
        [...zoneNote.querySelectorAll(".lab-n")].forEach((b) => b.setAttribute("aria-pressed", "false"));
      } catch (e) { msg.textContent = e.message === "Aucun critère noté" ? "Note au moins un critère (de 1 à 5)." : e.message; }
    } }, "Enregistrer ma note"), msg));
  }

  // ----- Moyennes et progression -----
  function rendreMoyennes() {
    zoneMoy.textContent = ""; const m = etat.moyennes(labo), n = etat.notes(labo).length;
    zoneMoy.append(h("h3", {}, "Progression réelle"), h("p", { class: "dim" }, n ? `${n} réponse(s) notée(s). La flèche compare tes 5 dernières notes aux 5 précédentes.` : "Aucune note : tant que tu n'as rien noté, aucune progression n'est affichée."));
    for (const [k, c] of Object.entries(m)) zoneMoy.append(h("div", { class: "lab-moy" }, h("span", {}, c.nom), barre(c.moyenne ? c.moyenne / 5 : 0, c.moyenne >= 4 ? "var(--ok)" : c.moyenne >= 3 ? "var(--cyan)" : "var(--amber)"), h("span", { class: "dim" }, c.moyenne == null ? "—" : `${String(c.moyenne).replace(".", ",")} / 5`), h("span", { class: c.tendance > 0 ? "lab-haut" : c.tendance < 0 ? "lab-bas" : "dim", title: c.tendance == null ? "Pas assez de notes pour une tendance" : "Évolution" }, c.tendance == null ? "" : c.tendance > 0 ? "↗ +" + String(c.tendance).replace(".", ",") : c.tendance < 0 ? "↘ " + String(c.tendance).replace(".", ",") : "→")));
    const g = etat.notes(labo).map((x) => { const v = Object.values(x.criteres); return v.reduce((a, b) => a + b, 0) / v.length; });
    if (g.length > 1) zoneMoy.append(h("div", { class: "lab-ligne" }, courbe(g.slice(-30), { min: 1, max: 5, titre: "Note moyenne par réponse" }), h("small", { class: "dim" }, "note moyenne des " + Math.min(30, g.length) + " dernières réponses")));
  }

  // ----- Comparateur A/B -----
  function rendreAB() {
    zoneAB.textContent = ""; const [dA, dB] = VARIANTES_DEFAUT[labo];
    const sel = h("select", { class: "lab-champ", "aria-label": "Situation à comparer" }, sits.map((s) => h("option", { value: s.id }, s.titre)));
    const a = h("textarea", { class: "lab-champ", rows: "2", "aria-label": "Consigne A" }), b = h("textarea", { class: "lab-champ", rows: "2", "aria-label": "Consigne B" }); a.value = dA; b.value = dB;
    const sortie = garnir(h("div")), btn = h("button", { class: "lab-btn", type: "button", disabled: !reel() }, "Comparer (2 requêtes Gemini)");
    btn.addEventListener("click", async () => {
      btn.disabled = true; sortie.textContent = ""; const s = sits.find((x) => x.id === sel.value), res = {};
      try {
        for (const [k, v] of [["a", a.value], ["b", b.value]]) { noyau().oublierConversation(); noyau().definirVariante(v); res[k] = (await noyau().poser(s.texte, "lucien")).texte; }
      } catch (e) { sortie.append(h("p", { class: "avert" }, "Comparaison interrompue : " + (e.message || e))); }
      finally { noyau().definirVariante(""); noyau().oublierConversation(); btn.disabled = !reel(); }
      if (!res.a || !res.b) return;
      const choix = (c, nom) => h("button", { class: "lab-btn", type: "button", onclick: () => { etat.ajouterAB({ situation: s.id, a: a.value, b: b.value, choix: c, texteA: res.a, texteB: res.b }); rendreAB(); ctx.surChangement && ctx.surChangement(); } }, nom);
      sortie.append(h("div", { class: "lab-ab" }, h("div", {}, h("b", {}, "A"), h("pre", { class: "i" }, res.a)), h("div", {}, h("b", {}, "B"), h("pre", { class: "i" }, res.b))), h("div", { class: "lab-ligne" }, "Laquelle est la meilleure ? ", choix("a", "A"), choix("b", "B"), choix("egal", "Pareil")));
    });
    const sc = etat.scoreAB();
    zoneAB.append(h("h3", {}, "Comparer deux consignes (A/B)"),
      h("p", { class: "dim" }, "Le Noyau répond deux fois à la même situation, avec une consigne différente ajoutée à son instruction. Tu choisis la meilleure : le score te dit quelle façon de faire mérite de devenir la règle. Les consignes d'essai ne sont jamais gardées après la comparaison."),
      reel() ? null : h("p", { class: "avert" }, "Disponible avec Gemini réel : choisis-le dans l'onglet Moteur et colle la clé du laboratoire. Le moteur de démonstration ne tient pas compte des consignes."),
      sel, h("label", { class: "dim" }, "Consigne A"), a, h("label", { class: "dim" }, "Consigne B"), b, h("div", { class: "lab-ligne" }, btn), sortie,
      h("p", { class: "dim" }, sc.n ? `Score sur ${sc.n} comparaison(s), tous labos : A ${sc.a} · B ${sc.b} · pareil ${sc.egal}.` : "Aucune comparaison pour l'instant."));
  }

  conteneur.append(h("p", { class: "dim" }, INTRO[labo]), h("h3", {}, "Situations"), liste, h("h3", {}, "Noter la réponse"), zoneNote, zoneMoy, zoneAB);
  rendreNote(); rendreMoyennes(); rendreAB();
  return { rafraichir() { rendreNote(); rendreMoyennes(); rendreAB(); } };
}
export { TITRES };
