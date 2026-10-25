// Laboratoire · composants d'affichage (lot 2 orchestrateur) : `node labo/essais-composants.mjs`
// DOM simulé minimal : toute écriture de innerHTML / outerHTML / insertAdjacentHTML fait échouer l'essai.
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
let innerHTMLTente = 0;
class Noeud {
  constructor(type) { this.nodeType = type; this.childNodes = []; this.parentNode = null; }
  get textContent() { return this.nodeType === 3 ? this._t : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { if (this.nodeType === 3) this._t = String(v); else { this.childNodes.forEach((c) => (c.parentNode = null)); this.childNodes = []; if (v !== "" && v != null) this.append(new Texte(String(v))); } }
  append(...k) { for (const c of k) { const n = typeof c === "string" ? new Texte(c) : c; if (n.parentNode) n.remove(); n.parentNode = this; this.childNodes.push(n); } }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; } }
  replaceWith(n) { const p = this.parentNode; if (!p) return; const i = p.childNodes.indexOf(this); this.parentNode = null; n.parentNode = p; p.childNodes[i] = n; }
}
class Texte extends Noeud { constructor(t) { super(3); this._t = t; } }
class Elem extends Noeud {
  constructor(tag, ns) { super(1); this.localName = tag; this.tagName = tag.toUpperCase(); this.namespaceURI = ns || "http://www.w3.org/1999/xhtml"; this._a = new Map(); this._ev = {}; this.value = ""; this.checked = false; this.disabled = false; }
  setAttribute(k, v) { this._a.set(k, String(v)); if (k === "value") this.value = String(v); }
  getAttribute(k) { return this._a.has(k) ? this._a.get(k) : null; }
  hasAttribute(k) { return this._a.has(k); }
  removeAttribute(k) { this._a.delete(k); }
  get attributes() { return [...this._a].map(([name, value]) => ({ name, value })); }
  get className() { return this.getAttribute("class") || ""; } set className(v) { this.setAttribute("class", v); }
  get hidden() { return this._a.has("hidden"); } set hidden(v) { if (v) this._a.set("hidden", ""); else this._a.delete("hidden"); }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  addEventListener(t, f) { (this._ev[t] ||= []).push(f); }
  dispatch(t, ev = {}) { const e = { type: t, isTrusted: false, preventDefault() {}, currentTarget: this, target: this, ...ev }; (this._ev[t] || []).forEach((f) => f(e)); return e; }
  click() { this.dispatch("click"); }
  closest() { return null; }
  get innerHTML() { return ""; } set innerHTML(v) { innerHTMLTente++; throw new Error("innerHTML interdit"); }
  set outerHTML(v) { innerHTMLTente++; throw new Error("outerHTML interdit"); }
  insertAdjacentHTML() { innerHTMLTente++; throw new Error("insertAdjacentHTML interdit"); }
  tous(pred, out = []) { for (const c of this.children) { if (pred(c)) out.push(c); c.tous(pred, out); } return out; }
  parTag(t) { return this.tous((e) => e.localName === t); }
  parClasse(k) { return this.tous((e) => (" " + e.className + " ").includes(" " + k + " ")); }
  un(t) { return this.parTag(t)[0]; }
  querySelector() { return null; }
}
const document = { createElement: (t) => new Elem(t), createElementNS: (ns, t) => new Elem(t, ns), createTextNode: (t) => new Texte(t), body: new Elem("body") };
globalThis.document = document;

const C = await import("../js/noyau/modules/composants.js");
const { verifierJeu, courbe, barres, tableau, chiffreCle, filtres, rendre, versCSV, versSVG, piedSourcesTexte, graduations, domaine, echelle, pasArrondi, agreger, dateVersMs, graduationsTemps, contraste, exporter, sortie, PALETTE, FOND, TEXTE, DISCRET, RefusComposant } = C;
const D = await import("./composants-demo.js");

