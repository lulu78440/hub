// Noyau · vues de l'orchestrateur (lot 4) : bandeau de fraîcheur des sources, jeu de panneaux à plage et variables partagées, graphe d'un plan.
// DOM et SVG écrits à la main : createElement, createElementNS, textContent et setAttribute seulement (jamais de HTML construit en texte).
// Tout marche sans IA, sans WebGL, sans bibliothèque. Aucune vue ne déclenche d'appel réseau ni d'écriture : ce sont des lectures.
import { rendre, badgeFraicheur } from "./composants.js";
import { optionsParDefaut } from "../modules.js";
import { horloge, evaluerFraicheur, evaluerSource, pireNiveau, NIVEAUX } from "./fraicheur.js";
import { disposerPlan, verifierPlan, NOEUD, STATUTS_PLAN, lignePlanTexte } from "./plan-graphe.js";
import { verifierTableau, creerEtat, plagesProposees, deriver, RefusPanneaux } from "../panneaux.js";

const NS = "http://www.w3.org/2000/svg";
const doc = () => { const d = globalThis.document; if (!d) throw new Error("Aucun document pour afficher."); return d; };
function poser(e, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "texte") e.textContent = String(v); else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : String(v));
  }
}
const garnir = (e, enfants) => { for (const c of enfants.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : doc().createTextNode(String(c))); return e; };
const h = (tag, attrs, ...enfants) => { const e = doc().createElement(tag); poser(e, attrs); return garnir(e, enfants); };
const s = (tag, attrs, ...enfants) => { const e = doc().createElementNS(NS, tag); poser(e, attrs); return garnir(e, enfants); };
let compteur = 0; const uid = (p) => `nxo-${p}-${++compteur}`;
const coupe = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + "…" : String(t));

// ---------------------------------------------------------------- 1. Fraîcheur de chaque source
/**
 * Bandeau « Sources » : une ligne par source, avec une forme ET des mots (Répond · En échec · Coupée · Pas encore appelée),
 * l'âge de la dernière réponse, l'erreur éventuelle, et l'âge de la dernière donnée lue. `etats` = donnees.etatSources().
 */
