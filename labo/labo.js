// Laboratoire · page de contrôle : bac à sable (hub fictif + Noyau + fenêtre), choix du moteur, banc d'essai, inspecteur.
// La clé Gemini éventuelle reste en mémoire de la page : jamais écrite, jamais dans le dépôt.
import { creerHubSimule } from "./hub-simule.js";
import { brancher } from "../js/noyau/hote.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { monterFenetre } from "../js/noyau/fenetre.js";
import { moteurGemini } from "../js/noyau/moteurs.js";
import { moteurDemo } from "./moteur-demo.js";
import { lancerBanc } from "./banc.js";

const $ = (s) => document.querySelector(s);
const h = (tag, a = {}, ...k) => { const e = document.createElement(tag); for (const [n, v] of Object.entries(a)) { if (v == null || v === false) continue; if (n === "class") e.className = v; else if (n.startsWith("on")) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

let hub = null, noyau = null, fenetre = null, cle = "", modeMoteur = "demo";

async function demarrer() {
  hub = creerHubSimule({ cle: cle || null });
  noyau = await creerNoyau();
  noyau.verrouillePar(() => false);
  fenetre = monterFenetre($("#noyau-mount"), noyau);
  appliquerMoteur();
  noyau.surMessage((m) => { if (m.type === "reponse" || m.type === "erreur") rendreInspecteur(); });
  window.__noyau = noyau; window.__hub = hub;
  rendreInspecteur(); rendreHub(); rendreMoteur();
}
function appliquerMoteur() {
  if (modeMoteur === "demo") noyau.definirMoteur(moteurDemo());
  else { noyau.definirMoteur(null); hub.definirCle(cle || null); hub.hote.reglage.ecrire("noyau-moteur", "gemini"); }
  fenetre && fenetre.rafraichir();
}

// ----- Onglets -----
document.querySelectorAll(".onglets button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".onglets button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  document.querySelectorAll(".panneau").forEach((p) => p.classList.toggle("on", p.id === "p-" + b.dataset.p));
}));

// ----- Moteur -----
function rendreMoteur() {
  const p = $("#p-moteur"); p.textContent = "";
  const sel = h("select", { class: "lab-champ", "aria-label": "Moteur" }, h("option", { value: "demo" }, "Démonstration (sans modèle, sans clé)"), h("option", { value: "gemini" }, "Gemini réel (clé du laboratoire)"));
  sel.value = modeMoteur; sel.addEventListener("change", () => { modeMoteur = sel.value; appliquerMoteur(); rendreMoteur(); });
  const champ = h("input", { class: "lab-champ", type: "password", placeholder: "Clé Gemini du laboratoire (reste en mémoire de cette page)", autocomplete: "off", "aria-label": "Clé Gemini du laboratoire" });
  champ.value = cle; champ.addEventListener("change", () => { cle = champ.value.trim(); if (modeMoteur === "gemini") appliquerMoteur(); rendreMoteur(); });
  p.append(
    h("p", { class: "dim" }, "Le moteur de démonstration n'est pas une intelligence : un aiguillage à mots-clés qui appelle les vrais outils. Il sert à voir la barrière, la confirmation, la mémoire et le journal fonctionner. Essaie : « quelles sont mes tâches ? », « ajoute une tâche acheter du pain », « retiens que j'aime le thé », « supprime toutes mes notes » (refusé d'office)."),
    h("div", { class: "lab-ligne" }, sel),
    h("div", { hidden: modeMoteur !== "gemini" }, champ, h("p", { class: "avert" }, cle ? "Clé présente en mémoire. Le plafond de requêtes du Noyau (40 par jour) s'applique ici aussi. Conseil : utilise une clé distincte de celle de l'orbe, pour ne pas manger son quota." : "Colle une clé pour utiliser Gemini. Sans clé, le Noyau répond en mode réduit (mémoire seule).")),
    h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: async () => { $("#noyau-mount").textContent = ""; await demarrer(); } }, "Repartir à zéro"), h("span", { class: "dim" }, "Mémoire, journal, conversation et budget sont remis à neuf.")));
}