const SRC = { nom: "Source d'essai", maj: "2026-10-01", periode: "2020-2024" };
const jeu = (x = {}) => ({ titre: "Essai", colonnes: [{ id: "annee", libelle: "Année", type: "date" }, { id: "geo", libelle: "Lieu", type: "texte" }, { id: "valeur", libelle: "Valeur", type: "nombre" }], lignes: [["2020", "A", 10], ["2021", "A", 20], ["2022", "A", 15], ["2020", "B", 5], ["2021", "B", null], ["2022", "B", 30]], unite: "habitants", source: { ...SRC }, ...x });
const refuse = (f, re, m) => { let e = null; try { f(); } catch (x) { e = x; } ok(e instanceof RefusComposant && re.test(e.message), m + (e ? " — " + e.message : " — accepté à tort")); };

// ---------- 1. Schéma strict et refus sans source
refuse(() => verifierJeu(jeu({ source: undefined })), /source manquante/, "jeu sans source : refusé");
for (const k of ["nom", "maj", "periode"]) { const s = { ...SRC }; delete s[k]; refuse(() => verifierJeu(jeu({ source: s })), /manquant/, `source sans « ${k} » : refusée`); }
refuse(() => verifierJeu(jeu({ unite: "" })), /unité manquant/, "jeu sans unité : refusé");
refuse(() => verifierJeu(jeu({ code: "alert(1)" })), /champ inconnu/, "champ inconnu dans le jeu : refusé");
refuse(() => verifierJeu(jeu({ source: { ...SRC, script: "x" } })), /champ inconnu/, "champ inconnu dans la source : refusé");
refuse(() => verifierJeu(jeu({ source: { ...SRC, url: "javascript:alert(1)" } })), /https/, "lien javascript: refusé");
refuse(() => verifierJeu(jeu({ source: { ...SRC, url: "http://exemple.fr" } })), /https/, "lien http (non chiffré) refusé");
refuse(() => verifierJeu(jeu({ source: { ...SRC, maj: "hier" } })), /invalide/, "date de mise à jour invalide : refusée");
refuse(() => verifierJeu(jeu({ source: { ...SRC, maj: "2999-01-01" } })), /futur/, "date de mise à jour dans le futur : refusée");
refuse(() => verifierJeu(jeu({ lignes: [["2020-02-30", "A", 1]] })), /date invalide/, "date inexistante (30 février) : refusée");
refuse(() => verifierJeu(jeu({ lignes: [["2020", "A", "12"]] })), /nombre attendu/, "nombre écrit en texte : refusé (pas de conversion silencieuse)");
refuse(() => verifierJeu(jeu({ lignes: [["2020", "A", NaN]] })), /nombre attendu/, "NaN : refusé");
refuse(() => verifierJeu(jeu({ lignes: [["2020", "A", Infinity]] })), /nombre attendu/, "Infini : refusé");
refuse(() => verifierJeu(jeu({ lignes: [["2020", "A"]] })), /3 valeurs/, "ligne incomplète : refusée");
refuse(() => verifierJeu(jeu({ colonnes: [{ id: "x", libelle: "X", type: "fonction" }], lignes: [] })), /type de colonne inconnu/, "type de colonne hors liste blanche : refusé");
refuse(() => verifierJeu(jeu({ colonnes: [{ id: "__proto__", libelle: "X", type: "nombre" }], lignes: [] })), /identifiant de colonne invalide/, "identifiant de colonne piégé : refusé");
refuse(() => verifierJeu(jeu({ titre: "Titre\u202eeludom" })), /contrôle/, "inversion bidirectionnelle dans le titre : refusée");
const jv = verifierJeu(jeu());
ok(Object.isFrozen(jv) && Object.isFrozen(jv.lignes[0]) && Object.isFrozen(jv.source), "jeu vérifié : copie figée (lignes et source)");
const avecRefus = rendre("courbe", jeu({ source: undefined }), { x: "annee", y: "valeur" });
ok(avecRefus.className === "nxc-refus" && avecRefus.getAttribute("role") === "alert" && /source manquante/.test(avecRefus.textContent) && !avecRefus.parTag("svg").length, "rendre() sans source : encadré « Affichage refusé », aucun graphique");
for (const t of ["tableau", "barres", "chiffre_cle"]) ok(rendre(t, jeu({ source: undefined }), { categorie: "geo", valeur: "valeur" }).className === "nxc-refus", `${t} sans source : refusé aussi`);
ok(/type de vue inconnu/.test(rendre("carte3d", jv, {}).textContent), "type de vue hors liste blanche : refusé");
ok(/type de vue inconnu/.test(rendre("__proto__", jv, {}).textContent), "type « __proto__ » : refusé");
ok(/absente du jeu/.test(rendre("courbe", jv, { x: "annee", y: "inexistante" }).textContent), "colonne inexistante : refusée avec la raison");
ok(/impossible/.test(rendre("courbe", jv, { x: "annee", y: "geo" }).textContent), "texte sur un axe de nombres : refusé");

