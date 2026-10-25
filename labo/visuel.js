// Laboratoire · onglet « Visuel » : la carte neuronale, les radars des critères et les courbes de progression.
import { h, courbe, garnir } from "./ui-labo.js";
import { GRILLES } from "./etat-labo.js";
import { monterCarte3d } from "../js/noyau/carte3d.js";
import { PROGRAMME } from "../js/noyau/curriculum.js";
import { lancerTest } from "../js/noyau/fenetre-savoir.js";

const NS = "http://www.w3.org/2000/svg";
const el = (t, a = {}, ...k) => { const e = document.createElementNS(NS, t); for (const [n, v] of Object.entries(a)) e.setAttribute(n, v); e.append(...k); return e; };

/** Radar : une ligne par critère (0 au centre, `max` au bord). Les critères sans note restent au centre. */
export function radar(crit, { max = 5, taille = 280, couleur = "#3fe6ff", titre = "Radar" } = {}) {
  const c = taille / 2, R = c - 62, n = crit.length, svg = el("svg", { viewBox: `0 0 ${taille} ${taille}`, width: taille, height: taille, role: "img", "aria-label": titre });
  const pt = (i, f) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  for (const f of [0.25, 0.5, 0.75, 1]) svg.append(el("polygon", { points: crit.map((_, i) => pt(i, f).map((x) => x.toFixed(1)).join(",")).join(" "), fill: "none", stroke: "rgba(63,230,255,.18)" }));
  crit.forEach((k, i) => {
    const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.2); svg.append(el("line", { x1: c, y1: c, x2: x, y2: y, stroke: "rgba(63,230,255,.15)" }));
    const t = el("text", { x: lx, y: ly, "text-anchor": lx < c - 4 ? "end" : lx > c + 4 ? "start" : "middle", "dominant-baseline": "middle", fill: "#cfeaf2", "font-size": 10 }, k.nom + (k.v == null ? "" : " " + k.v)); svg.append(t);
  });
  svg.append(el("polygon", { points: crit.map((k, i) => pt(i, Math.max(0, Math.min(1, (k.v || 0) / max))).map((x) => x.toFixed(1)).join(",")).join(" "), fill: couleur + "33", stroke: couleur, "stroke-width": 1.8 }));
  crit.forEach((k, i) => { if (k.v != null) { const [x, y] = pt(i, Math.min(1, k.v / max)); svg.append(el("circle", { cx: x, cy: y, r: 3, fill: couleur })); } });
  return svg;
}

/** Savoir fictif pour voir la carte s'animer sans rien apprendre pour de vrai. */
export function carteDemo() {
  const domaines = PROGRAMME.map((d, i) => { const sts = d.sousThemes.map((s, j) => ({ id: s.id, titre: s.titre, niveau: i % 4 === 0 ? (j % 3 === 0 ? 1 : j % 3 === 1 ? 0.5 : 0) : i % 4 === 1 ? (j % 2 ? 0.5 : 0) : 0, fiches: 0, points: 0 })); return { id: d.id, nom: d.nom, symbole: d.symbole, couleur: d.couleur, pct: Math.round(sts.reduce((a, s) => a + s.niveau, 0) / sts.length * 100), couverts: 0, entames: 0, total: sts.length, fiches: 0, sousThemes: sts }; });
  const liens = []; for (let i = 0; i + 4 < PROGRAMME.length; i += 4) liens.push({ a: PROGRAMME[i].sousThemes[0].id, b: PROGRAMME[i + 1].sousThemes[1].id, force: 0.7 });
  return { domaines, liens, global: 0, fiches: 0, couverts: 0, total: 0 };
}