// ----- Banc d'essai -----
let scenarios = null;
function rendreBanc() {
  const p = $("#p-banc"); p.textContent = "";
  const liste = h("div"), bilan = h("div", { class: "bilan", hidden: true });
  const lancer = async (reel) => {
    if (!scenarios) scenarios = (await (await fetch("labo/scenarios.json")).json()).scenarios;
    liste.textContent = ""; bilan.hidden = true;
    const opt = { lireFichier: async (f) => (await fetch("labo/" + f.replace(/^\.?\/?labo\//, ""))).text() };
    if (reel && cle) opt.moteurReel = moteurGemini({ cle });
    b1.disabled = b2.disabled = true;
    const out = await lancerBanc(scenarios, opt, (r) => {
      const cls = r.ok === true ? "ok" : r.ok === false ? "ko" : "sk";
      liste.append(h("div", { class: "res " + cls }, h("span", { class: "p" }, r.ok === true ? "✓" : r.ok === false ? "✗" : "–"), h("span", { class: "id" }, r.id), h("span", {}, r.titre, r.saute ? h("small", { class: "dim" }, "  (moteur réel requis)") : null)));
      if (r.ecarts && r.ecarts.length) liste.append(h("div", { class: "ecarts" }, r.ecarts.map((e) => h("div", {}, e))));
    });
    bilan.hidden = false; bilan.textContent = `${out.ok} réussi(s), ${out.ko} raté(s), ${out.sautes} sauté(s) sur ${out.total}.`;
    b1.disabled = b2.disabled = false;
    await demarrer();                       // le banc a branché ses propres hubs : on remet le bac à sable
  };
  const b1 = h("button", { class: "lab-btn", type: "button", onclick: () => lancer(false) }, "Lancer le banc mécanique");
  const b2 = h("button", { class: "lab-btn", type: "button", onclick: () => { if (!cle) { bilan.hidden = false; bilan.textContent = "Colle d'abord une clé Gemini dans l'onglet Moteur."; return; } lancer(true); } }, "Lancer aussi les essais réels");
  p.append(
    h("p", { class: "dim" }, "Le banc rejoue des scénarios sur des hubs fictifs tout neufs. Les scénarios mécaniques vérifient ce que le hub fait (barrière, confirmation, journal, mémoire, vérification des sources) avec un modèle simulé : aucune requête. Les essais réels envoient les questions à Gemini et consomment du quota."),
    h("p", { class: "avert" }, "Le bac à sable est remis à zéro après le banc."),
    h("div", { class: "lab-ligne" }, b1, b2), bilan, liste);
}

// ----- Inspecteur -----
function rendreInspecteur() {
  const p = $("#p-inspect"); p.textContent = "";
  const tours = noyau.inspecteur();
  if (!tours.length) { p.append(h("p", { class: "dim" }, "Pose une question au Noyau : chaque tour est détaillé ici (ce qu'il s'est rappelé, ce que le modèle a reçu, les outils appelés, la réponse brute et sa vérification).")); return; }
  tours.slice(0, 8).forEach((t, i) => {
    const pre = (x) => h("pre", { class: "i" }, typeof x === "string" ? x : JSON.stringify(x, null, 1));
    p.append(h("details", { open: i === 0 },
      h("summary", {}, `« ${t.question.slice(0, 70)} » — ${t.requetes} requête(s)${t.reflexe ? " · réflexe " + t.reflexe : ""}`),
      h("div", { class: "dim" }, `origine ${t.origine} · ${t.ms != null ? t.ms + " ms" : ""} · ${t.tokens || 0} jetons`),
      h("b", {}, "Souvenirs rappelés"), pre(t.extraits.length ? t.extraits.map((e) => `[${e.n}] (${e.type}) ${e.titre || ""} ${e.texte}`).join("\n") : "(aucun)"),
      h("b", {}, "État du monde injecté"), pre(t.etatMonde && t.etatMonde.length ? t.etatMonde.join("\n") : "(rien de pertinent)"),
      h("b", {}, "Appels au modèle et outils"), pre({ appels: t.appels, outils: t.outils }),
      t.final ? [h("b", {}, "Réponse structurée et vérification"), pre(t.final)] : null,
      t.systeme ? h("details", {}, h("summary", {}, "Instruction système envoyée"), pre(t.systeme)) : null));
  });
}

// ----- Hub fictif -----
async function rendreHub() {
  const p = $("#p-hub"); p.textContent = "";
  const j = await noyau.journal({ limite: 20 });
  const vue = async (c) => (await hub.hote.stockage.tout(c));
  const [t, n, e, f] = await Promise.all([vue("tasks"), vue("notes"), vue("events"), vue("favs")]);
  p.append(
    h("p", { class: "dim" }, "Ce que le Noyau peut lire et modifier (après confirmation). Les données sont fictives et vivent dans la page."),
    h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: rendreHub }, "Actualiser")),
    h("b", {}, `Tâches (${t.length})`), h("pre", { class: "i" }, t.map((x) => `${x.done ? "[x]" : "[ ]"} ${x.text}${x.due ? " · " + x.due : ""}`).join("\n") || "(aucune)"),
    h("b", {}, `Agenda (${e.length})`), h("pre", { class: "i" }, e.map((x) => `${x.date} ${x.start || ""} ${x.title}`).join("\n") || "(rien)"),
    h("b", {}, `Notes (${n.length})`), h("pre", { class: "i" }, n.map((x) => "• " + x.text).join("\n") || "(aucune)"),
    h("b", {}, `Favoris (${f.length})`), h("pre", { class: "i" }, f.map((x) => `${x.title} · ${x.url}`).join("\n") || "(aucun)"),
    h("b", {}, "Dernières lignes du journal des actions"), h("pre", { class: "i" }, j.map((x) => `${x.statut.padEnd(20)} ${x.outil} ${x.params || ""}`).join("\n") || "(vide)"));
}
document.querySelector('[data-p="hub"]').addEventListener("click", rendreHub);
document.querySelector('[data-p="inspect"]').addEventListener("click", () => noyau && rendreInspecteur());

rendreBanc();
await demarrer();