// ---------- 2. Échelles et graduations (fonctions pures)
ok(JSON.stringify(graduations(0, 100, 5)) === "[0,20,40,60,80,100]", "graduations 0-100 : 0, 20 … 100");
ok(JSON.stringify(graduations(0.1, 0.9, 4)) === "[0.2,0.4,0.6,0.8]", "graduations décimales sans erreur d'arrondi (0,2 … 0,8)");
ok(JSON.stringify(domaine(3, 97)) === "[0,100]", "domaine arrondi 3-97 → 0-100");
ok(JSON.stringify(domaine(-7, 12, 5, { zero: true })) === "[-10,15]", "domaine avec négatifs et zéro → -10 à 15");
ok(domaine(5, 5)[0] < 5 && domaine(5, 5)[1] > 5, "une seule valeur : domaine élargi autour d'elle");
ok(pasArrondi(1000, 5) === 200 && pasArrondi(7, 5) === 2 && pasArrondi(0.03, 3) === 0.01, "pas arrondis 1-2-5");
const e = echelle([0, 100], [300, 0]); ok(e(0) === 300 && e(100) === 0 && e(50) === 150 && e.inverse(150) === 50, "échelle linéaire inversée (axe y) et son inverse");
ok(dateVersMs("2024") === Date.UTC(2024, 0, 1) && dateVersMs("2024-02-29") !== null && dateVersMs("2023-02-29") === null && dateVersMs("2024-13") === null, "dates : années bissextiles et mois invalides");
const gt = graduationsTemps(Date.UTC(2000, 0, 1), Date.UTC(2024, 0, 1)); ok(gt.format === "annee" && gt.valeurs.every((t) => new Date(t).getUTCFullYear() % 5 === 0), "axe temporel sur 24 ans : années rondes (pas de 5)");
const gm = graduationsTemps(Date.UTC(2024, 0, 1), Date.UTC(2024, 11, 1)); ok(gm.format === "mois" && gm.valeurs.length >= 4 && gm.valeurs.length <= 12, "axe temporel sur un an : mois");
const pts = Array.from({ length: 5001 }, (_, i) => ({ x: i, xs: i, y: i })), ag = agreger(pts);
ok(ag.agrege && ag.points.length <= 5000 && ag.avant === 5001, "5 001 points : agrégés sous le plafond (" + ag.points.length + ")");
ok(!agreger(pts.slice(0, 5000)).agrege, "5 000 points : aucun changement");