let carte3d = null;
export function rendreVisuel(c, ctx) {
  const { etat } = ctx; if (carte3d) { carte3d.arreter(); carte3d = null; } c.textContent = ""; garnir(c);
  const canvas = h("canvas", { class: "lab-carte", tabindex: "0", style: "width:100%;height:560px;display:block;background:#02060d;border:1px solid rgba(63,230,255,.25);border-radius:8px" });
  let demo = false;
  const alimenter = () => { let r = null; try { r = demo ? carteDemo() : ctx.noyau().savoir.carte(); } catch (e) { r = carteDemo(); } carteCourante = r; carte3d.definir(r); return r; };
  const note = h("p", { class: "dim" }), choix = h("div", { class: "lab-choix", "aria-live": "polite" }), zoneTest = h("div", { class: "nx nx-sv-test" });
  const surSel = (id) => {
    choix.textContent = ""; zoneTest.textContent = ""; if (!id) return;
    const r = alimenter && carteCourante, d = r && r.domaines.find((x) => x.id === id || x.sousThemes.some((s) => s.id === id)); if (!d) return;
    const st = d.sousThemes.find((s) => s.id === id);
    if (!st) { choix.append(h("p", {}, `${d.symbole} ${d.nom} · ${d.pct} % · ${d.couverts}/${d.total} sous-thèmes couverts`)); return; }
    choix.append(h("p", {}, h("b", {}, st.titre), ` · ${d.nom} · ${Math.round(st.niveau * 100)} %`),
      demo ? h("p", { class: "dim" }, "Démonstration : le test ne s'applique qu'au savoir réel du bac à sable.") : st.niveau >= 1 ? h("p", { class: "dim" }, "Déjà validé.") : h("button", { class: "lab-btn", type: "button", onclick: () => lancerTest(ctx.noyau().savoir, st.id, zoneTest, () => maj()) }, "Réaliser le test pour valider ce point"));
  };
  let carteCourante = null;
  const bascule = h("button", { class: "lab-btn", type: "button", onclick: () => { demo = !demo; bascule.textContent = demo ? "Revenir au savoir du bac à sable" : "Voir une démonstration animée"; maj(); } }, "Voir une démonstration animée");
  const maj = () => { const r = alimenter(); note.textContent = demo ? "Démonstration : un savoir inventé pour voir les influx. Ce n'est pas le savoir de ton Noyau." : `Savoir du bac à sable : ${r.global} % du programme. Dans ton vrai Noyau, la même carte s'allume au fil de ce que tu valides.`; };
  c.append(h("h3", {}, "Carte neuronale"), h("p", { class: "dim" }, "Un neurone par sous-thème. En cours d'apprentissage : influx par salves, anneau qui respire. Validé : influx réguliers, cœur blanc. Violet : deux connaissances qui se recoupent. Glisser pour tourner, molette pour zoomer."), canvas, choix, zoneTest, h("div", { class: "lab-ligne" }, bascule), note);
  carte3d = monterCarte3d(canvas, { surSelection: (id) => surSel(id) }); maj();

  c.append(h("h3", {}, "Radars des critères"), h("p", { class: "dim" }, "Moyenne des notes que tu as données dans chaque labo (de 0 à 5). Un critère jamais noté reste au centre."));
  const ligne = h("div", { class: "lab-ligne", style: "flex-wrap:wrap;gap:18px" });
  for (const [labo, couleur] of [["social", "#3fe6ff"], ["reflexion", "#b79bff"]]) {
    const m = etat.moyennes(labo); const crit = GRILLES[labo].map(([k, nom]) => ({ nom, v: m[k] ? m[k].moyenne : null }));
    ligne.append(h("figure", { style: "margin:0;text-align:center" }, radar(crit, { couleur, titre: "Radar du labo " + labo }), h("figcaption", { class: "dim" }, labo === "social" ? "Labo social" : "Labo réflexion")));
  }
  c.append(ligne);

  c.append(h("h3", {}, "Courbes"));
  const d = etat.exporter(), banc = d.banc.filter((b) => b.ok + b.ko > 0).map((b) => Math.round(b.ok / (b.ok + b.ko) * 100)), met = d.metriques.slice(-40);
  const bloc = (titre, vals, opt, unite) => h("div", { style: "margin-bottom:10px" }, h("div", { class: "dim" }, `${titre}${vals.length ? " · dernière valeur " + Math.round(vals[vals.length - 1]) + unite : " · pas encore de mesure"}`), courbe(vals, { largeur: 320, hauteur: 54, ...opt, titre }));
  c.append(bloc("Santé du banc d'essai", banc, { min: 0, max: 100 }, " %"),
    bloc("Temps de réponse (ms)", met.map((m) => m.ms), { min: 0, max: Math.max(1000, ...met.map((m) => m.ms)), couleur: "#ffb347" }, " ms"),
    bloc("Jetons par réponse", met.map((m) => m.tokens), { min: 0, max: Math.max(500, ...met.map((m) => m.tokens)), couleur: "#b79bff" }, ""));
}