export function bandeauSources(etats, { maintenant = horloge.maintenant(), jeuxEnMemoire = [] } = {}) {
  if (!Array.isArray(etats)) throw new Error("bandeauSources : liste d'états attendue");
  const formes = {
    ok: () => [s("circle", { cx: 6, cy: 6, r: 5, fill: "currentColor" })],
    erreur: () => [s("path", { d: "M2 2 10 10M10 2 2 10", stroke: "currentColor", "stroke-width": 1.8, fill: "none" })],
    coupee: () => [s("path", { d: "M3.5 2v8M8.5 2v8", stroke: "currentColor", "stroke-width": 2, fill: "none" })],
    inactive: () => [s("circle", { cx: 6, cy: 6, r: 4.6, fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-dasharray": "2 1.6" })]
  };
  const liste = h("ul", { class: "nxo-sources" });
  for (const e of etats) {
    const v = evaluerSource(e, { maintenant });
    liste.append(h("li", { class: `nxo-source nxo-source-${v.niveau}`, "data-niveau": v.niveau },
      h("span", { class: "nxo-etat" }, s("svg", { class: "nxf-forme", viewBox: "0 0 12 12", width: 12, height: 12, "aria-hidden": "true", focusable: "false" }, ...formes[v.niveau]()), h("span", { class: "nxf-mot", texte: v.libelle })),
      h("b", { class: "nxo-nom", texte: coupe(v.nom, 60) }), h("span", { class: "nxc-discret", texte: " · " + v.hote }),
      v.lignes.length ? h("div", { class: "nxc-discret nxo-detail", texte: v.lignes.join(" · ") }) : null));
  }
  const pire = jeuxEnMemoire.length ? pireNiveau(jeuxEnMemoire.map((j) => evaluerFraicheur(j, { maintenant }).niveau)) : null;
  return h("section", { class: "nxc nxo-bandeau", "aria-label": "Fraîcheur des sources" },
    h("h3", { class: "nxc-titre", texte: "Sources de données" }), liste,
    pire ? h("p", { class: "nxc-discret", texte: `Jeux en mémoire : le moins frais est « ${NIVEAUX[pire].libelle} ».` }) : null);
}

// ---------------------------------------------------------------- 2. Jeu de panneaux : plage et variables partagées
/**
 * tableauDePanneaux(spec, { lire, depose, maintenant, vues }) : une plage de temps et des variables commandent tous les panneaux.
 *  - spec : { titre, plage?, variables?, panneaux: [{ id, titre, jeu: "jeu:…", vue, options? }] } (vérifiée par panneaux.js) ;
 *  - lire(ref) → jeu ; depose(ref) → ms où le jeu est entré en mémoire (facultatif) ; vues = rendre (remplaçable dans les essais).
 * Chaque panneau montre son badge de fraîcheur (« à jour / en retard / ancien … ») et garde son pied de sources.
 * Rend un élément ; .composant = { etat, rafraichir() }. Un refus de spécification devient un encadré, jamais une exception.
 */
export function tableauDePanneaux(specBrute, { lire, depose = () => null, maintenant = () => horloge.maintenant(), vues = rendre } = {}) {
  let spec;
  try { spec = verifierTableau(specBrute, lire); }
  catch (e) { return h("div", { class: "nxc-refus", role: "alert", texte: e instanceof RefusPanneaux ? e.message : "Tableau de panneaux refusé : erreur interne." }); }
  const etat = creerEtat(spec), racine = h("section", { class: "nxc nxp", "aria-label": spec.titre });
  const jeux = spec.panneaux.map((p) => { try { return lire(p.jeu); } catch (e) { return null; } }).filter(Boolean);
  const proposees = plagesProposees(jeux);
  const entete = h("header", { class: "nxp-tete" }, h("h3", { class: "nxc-titre", texte: spec.titre }));
  const resume = h("span", { class: "nxp-resume" }); entete.append(resume);
  // Contrôles : plage (choix rapides + dates libres) puis variables
  const idPlage = uid("plage"), choix = h("select", { class: "nxc-champ", id: idPlage, "aria-label": "Plage de temps" }, proposees.map((p) => h("option", { value: p.id, texte: p.libelle })), h("option", { value: "libre", texte: "Dates libres…" }));
  const champD = h("input", { class: "nxc-champ", type: "text", inputmode: "numeric", placeholder: "AAAA ou AAAA-MM", "aria-label": "Début", maxlength: 10, size: 10 });
  const champF = h("input", { class: "nxc-champ", type: "text", inputmode: "numeric", placeholder: "AAAA ou AAAA-MM", "aria-label": "Fin", maxlength: 10, size: 10 });
  const msg = h("span", { class: "nxp-msg", role: "status" });
  const appliquer = () => { try { msg.textContent = ""; etat.definirPlage({ debut: champD.value.trim(), fin: champF.value.trim() }); } catch (e) { msg.textContent = e.message.replace(/^Tableau de panneaux refusé : /, ""); } };
  choix.addEventListener("change", () => {
    const p = proposees.find((x) => x.id === choix.value);
    if (p) { champD.value = p.debut; champF.value = p.fin; champD.disabled = champF.disabled = true; try { msg.textContent = ""; etat.definirPlage({ debut: p.debut, fin: p.fin }); } catch (e) { msg.textContent = e.message; } }
    else { champD.disabled = champF.disabled = false; }
  });
  champD.disabled = champF.disabled = true;
  champD.value = spec.plage.debut; champF.value = spec.plage.fin;
  const ctl = h("div", { class: "nxp-controles", role: "group", "aria-label": "Réglages partagés par tous les panneaux" },
    h("label", {}, "Plage ", choix), h("label", {}, "du ", champD), h("label", {}, "au ", champF), h("button", { class: "nxc-lien", type: "button", onclick: () => { choix.value = "libre"; champD.disabled = champF.disabled = false; appliquer(); } }, "Appliquer"), msg);
  const selecteurs = [];
  for (const v of spec.variables) {
    const sel = h("select", { class: "nxc-champ", "aria-label": v.libelle }, v.options.map((o) => h("option", { value: o.valeur, texte: o.libelle })));
    sel.value = v.defaut; selecteurs.push([v, sel]);
    sel.addEventListener("change", () => { try { msg.textContent = ""; etat.definirVariable(v.id, sel.value); } catch (e) { msg.textContent = e.message; } });
    ctl.append(h("label", {}, v.libelle + " ", sel));
  }
  const reinit = h("button", { class: "nxc-lien", type: "button", onclick: () => { choix.value = proposees[0].id; champD.value = spec.plage.debut; champF.value = spec.plage.fin; champD.disabled = champF.disabled = true; selecteurs.forEach(([v, sel]) => { sel.value = v.defaut; }); msg.textContent = ""; etat.reinitialiser(); } }, "Réinitialiser");
  ctl.append(reinit);
  const grille = h("div", { class: "nxp-grille" });
  const corps = new Map();
  for (const p of spec.panneaux) {
    const b = h("div", { class: "nxp-corps" }), badge = h("span", { class: "nxp-badge" });
    corps.set(p.id, { b, badge });
    grille.append(h("article", { class: "nxp-panneau", "data-panneau": p.id }, h("header", { class: "nxp-tete-p" }, h("h4", { class: "nxp-titre", texte: p.titre }), badge), b));
  }
  const dessiner = () => {
    const now = maintenant(), niveaux = [], st = etat.lire();
    for (const p of spec.panneaux) {
      const { b, badge } = corps.get(p.id), r = deriver(p, spec, st, lire);
      b.textContent = ""; badge.textContent = "";
      let source = null; try { source = lire(p.jeu); } catch (e) { /* signalé par deriver */ }
      if (source) { badge.append(badgeFraicheur(source, { maintenant: now, chargeMs: depose(p.jeu), court: true })); niveaux.push(evaluerFraicheur(source, { maintenant: now }).niveau); }
      if (r.erreur) b.append(h("div", { class: "nxc-vide", role: "status", texte: r.erreur }));
      else {
        // Colonnes choisies par le hub (comme afficher_module) ; une variable « colonne » laisse une seule colonne de nombres : celle-là.
        let o;
        try { const voulu = { ...p.options }; if (r.etapes.includes("colonne")) { delete voulu.y; delete voulu.valeur; } o = { titre: p.titre, ...voulu, ...optionsParDefaut(p.vue, r.jeu, voulu) }; }
        catch (e) { b.append(h("div", { class: "nxc-vide", role: "status", texte: "Ce panneau ne peut pas être affiché : " + e.message })); continue; }
        b.append(vues(p.vue, r.jeu, o));
      }
    }
    const pire = niveaux.length ? pireNiveau(niveaux) : "inconnu";
    resume.textContent = ""; resume.append(h("span", { class: "nxc-discret", texte: "Le moins frais : " }), h("span", { class: `nxf nxf-${pire}`, "data-niveau": pire, texte: NIVEAUX[pire].glyphe + " " + NIVEAUX[pire].libelle }));
    // Plage appliquée, dite en toutes lettres (jamais un filtre silencieux)
    const pl = st.plage; msg.textContent = msg.textContent || ((pl.debut || pl.fin) ? `Plage appliquée : ${pl.debut || "début"} → ${pl.fin || "fin"}` : "");
  };
  etat.abonner(dessiner);
  racine.append(entete, ctl, grille);
  dessiner();
  racine.composant = { etat, rafraichir: dessiner, spec };
  return racine;
}

// ---------------------------------------------------------------- 3. Un plan vu comme un graphe de nœuds (lecture seule)
/**
 * grapheDePlan(appels, lignes?) : les étapes sont des nœuds, les « $N.champ » des flèches. `lignes` = résultat d'executerPlan (statuts réels) ;
 * sans `lignes`, le plan est montré « prévu ». Aucune interaction : ni clic, ni glisser, ni envoi. Une liste de secours dit la même chose en texte.
 */
export function grapheDePlan(appels, lignes = null, { titre = "Plan" } = {}) {
  const v = verifierPlan(appels);
  const etapes = v.etapes.map((e, i) => ({ ...e, ligne: lignes && lignes[i] ? lignes[i] : null }));
  const g = disposerPlan(etapes), idFl = uid("fleche");
  const svg = s("svg", { class: "nxg-svg", viewBox: `0 0 ${g.largeur || 10} ${g.hauteur || 10}`, width: g.largeur || 10, height: g.hauteur || 10, role: "img", "aria-label": `${titre} : ${g.noeuds.length} étape(s)` },
    s("defs", {}, s("marker", { id: idFl, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto" }, s("path", { d: "M0 0 8 4 0 8z", fill: "currentColor" }))));
  for (const l of g.liens) svg.append(s("path", { class: "nxg-lien", d: l.d, fill: "none", stroke: "currentColor", "stroke-width": 1.4, "marker-end": `url(#${idFl})` }));
  for (const n of g.noeuds) {
    const st = STATUTS_PLAN[n.statut], L = n.ligne || {};
    const info = lignePlanTexte(n);
    svg.append(s("g", { class: `nxg-noeud nxg-${n.statut}`, "data-statut": n.statut, "data-etape": n.n, transform: `translate(${n.x} ${n.y})` },
      s("title", { texte: info }),
      s("rect", { width: NOEUD.l, height: NOEUD.h, rx: 6, fill: "none", stroke: "currentColor", "stroke-width": n.statut === "echec" ? 2.4 : 1.4, "stroke-dasharray": n.statut === "reussie" ? null : n.statut === "prevue" ? "4 3" : n.statut === "refusee" ? "7 3" : "2 3" }),
      s("text", { x: 10, y: 21, "font-size": 15, fill: "currentColor", texte: st.glyphe }),
      s("text", { x: 30, y: 21, "font-size": 13, fill: "currentColor", texte: coupe(n.nom, 20) }),
      s("text", { x: 10, y: 41, "font-size": 11, class: "nxg-sous", fill: "currentColor", texte: `étape ${n.n} · ${st.libelle}${(L.essais || 1) > 1 ? ` · ${L.essais} essais` : ""}${L.secours ? " · secours" : ""}` })));
  }
  const liste = h("ol", { class: "nxg-liste" }, g.noeuds.map((n) => h("li", { texte: lignePlanTexte(n) })));
  return h("figure", { class: "nxc nxg", "aria-label": titre },
    h("figcaption", { class: "nxc-titre", texte: titre }),
    h("div", { class: "nxg-defil" }, svg),
    v.ok ? null : h("p", { class: "nxc-refus", role: "alert", texte: "Plan incohérent : " + v.problemes.join(" ; ") }),
    h("details", { class: "nxg-repli" }, h("summary", { texte: "Voir les étapes en liste" }), liste),
    lignes && lignes.bilan ? h("p", { class: "nxc-discret", texte: `Bilan : ${lignes.bilan.reussies} réussie(s) sur ${lignes.bilan.etapes}${lignes.bilan.en_echec ? " · " + lignes.bilan.en_echec + " en échec" : ""}${lignes.bilan.refusees ? " · " + lignes.bilan.refusees + " refusée(s)" : ""}${lignes.bilan.non_executees ? " · " + lignes.bilan.non_executees + " non exécutée(s)" : ""}${lignes.bilan.reprises ? " · " + lignes.bilan.reprises + " reprise(s)" : ""}` }) : null);
}