// ---------- 3. Rendu SVG de la courbe
const fc = courbe(jv, { x: "annee", y: "valeur", series: "geo" }), svg = fc.composant.svg;
const chemins = svg.parTag("path");
ok(svg.namespaceURI === "http://www.w3.org/2000/svg" && svg.getAttribute("viewBox") === "0 0 640 300", "courbe : un SVG (espace de noms SVG, viewBox 640×300)");
ok(chemins.length === 2, "deux séries → deux chemins");
const dA = chemins[0].getAttribute("d"), dB = chemins[1].getAttribute("d");
ok(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+$/.test(dA), "série A : un trait continu de 3 points (" + dA + ")");
ok((dB.match(/M/g) || []).length === 2 && !/L/.test(dB), "série B : valeur manquante → trait interrompu, rien d'inventé (" + dB + ")");
const xy = (d) => d.match(/[\d.]+ [\d.]+/g).map((p) => p.split(" ").map(Number));
const [[ax0, ay0], [ax1, ay1]] = xy(dA);
ok(ax0 === 58 && Math.abs(xy(dA)[2][0] - 624) < 0.01, "x : premier point au bord gauche (58), dernier au bord droit (624)");
ok(ay1 < ay0, "y : 20 est plus haut que 10 (axe orienté vers le haut)");
const ty = svg.parTag("text").map((t) => t.textContent);
ok(ty.includes("5") && ty.includes("30") && ty.includes("2020") && ty.includes("2022") && ty.includes("habitants"), "axes : graduations rondes 5 à 30 (min 5, max 30), années, unité affichée");
ok(chemins.every((p) => p.getAttribute("stroke")) && chemins[1].getAttribute("stroke-dasharray"), "séries distinguées par la couleur ET le motif de trait");
ok(svg.getAttribute("role") === "img" && svg.getAttribute("tabindex") === "0" && svg.un("title") && /2 série/.test(svg.un("desc").textContent), "accessibilité : role=img, titre, description, focus clavier");
const eqv = fc.parClasse("nxc-equivalent")[0]; ok(eqv && eqv.un("table") && eqv.un("table").parTag("tr").length === 7, "tableau équivalent présent (en-tête + 6 lignes)");
ok(eqv.un("table").un("caption") && eqv.un("table").parTag("th").every((t) => t.getAttribute("scope") === "col"), "tableau équivalent : légende et en-têtes de colonne");
const pied = fc.parClasse("nxc-pied")[0]; ok(pied && /Source d'essai/.test(pied.textContent) && /1 oct\. 2026/.test(pied.textContent) && /habitants/.test(pied.textContent) && /2020-2024/.test(pied.textContent), "pied de sources : source, date de mise à jour, unité, période");
svg.dispatch("keydown", { key: "ArrowRight" }); ok(/2020 · A : 10 · B : 5/.test(fc.parClasse("nxc-lecture")[0].textContent), "clavier : flèche droite → lecture « 2020 · A : 10 · B : 5 »");
svg.dispatch("keydown", { key: "ArrowRight" }); ok(/B : —/.test(fc.parClasse("nxc-lecture")[0].textContent), "valeur manquante lue « — », jamais 0");
ok(svg.parClasse("nxc-interactif").length === 1, "un seul curseur de lecture à la fois");
fc.composant.basculer("B"); ok(svg.parTag("path").length === 1 && fc.parClasse("nxc-serie")[1].getAttribute("aria-pressed") === "false", "légende : série B masquée (aria-pressed=false)");
fc.composant.basculer("B");
fc.composant.zoomer(1, 2); ok(fc.composant.etat().debut === 1 && /^M58 /.test(svg.parTag("path")[0].getAttribute("d")) && !svg.parTag("text").some((t) => t.textContent === "2020"), "zoom 2021-2022 : l'axe recommence à 2021");
fc.composant.filtrer((l) => l[1] === "A"); ok(svg.parTag("path").length === 1 && eqv.un("table").parTag("tr").length === 4, "filtre : la courbe et son tableau suivent");
fc.composant.filtrer(() => false); ok(svg.parTag("path").length === 0 && /Aucune donnée/.test(svg.textContent), "0 ligne : « Aucune donnée à afficher »");
const un = courbe(verifierJeu(jeu({ lignes: [["2020", "A", 7]] })), { x: "annee", y: "valeur" });
ok(un.composant.svg.parTag("path").length === 1 && un.composant.svg.parTag("circle").length === 1 && !/NaN/.test(un.composant.svg.parTag("path")[0].getAttribute("d")), "1 point : dessiné au centre, sans NaN");
const gros = verifierJeu({ titre: "Gros", colonnes: [{ id: "x", libelle: "X", type: "nombre" }, { id: "y", libelle: "Y", type: "nombre" }], lignes: Array.from({ length: 5001 }, (_, i) => [i, Math.sin(i / 50)]), unite: "u", source: SRC });
const fg = courbe(gros, { x: "x", y: "y" }); ok(/5001 points ramenés/.test(fg.parClasse("nxc-note")[0].textContent) && !fg.parClasse("nxc-note")[0].hidden, "5 001 points : agrégation annoncée en clair");
ok(!/NaN|undefined|Infinity/.test(versSVG(fc.composant.svg, jv)), "aucun NaN, undefined ni Infinity dans le SVG");

// ---------- 4. Barres
const jb = verifierJeu(D.jeuBarres()), fb = barres(jb, { categorie: "jour", valeur: "ecart" });
const rects = fb.composant.svg.parTag("rect");
ok(rects.length === 6, "barres : 6 rectangles (la valeur manquante n'a pas de barre)");
ok(fb.composant.svg.parTag("text").some((t) => t.textContent === "n.d."), "valeur manquante marquée « n.d. »");
const zeroY = (() => { const s = fb.composant.svg, r = s.parTag("rect"); const sam = r[4]; return +sam.getAttribute("y"); })();
const ven = rects[3]; ok(+ven.getAttribute("y") + +ven.getAttribute("height") === zeroY || Math.abs(+ven.getAttribute("y") + +ven.getAttribute("height") - zeroY) < 0.2, "barre négative : part de la ligne zéro vers le bas");
const hMax = Math.max(...rects.map((r) => +r.getAttribute("height"))); ok(+ven.getAttribute("height") === hMax, "la plus grande valeur (7,5) a la barre la plus haute");
fb.composant.trier("decroissant"); ok(/^Vendredi/.test(fb.composant.etat().ordre[0]) && /Jeudi : donnée manquante/.test(fb.composant.etat().ordre.at(-1)), "tri décroissant ; la donnée manquante en dernier");
ok(fb.composant.lire(0) === "Vendredi : 7,5 °C", "lecture d'une barre : « Vendredi : 7,5 °C »");
const fh = barres(jb, { categorie: "jour", valeur: "ecart", orientation: "horizontale" }); ok(fh.composant.svg.getAttribute("data-orientation") === "horizontale" && fh.composant.svg.parTag("rect").every((r) => +r.getAttribute("height") > 0), "barres horizontales");
ok(/en double/.test(rendre("barres", jeu(), { categorie: "geo", valeur: "valeur" }).textContent), "catégories en double : refusé (rien n'est additionné en silence)");

// ---------- 5. Échappement des textes venus de l'extérieur
const piege = '<img src=x onerror="alert(1)">';
const jp = verifierJeu({ titre: piege, colonnes: [{ id: "nom", libelle: '"><script>x</script>', type: "texte" }, { id: "v", libelle: "V", type: "nombre" }], lignes: [[piege, 1], ["=SOMME(A1)", 2], ["a;b\"c", 3]], unite: "<u>", source: { nom: piege, maj: "2026-10-01", periode: "<p>", url: "https://exemple.fr/?q=<x>" } });
const fp = barres(jp, { categorie: "nom", valeur: "v" });
ok(fp.parTag("img").length === 0 && fp.parTag("script").length === 0, "texte piégé : aucune balise img ni script créée");
ok(fp.parClasse("nxc-titre")[0].textContent === piege, "le titre piégé s'affiche tel quel, comme du texte");
ok(fp.composant.svg.parTag("title").some((t) => t.textContent.startsWith(piege)), "dans le SVG aussi : du texte");
const sp = versSVG(fp.composant.svg, jp, piege);
ok(!sp.includes("<img") && !sp.includes("<script") && sp.includes("&lt;img src=x onerror="), "export SVG : textes échappés (&lt;img…)");
ok(!/ on[a-z]+=/i.test(sp.replace(/&lt;[^]*?&gt;/g, "")), "export SVG : aucun attribut d'événement");
ok(fp.parTag("a")[0] && fp.parTag("a")[0].getAttribute("rel") === "noopener noreferrer" && fp.parTag("a")[0].getAttribute("target") === "_blank", "lien de la source : noopener noreferrer, ouvert par un clic");
ok(innerHTMLTente === 0, "aucune écriture innerHTML pendant tous les rendus");

// ---------- 6. Export CSV exact
const csv = versCSV(jv);
const attendu = "﻿Année;Lieu;Valeur (habitants)\r\n2020;A;10\r\n2021;A;20\r\n2022;A;15\r\n2020;B;5\r\n2021;B;\r\n2022;B;30\r\n";
ok(csv === attendu, "CSV exact : BOM, « ; », CRLF, unité dans l'en-tête, valeur manquante vide");
const cp = versCSV(jp);
ok(cp.split("\r\n")[2] === "'=SOMME(A1);2", "CSV : formule neutralisée (préfixe ')");
ok(cp.split("\r\n")[3] === '"a;b""c";3', "CSV : séparateur et guillemets échappés");
ok(cp.split("\r\n")[0] === '\uFEFF"""><script>x</script>";V (<u>)', "CSV : en-tête piégé entre guillemets (texte brut, pas de HTML)");
ok(versCSV(verifierJeu(jeu({ lignes: [["2020", "A", 0.1 + 0.2], ["2021", "A", -1500.5]] }))).includes("2020;A;0.30000000000000004\r\n2021;A;-1500.5"), "CSV : nombres en pleine précision, point décimal (aucun arrondi caché)");
ok(versCSV(jv, jv.lignes.filter((l) => l[1] === "B")).split("\r\n").length === 5, "CSV d'une sélection filtrée : seulement les lignes visibles");
const ft = tableau(jv); ft.composant.filtrer((l) => l[1] === "A"); ok(ft.composant.lignes().length === 3, "tableau : filtre appliqué aux lignes exportées");
ok(sp.includes("Source : ") && sp.includes("Unité : ") && sp.includes("Période : ") && sp.includes("Mise à jour : "), "export SVG : pied de sources inclus");
ok(!versSVG(fc.composant.svg, jv).includes("nxc-interactif"), "export SVG : le curseur de lecture n'est pas exporté");
ok(piedSourcesTexte(verifierJeu({ ...D.jeuCourbe() }))[0] === "EXEMPLE · données factices" && piedSourcesTexte(verifierJeu({ ...D.jeuCourbe() })).includes("Non vérifié"), "données d'exemple : « EXEMPLE » et « Non vérifié » dans le pied");

// ---------- 7. Export seulement par un clic réel de Lucien
const recus = []; sortie.telecharger = (nom, contenu, type) => recus.push({ nom, contenu, type });
const ex = exporter({ jeu: jv, svg: () => fc.composant.svg }), [bCSV, bSVG] = ex.parTag("button");
bCSV.click(); bSVG.click();
ok(recus.length === 0 && /refusé/.test(ex.textContent), "clic simulé par le code (isTrusted faux) : export refusé");
bCSV.dispatch("click", { isTrusted: true }); bSVG.dispatch("click", { isTrusted: true });
ok(recus.length === 2 && recus[0].nom === "essai-2026-10-01.csv" && recus[0].contenu === attendu && /^text\/csv/.test(recus[0].type), "vrai clic : CSV téléchargé, identique au jeu");
ok(recus[1].nom.endsWith(".svg") && recus[1].contenu.startsWith("<?xml") && /image\/svg/.test(recus[1].type), "vrai clic : SVG téléchargé");

// ---------- 8. Chiffre clé, filtres
const fk = chiffreCle(verifierJeu(D.jeuChiffre()), { valeur: "indice", x: "mois" });
ok(fk.parClasse("nxc-valeur")[0].textContent.replace(/\s/g, " ").startsWith("102,1") && /hausse de 0,7 %/.test(fk.parClasse("nxc-variation")[0].getAttribute("aria-label")), "chiffre clé : 102,1 et « hausse de 0,7 % » (101,4 → 102,1)");
ok(/sept\. 2026/.test(fk.textContent) && /août 2026/.test(fk.textContent), "chiffre clé : période et point de comparaison affichés");
ok(/Aucune valeur/.test(chiffreCle(verifierJeu(jeu({ lignes: [] })), { valeur: "valeur" }).textContent), "chiffre clé sans valeur : « Aucune valeur disponible »");
let pred = null; const ff = filtres(jv, { champs: ["geo", "annee"], surChangement: (p) => { pred = p; } });
const cases = ff.parTag("input"); cases[1].checked = false; cases[1].dispatch("change");
ok(pred && jv.lignes.filter(pred).length === 3 && jv.lignes.filter(pred).every((l) => l[1] === "A"), "filtre catégories : décocher B garde les 3 lignes de A");
const [de, a] = ff.parTag("select"); de.value = "1"; de.dispatch("change");
ok(jv.lignes.filter(pred).length === 2, "filtre période : à partir de 2021 → 2 lignes");
a.value = "0"; a.dispatch("change"); ok(a.value === "1" && jv.lignes.filter(pred).length === 1, "bornes croisées : la fin est ramenée au début (2021 seulement)");
ok(ff.parTag("fieldset").length === 2 && ff.parTag("legend").length === 2 && ff.parTag("select").every((x) => x.getAttribute("aria-label")), "filtres : groupes légendés, champs nommés (clavier)");

// ---------- 9. Contraste et démonstration
ok(contraste(TEXTE, FOND) >= 4.5 && contraste(DISCRET, FOND) >= 4.5, `textes : contraste ${contraste(TEXTE, FOND).toFixed(1)}:1 et ${contraste(DISCRET, FOND).toFixed(1)}:1 sur le fond (≥ 4,5)`);
const mini = Math.min(...PALETTE.map((p) => contraste(p.couleur, FOND))); ok(mini >= 4.5, `couleurs des séries : contraste minimal ${mini.toFixed(1)}:1 (≥ 4,5)`);
ok(contraste("#ff8095", "#02060d") >= 4.5, "texte d'un refus lisible (≥ 4,5)");
for (const [n, f] of [["courbe", D.jeuCourbe], ["barres", D.jeuBarres], ["chiffre", D.jeuChiffre]]) { const j = verifierJeu(f()); ok(j.exemple === true && j.source.verifie === false, `jeu de démonstration « ${n} » marqué exemple et non vérifié`); }
const page = document.createElement("div"); D.rendreComposants(page);
ok(page.parClasse("nxc").length >= 5 && page.parClasse("nxc-refus").length === 1 && /EXEMPLE/.test(page.textContent), "onglet Composants du labo : tous les composants, le refus et l'avertissement « EXEMPLE »");
ok(innerHTMLTente === 0, "toujours aucune écriture innerHTML (démonstration comprise)");

// ---------- 10. Pas d'outil pour le Noyau dans ce lot
const src = (await import("node:fs")).readFileSync(new URL("../js/noyau/outils.js", import.meta.url), "utf8");
ok(!/afficher_module|transformer_donnees|composants\.js/.test(src), "aucun nouvel outil du Noyau (afficher_module attend la validation de Lucien)");
const code = (await import("node:fs")).readFileSync(new URL("../js/noyau/modules/composants.js", import.meta.url), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\/\*\*|\*)/.test(l)).join("\n");
ok(!/innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function|WebGL|getContext\(|fetch\(|import\(/.test(code), "composants.js : ni innerHTML, ni eval, ni WebGL, ni réseau");

console.log(ko ? ko + " échec(s)" : "Tout est bon."); process.exit(ko ? 1 : 0);
