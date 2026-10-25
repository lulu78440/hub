// Noyau · la fenêtre (contrat, section 3). Interface conçue pour l'habillage Hologramme du hub (aucun visuel repris de l'application v3.8).
// Montée dans le conteneur fourni : le corps de la fenêtre « Noyau » du plan 1 (hub) ou une zone de labo.html (laboratoire).
// Contient : l'échange, l'état (pouls, phase, budget), la fenêtre de confirmation (qui appartient au hub : le modèle ne peut ni la cocher
// ni la contourner), la boîte « À valider », le journal, la mémoire, les réglages et les imports.
import { hote } from "./hote.js";
import { SOURCES, DOMAINES } from "./sources.js";
import { lire as lireVoix, arreter as arreterVoix, dicter, lectureDispo, dicteeDispo } from "./voix.js";

const PHASES = { reflechit: "Je réfléchis", se_souvient: "Je me souviens", cherche: "Je cherche", attend: "J'attends ton accord", parle: "Je réponds", dort: "Je consolide ma mémoire", repos: "Au repos", horsligne: "Hors ligne" };
const CONFIANCE = { haute: ["sûr", "ok"], moyenne: ["à vérifier", "mid"], basse: ["incertain", "low"] };
const TYPES_AV = { sem: "Fait sur toi", pro: "Règle de méthode", kb: "Connaissance", actualite: "Actualité", modif: "Modification d'un fait", contradiction: "Contradiction", lecon: "Leçon" };
const STATUT_CLASSE = { "EXÉCUTÉ": "ok", "CONFIRMÉ_PAR_LUCIEN": "ok", "REFUSÉ_PAR_LUCIEN": "no", "EXPIRÉ": "no", "BLOQUÉ_INTERDIT": "bad", "BUDGET_ATTEINT": "mid", "ERREUR": "bad" };

function h(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "texte") e.textContent = v; else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of enfants.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const heure = (iso) => { try { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const secondes = (ms) => (ms / 1000).toFixed(1).replace(".", ",") + " s";

export function monterFenetre(conteneur, noyau, { titre = true } = {}) {
  if (!conteneur) throw new Error("Aucun conteneur pour la fenêtre du Noyau.");
  conteneur.textContent = "";
  const racine = h("div", { class: "nx", "data-phase": "repos", "data-vue": "chat" });
  conteneur.append(racine);
  let tourActif = null, enLecture = null, dictee = null;
  const attente = new Map();       // tour -> élément « je réfléchis »

  // ---------- État : pouls, phase, budget ----------
  const pouls = h("div", { class: "nx-pouls", "aria-hidden": "true" }, Array.from({ length: 28 }, (_, i) => h("i", { style: `--i:${i}` })));
  const phaseTxt = h("span", { class: "nx-phase", role: "status" }, PHASES.repos);
  const budgetEl = h("span", { class: "nx-budget", role: "img" });
  const horsLigne = h("span", { class: "nx-horsligne", role: "status", hidden: true, title: "Sans connexion, je réponds seulement avec ma mémoire." }, "Hors ligne · mémoire seule");
  const etat = h("div", { class: "nx-etat" }, pouls, phaseTxt, horsLigne, budgetEl);
  const majLigne = () => { const hors = !hote.enLigne(); horsLigne.hidden = !hors; racine.dataset.ligne = hors ? "hors" : "oui"; };
  addEventListener("online", majLigne); addEventListener("offline", majLigne); majLigne();
  function majBudget() {
    const s = noyau.statut(), b = s.budget, n = 10, pleins = Math.round(Math.min(b.utilisees / b.plafond, 1) * n);
    budgetEl.textContent = ""; for (let i = 0; i < n; i++) budgetEl.append(h("u", { class: i < pleins ? "f" : "" }));
    budgetEl.append(h("b", { texte: `${b.restant}` }));
    budgetEl.setAttribute("aria-label", `${b.restant} requêtes restantes aujourd'hui sur ${b.plafond}`); budgetEl.title = `${b.restant} requêtes restantes aujourd'hui sur ${b.plafond} · ${s.moteur}`;
  }

  // ---------- Échange ----------
  const fil = h("div", { class: "nx-fil", role: "log", "aria-live": "polite", "aria-label": "Échange avec le Noyau", tabindex: "0" });
  const saisie = h("textarea", { class: "nx-saisie", rows: "1", placeholder: "Parle au Noyau…", "aria-label": "Ton message", maxlength: "2000", autocomplete: "off" });
  const envoyer = h("button", { class: "nx-btn nx-primaire", type: "submit" }, "Envoyer");
  const micro = h("button", { class: "nx-btn nx-icone", type: "button", "aria-label": "Dicter", title: "Dicter (Brave bloque la dictée)", hidden: !dicteeDispo() }, "◉");
  const form = h("form", { class: "nx-form" }, saisie, micro, envoyer);
  const rapide = h("div", { class: "nx-rapide", role: "group", "aria-label": "Raccourcis" },
    [["Briefing", "Briefing", true], ["Revue du soir", "Revue de fin de journée", true], ["Note…", "Note : ", false], ["Rappel…", "Rappelle-moi ", false], ["Chercher partout…", "Cherche partout ", false]]
      .map(([nom, texte, direct]) => h("button", { class: "nx-puce nx-raccourci", type: "button", onclick: () => { if (direct) poser(texte); else { saisie.value = texte; ajuster(); saisie.focus(); saisie.setSelectionRange(texte.length, texte.length); } } }, nom)));
  const chat = h("section", { class: "nx-vue nx-chat", "data-nom": "chat" }, fil, rapide, form);
  document.addEventListener("noyau:saisir", (e) => { const d = e.detail || {}; saisie.value = d.texte || ""; ajuster(); if (d.envoyer && d.texte) poser(d.texte); else saisie.focus(); });

  function accueilVide() {
    if (fil.children.length) return;
    fil.append(h("p", { class: "nx-vide" }, "Je suis le Noyau. Pose-moi une question, demande-moi de lire ou de préparer quelque chose dans le hub : pour toute création, c'est toi qui confirmes."));
  }
  function ajouterUtilisateur(texte) {
    fil.querySelector(".nx-vide")?.remove();
    fil.append(h("article", { class: "nx-m nx-lui" }, h("p", { texte })));
    fil.scrollTop = fil.scrollHeight;
  }
  function rendreTexte(texte, tour) {
    const trace = noyau.inspecteur().find((t) => t.tour === tour);
    const p = h("div", { class: "nx-texte" });
    String(texte).split(/\n{2,}/).forEach((para) => {
      const ligne = h("p");
      para.split(/(\[\d+\])/).forEach((morceau) => {
        const m = /^\[(\d+)\]$/.exec(morceau);
        if (m && trace && trace.extraits[+m[1] - 1]) {
          const ex = trace.extraits[+m[1] - 1];
          ligne.append(h("button", { class: "nx-ref", type: "button", "aria-label": `Source ${m[1]} : ${ex.titre || ex.type}`, title: ex.titre || ex.type, onclick: () => montrerSource(ligne.closest(".nx-m"), ex) }, m[1]));
        } else ligne.append(morceau);
      });
      p.append(ligne);
    });
    return p;
  }
  function montrerSource(carte, ex) {
    carte.querySelector(".nx-source")?.remove();
    carte.append(h("div", { class: "nx-source" }, h("b", { texte: (ex.titre || ex.type) + " " }), h("span", { class: "nx-dim", texte: `(${ex.type})` }), h("p", { texte: ex.texte })));
  }
  function carteNoyau(m) {
    const [mot, cl] = CONFIANCE[m.confiance] || CONFIANCE.moyenne;
    const meta = h("div", { class: "nx-meta" },
      h("span", { class: "nx-conf " + cl, title: "Confiance du Noyau dans cette réponse" }, h("i"), mot),
      m.sur ? h("span", { class: "nx-etiq", title: "Appuyé sur une source (mémoire, outil ou flux)" }, "sourcé") : null,
      m.reduit ? h("span", { class: "nx-etiq warn", title: "Réponse sans modèle : seulement ce que la mémoire contient" }, "mode réduit") : null,
      m.local ? h("span", { class: "nx-etiq", title: "Calculé dans le hub, sans requête" }, "local") : null,
      m.refus ? h("span", { class: "nx-etiq bad" }, "refusé") : null,
      m.refaite ? h("span", { class: "nx-etiq" }, "refaite") : null,
      m.requetes != null ? h("span", { class: "nx-dim", texte: `${m.requetes} req${m.ms ? " · " + secondes(m.ms) : ""}${m.moteurs && m.moteurs.length ? " · " + m.moteurs.join(" + ") : ""}` }) : null);
    const actions = h("div", { class: "nx-actions" },
      h("button", { class: "nx-lien", type: "button", onclick: () => donnerAvis(carte, m, true) }, "Valider"),
      h("button", { class: "nx-lien", type: "button", onclick: () => demanderRemarque(carte, m) }, "Non validée"),
      lectureDispo() ? h("button", { class: "nx-lien", type: "button", onclick: (e) => basculerLecture(e.currentTarget, m) }, "Écouter") : null);
    const carte = h("article", { class: "nx-m nx-noyau", "data-ton": m.ton || "calme", "data-tour": m.tour }, rendreTexte(m.texte, m.tour), meta, m.refus || m.reduit ? null : actions);
    return carte;
  }
  function donnerAvis(carte, m, valide, commentaire = "") {
    carte.querySelector(".nx-actions")?.replaceChildren(h("span", { class: "nx-dim", texte: valide ? "Réponse validée." : "Je refais ma réponse…" }));
    noyau.avis({ tour: m.tour, valide, commentaire }).then((r) => { if (r && !valide) majReponse(r); });
  }
  function demanderRemarque(carte, m) {
    const zone = carte.querySelector(".nx-actions"); if (!zone || zone.querySelector("input")) return;
    const champ = h("input", { class: "nx-champ", type: "text", placeholder: "Qu'est-ce qui n'allait pas ? (facultatif)", maxlength: "240", "aria-label": "Remarque sur la réponse" });
    const ok = () => donnerAvis(carte, m, false, champ.value);
    champ.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } });
    zone.append(champ, h("button", { class: "nx-lien", type: "button", onclick: ok }, "Refaire")); champ.focus();
  }
  function majReponse(m) {
    const old = fil.querySelector(`[data-tour="${CSS.escape(m.tour)}"]`);
    const n = carteNoyau(m);
    if (old) old.replaceWith(n); else fil.append(n);
    fil.scrollTop = fil.scrollHeight;
  }
  function basculerLecture(bouton, m) {
    if (enLecture === bouton) { arreterVoix(); bouton.textContent = "Écouter"; enLecture = null; return; }
    if (enLecture) enLecture.textContent = "Écouter";
    enLecture = bouton; bouton.textContent = "Arrêter";
    lireVoix(m.texte, { ton: m.ton, fin: () => { if (enLecture === bouton) { bouton.textContent = "Écouter"; enLecture = null; } } });
  }

  async function poser(texte) {
    texte = texte.trim(); if (!texte) return;
    ajouterUtilisateur(texte); saisie.value = ""; ajuster();
    const attend = h("article", { class: "nx-m nx-noyau nx-pense", "aria-hidden": "true" }, h("span", { class: "nx-points" }, h("i"), h("i"), h("i")));
    fil.append(attend); fil.scrollTop = fil.scrollHeight;
    envoyer.disabled = true;
    try { await noyau.poser(texte); } finally { attend.remove(); envoyer.disabled = false; majBudget(); saisie.focus(); }
  }
  const ajuster = () => { saisie.style.height = "auto"; saisie.style.height = Math.min(saisie.scrollHeight, 110) + "px"; };
  form.addEventListener("submit", (e) => { e.preventDefault(); poser(saisie.value); });
  saisie.addEventListener("input", ajuster);
  saisie.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); poser(saisie.value); } });
  micro.addEventListener("click", () => {
    if (dictee) { dictee.arreter(); dictee = null; micro.classList.remove("on"); return; }
    micro.classList.add("on");
    dictee = dicter({ surTexte: (t) => { saisie.value = t; ajuster(); }, surFin: () => { micro.classList.remove("on"); dictee = null; saisie.focus(); }, surErreur: (msg) => { micro.classList.remove("on"); dictee = null; note(msg); } });
  });

  function note(texte) { fil.querySelector(".nx-vide")?.remove(); fil.append(h("p", { class: "nx-note", texte })); fil.scrollTop = fil.scrollHeight; }

  // ---------- Fenêtre de confirmation (appartient au hub) ----------
  function confirmer(d) {
    return new Promise((fini) => {
      const precedent = document.activeElement;
      const sortie = d.donnees_sortantes && d.donnees_sortantes.length ? h("ul", { class: "nx-sortie" }, d.donnees_sortantes.map((s) => h("li", { texte: s }))) : h("p", { class: "nx-rien", texte: "Rien ne quitte ton appareil." });
      const dur = Math.max(d.delai || 60000, 1000);
      const NS = "http://www.w3.org/2000/svg", anneau = document.createElementNS(NS, "svg");
      anneau.setAttribute("class", "nx-anneau"); anneau.setAttribute("viewBox", "0 0 36 36"); anneau.setAttribute("aria-hidden", "true");
      for (const c of ["fond", "reste"]) { const r = document.createElementNS(NS, "circle"); r.setAttribute("cx", "18"); r.setAttribute("cy", "18"); r.setAttribute("r", "16"); r.setAttribute("class", c); anneau.append(r); }
      anneau.querySelector(".reste").style.animationDuration = dur + "ms";
      const refuser = h("button", { class: "nx-btn", type: "button" }, "Refuser");
      const accepter = h("button", { class: "nx-btn nx-primaire", type: "button" }, "Confirmer");
      const boite = h("div", { class: "nx-dialogue", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "nx-d-t", "aria-describedby": "nx-d-r" },
        h("div", { class: "nx-d-tete" }, anneau, h("h3", { id: "nx-d-t", texte: "Le Noyau demande ton accord" })),
        h("p", { id: "nx-d-r", class: "nx-d-resume", texte: d.resume }),
        h("div", { class: "nx-d-bloc" }, h("b", { texte: "Ce qui sort de l'appareil" }), sortie),
        h("p", { class: "nx-d-aide", texte: "Entrée ne confirme pas. Sans réponse, l'action est refusée." }),
        h("div", { class: "nx-d-boutons" }, refuser, accepter));
      const voile = h("div", { class: "nx-voile" }, boite);
      let clos = false;
      const clore = (v) => { if (clos) return; clos = true; clearTimeout(minuteur); voile.remove(); document.removeEventListener("keydown", clavier, true); racine.dataset.attente = ""; try { precedent && precedent.focus(); } catch (e) { /* ignoré */ } fini(v); };
      const minuteur = setTimeout(() => clore(false), dur + 300);      // la barrière a déjà expiré à dur ; ceci ne fait que fermer la fenêtre
      function clavier(e) {
        if (!voile.isConnected) return;
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); return; }          // Entrée ne confirme jamais
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); clore(false); return; }
        if (e.key === "Tab") { const f = [refuser, accepter]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + 2) % 2].focus(); }
        e.stopPropagation();
      }
      document.addEventListener("keydown", clavier, true);
      refuser.addEventListener("click", () => clore(false)); accepter.addEventListener("click", () => clore(true));
      document.body.append(voile); racine.dataset.attente = "1"; refuser.focus();
    });
  }
  noyau.confirmerAvec(confirmer);

  // ---------- À valider ----------
  const vueValider = h("section", { class: "nx-vue", "data-nom": "valider" });
  async function rendreValider() {
    vueValider.textContent = ""; const l = noyau.aValider();
    vueValider.append(h("p", { class: "nx-intro", texte: l.length ? "Rien n'entre dans ma mémoire sans ton accord. Garde, modifie ou écarte." : "Rien à valider pour l'instant." }));
    for (const p of l) {
      const zone = h("textarea", { class: "nx-champ", rows: "2", hidden: true, "aria-label": "Texte modifié" }); zone.value = p.texte;
      const act = (a) => async () => { try { await noyau.trier(p.id, a, a === "modifier" ? zone.value : ""); } catch (e) { note(e.message); } rendreValider(); majNav(); };
      vueValider.append(h("article", { class: "nx-av", "data-type": p.type },
        h("div", { class: "nx-av-t" }, h("b", { texte: TYPES_AV[p.type] || p.type }), h("span", { class: "nx-dim", texte: p.origine || "" })),
        p.avant ? h("p", { class: "nx-avant" }, h("span", { class: "nx-dim", texte: "Avant : " }), p.avant) : null,
        h("p", { class: "nx-apres" }, p.avant ? h("span", { class: "nx-dim", texte: "Après : " }) : null, p.texte), zone,
        h("div", { class: "nx-actions" },
          h("button", { class: "nx-lien", type: "button", onclick: act("garder") }, "Garder"),
          h("button", { class: "nx-lien", type: "button", onclick: () => { if (zone.hidden) { zone.hidden = false; zone.focus(); } else act("modifier")(); } }, "Modifier"),
          h("button", { class: "nx-lien", type: "button", onclick: act("ecarter") }, "Écarter"))));
    }
  }

  // ---------- Journal ----------
  const vueJournal = h("section", { class: "nx-vue", "data-nom": "journal" });
  async function rendreJournal(statut = "") {
    vueJournal.textContent = "";
    const sel = h("select", { class: "nx-champ", "aria-label": "Filtrer par statut" }, h("option", { value: "", texte: "Tous les statuts" }), Object.keys(STATUT_CLASSE).map((s) => h("option", { value: s, texte: s.replaceAll("_", " ").toLowerCase() })));
    sel.value = statut; sel.addEventListener("change", () => rendreJournal(sel.value));
    vueJournal.append(h("div", { class: "nx-barre" }, sel, h("span", { class: "nx-dim", texte: "Chaque action du Noyau est écrite ici. Il ne peut ni l'effacer ni la modifier." })));
    const l = await noyau.journal({ statut: statut || undefined, limite: 80 });
    if (!l.length) vueJournal.append(h("p", { class: "nx-intro", texte: "Aucune ligne pour l'instant." }));
    for (const x of l) vueJournal.append(h("div", { class: "nx-j" },
      h("span", { class: "nx-dim", texte: heure(x.quand) }), h("b", { texte: x.outil }), h("span", { class: "nx-j-r", texte: x.params || "" }),
      h("span", { class: "nx-puce " + (STATUT_CLASSE[x.statut] || ""), texte: String(x.statut).replaceAll("_", " ").toLowerCase() }),
      x.sortie && x.sortie.length ? h("span", { class: "nx-dim", texte: "→ " + x.sortie.join(", ") }) : null));
  }

  // ---------- Mémoire ----------
  const vueMemoire = h("section", { class: "nx-vue", "data-nom": "memoire" });
  function rendreMemoire(q = "") {
    vueMemoire.textContent = "";
    const s = noyau.memoire.stats(), t = s.parType;
    const champ = h("input", { class: "nx-champ", type: "search", placeholder: "Chercher dans ma mémoire…", "aria-label": "Chercher dans la mémoire", value: q });
    champ.addEventListener("input", () => { clearTimeout(champ._t); champ._t = setTimeout(() => rendreMemoire(champ.value), 200); });
    vueMemoire.append(h("div", { class: "nx-stats" },
      [["épisodes", t.epi], ["faits", t.sem], ["règles", t.pro], ["fiches", t.kb], ["articles", t.wiki], ["archivées", s.archives], ["non vérifiées", s.nonVerifies]].map(([n, v]) => h("span", {}, h("b", { texte: String(v || 0) }), " " + n))),
      champ, h("p", { class: "nx-dim", texte: "Les fiches archivées restent dans la mémoire mais ne servent plus aux réponses. Seul toi peux décider de les supprimer." }));
    if (q.trim()) {
      const r = noyau.memoire.chercher(q, { limite: 10, lointain: true });
      if (!r.length) vueMemoire.append(h("p", { class: "nx-intro", texte: "Rien de pertinent trouvé." }));
      r.forEach((x) => vueMemoire.append(h("article", { class: "nx-av" }, h("div", { class: "nx-av-t" }, h("b", { texte: x.titre || x.etiquette }), h("span", { class: "nx-dim", texte: x.etiquette + (x.verifie === false ? " · non vérifié" : "") })), h("p", { texte: x.texte.slice(0, 260) }))));
    }
  }

  // ---------- Claude : clé, plafonds, routage ----------
  function claudeBloc(s) {
    const c = s.claude, z = h("div", { class: "nx-claude" }), msg = h("span", { class: "nx-dim" });
    const cle = h("input", { class: "nx-champ", type: "password", autocomplete: "off", placeholder: c.cle ? "Clé Claude enregistrée (chiffrée). Colle-en une autre pour la remplacer." : "Clé API Claude (sk-ant-…)", "aria-label": "Clé API Claude" });
    const modele = h("select", { class: "nx-champ", "aria-label": "Modèle Claude" }, [["claude-haiku-5-5", "Haiku 5.5 (le moins cher, par défaut)"], ["claude-sonnet-5-5", "Sonnet 5.5 (plus fin, plus cher)"], ["claude-opus-5-5", "Opus 5.5 (le plus fin, le plus cher)"]].map(([v, t]) => h("option", { value: v, texte: t })));
    modele.value = noyau.reglage("modele-claude") || "claude-haiku-5-5"; modele.addEventListener("change", () => noyau.reglage("modele-claude", modele.value));
    const routage = h("select", { class: "nx-champ", "aria-label": "Routage" }, [["auto", "Automatique (Gemini pour le courant, Claude pour l'exigeant)"], ["gemini", "Toujours Gemini quand c'est possible"], ["claude", "Toujours Claude quand c'est possible"]].map(([v, t]) => h("option", { value: v, texte: t })));
    routage.value = noyau.reglage("routage") || "auto"; routage.addEventListener("change", () => noyau.reglage("routage", routage.value));
    const req = h("input", { class: "nx-champ nx-court", type: "number", min: "1", max: "1500", value: String(c.plafondRequetes), "aria-label": "Plafond de requêtes Claude par jour" }); req.addEventListener("change", () => { noyau.budgetClaude.definirPlafond(parseInt(req.value, 10) || 20); });
    const jet = h("input", { class: "nx-champ nx-court", type: "number", min: "1000", step: "1000", value: String(c.plafondJetons), "aria-label": "Plafond de jetons Claude par jour" }); jet.addEventListener("change", () => { noyau.jetonsClaude.definirPlafond(parseInt(jet.value, 10) || 60000); });
    z.append(h("p", { class: "nx-dim", texte: "Les deux moteurs peuvent être actifs. En mode Auto, chaque demande part vers Gemini (gratuit) ou vers Claude selon sa complexité et les jetons qu'il reste ; si l'un échoue (quota, réseau, crédit), l'autre prend le relais. Mémoire, consignes et outils sont identiques : seul le moteur change. Attention : l'API Claude est facturée à part, et le contenu de la conversation lui est envoyé comme à Gemini. Le plafond ci-dessous limite la dépense." }),
      h("label", { class: "nx-dim" }, "Clé Claude", cle),
      h("div", { class: "nx-actions" }, h("button", { class: "nx-btn nx-primaire", type: "button", onclick: () => { try { if (!cle.value.trim()) { msg.textContent = "Colle d'abord la clé."; return; } noyau.definirCleClaude(cle.value.trim()); cle.value = ""; msg.textContent = "Clé enregistrée (chiffrée par le coffre)."; rendreReglages(); } catch (e) { msg.textContent = e.message; } } }, "Enregistrer la clé"),
        c.cle ? h("button", { class: "nx-btn", type: "button", onclick: () => { noyau.definirCleClaude(null); rendreReglages(); } }, "Retirer la clé") : null, msg),
      h("div", { class: "nx-grille" }, h("label", {}, "Modèle Claude", modele), h("label", {}, "Routage", routage), h("label", {}, "Requêtes Claude par jour", req), h("label", {}, "Jetons Claude par jour", jet)),
      h("p", { class: "nx-dim", texte: `Aujourd'hui : ${c.requetes}/${c.plafondRequetes} requêtes et ${c.jetons}/${c.plafondJetons} jetons Claude${c.dernier ? " · dernier moteur utilisé : " + c.dernier : ""}.` }));
    return z;
  }

  // ---------- Relais gratuit (Groq, Mistral, OpenRouter, Cerebras) ----------
  function libreBloc(s) {
    const l = s.libre, z = h("div", { class: "nx-claude" }), msg = h("span", { class: "nx-dim" });
    const fo = h("select", { class: "nx-champ", "aria-label": "Fournisseur du relais" }, [["groq", "Groq"], ["mistral", "Mistral"], ["openrouter", "OpenRouter (modèles :free)"], ["cerebras", "Cerebras"]].map(([v, t]) => h("option", { value: v, texte: t })));
    fo.value = l.fournisseur; fo.addEventListener("change", () => { noyau.reglage("libre-fournisseur", fo.value); noyau.reglage("libre-modele", ""); rendreReglages(); });
    const mod = h("input", { class: "nx-champ", type: "text", placeholder: "Modèle (vide = celui par défaut du fournisseur)", value: noyau.reglage("libre-modele") || "", "aria-label": "Modèle du relais" }); mod.addEventListener("change", () => noyau.reglage("libre-modele", mod.value.trim()));
    const cle = h("input", { class: "nx-champ", type: "password", autocomplete: "off", placeholder: l.cle ? "Clé du relais enregistrée (chiffrée). Colle-en une autre pour la remplacer." : "Clé API gratuite du fournisseur choisi", "aria-label": "Clé du relais gratuit" });
    const req = h("input", { class: "nx-champ nx-court", type: "number", min: "1", max: "1500", value: String(l.plafondRequetes), "aria-label": "Plafond de requêtes du relais par jour" }); req.addEventListener("change", () => noyau.budgetLibre.definirPlafond(parseInt(req.value, 10) || 30));
    z.append(h("p", { class: "nx-dim", texte: "Relais de durabilité : quand Gemini et Claude sont indisponibles (quota, réseau, crédit), ce fournisseur gratuit répond à leur place. Il n'est jamais utilisé avant eux. Les offres gratuites changent : si un modèle disparaît, change son nom ici. Le contenu de la conversation est envoyé à ce fournisseur, comme aux autres." }),
      h("div", { class: "nx-grille" }, h("label", {}, "Fournisseur", fo), h("label", {}, "Modèle", mod), h("label", {}, "Requêtes par jour", req)),
      h("label", { class: "nx-dim" }, "Clé du relais", cle),
      h("div", { class: "nx-actions" }, h("button", { class: "nx-btn nx-primaire", type: "button", onclick: () => { try { if (!cle.value.trim()) { msg.textContent = "Colle d'abord la clé."; return; } noyau.definirCleLibre(cle.value.trim()); cle.value = ""; msg.textContent = "Clé enregistrée (chiffrée par le coffre)."; rendreReglages(); } catch (e) { msg.textContent = e.message; } } }, "Enregistrer la clé"),
        l.cle ? h("button", { class: "nx-btn", type: "button", onclick: () => { noyau.definirCleLibre(null); rendreReglages(); } }, "Retirer la clé") : null, msg),
      h("p", { class: "nx-dim", texte: `Aujourd'hui : ${l.requetes}/${l.plafondRequetes} requêtes du relais.` }));
    return z;
  }

  // ---------- Sauvegarde dans un dossier du PC ----------
  function sauvegardeBloc() {
    const z = h("div", { class: "nx-sauv" });
    (async () => {
      const e = await noyau.sauvegarde.etat(); z.textContent = "";
      if (!e.dispo) { z.append(h("p", { class: "nx-dim", texte: "Ce navigateur ne sait pas écrire dans un dossier (Chrome, Edge et Brave sur PC le savent). Utilise Diag → Exporter." })); return; }
      const der = Date.parse(e.derniere);
      z.append(h("p", { class: "nx-dim", texte: e.dossier ? `Dossier choisi : « ${e.dossier.nom} ». Une sauvegarde par jour quand le hub est ouvert, chiffrée si le verrouillage est actif ; les 7 dernières sont gardées. Dernière : ${isFinite(der) ? new Date(der).toLocaleString("fr-FR") : "jamais"}.${e.droit !== "granted" ? " Le navigateur demande de réautoriser le dossier." : ""}` : "Choisis un dossier de ton PC (idéalement synchronisé avec Google Drive) : le hub y déposera ses sauvegardes tout seul. Rien n'est écrit ailleurs." }));
      const msg = h("span", { class: "nx-dim" });
      z.append(h("div", { class: "nx-actions" },
        h("button", { class: "nx-btn", type: "button", onclick: async () => { try { await noyau.sauvegarde.choisir(); msg.textContent = "Dossier choisi."; z.replaceWith(sauvegardeBloc()); } catch (x) { msg.textContent = x.name === "AbortError" ? "Choix annulé." : "Impossible : " + x.message; } } }, e.dossier ? "Changer de dossier" : "Choisir le dossier"),
        e.dossier ? h("button", { class: "nx-btn nx-primaire", type: "button", onclick: async (ev) => { ev.currentTarget.disabled = true; try { const r = await noyau.sauvegarde.maintenant({ demander: true }); msg.textContent = `Écrit : ${r.nom} (${Math.round(r.octets / 1024)} Ko${r.chiffre ? ", chiffré" : ", non chiffré : active le verrouillage"}).`; } catch (x) { msg.textContent = x.message; } ev.currentTarget.disabled = false; } }, "Sauvegarder maintenant") : null,
        e.dossier ? h("button", { class: "nx-btn", type: "button", onclick: async () => { await noyau.sauvegarde.retirer(); z.replaceWith(sauvegardeBloc()); } }, "Oublier ce dossier") : null, msg));
    })();
    return z;
  }

  // ---------- Réglages et imports ----------
  const vueReglages = h("section", { class: "nx-vue", "data-nom": "reglages" });
  function bascule(libelle, cle, defaut, aide) {
    const cb = h("input", { type: "checkbox" }); cb.checked = (noyau.reglage(cle) || (defaut ? "on" : "off")) !== "off";
    cb.addEventListener("change", () => noyau.reglage(cle, cb.checked ? "on" : "off"));
    return h("label", { class: "nx-bascule" }, cb, h("span", {}, libelle, aide ? h("small", { texte: aide }) : null));
  }
  function rendreReglages() {
    vueReglages.textContent = "";
    const s = noyau.statut();
    const moteur = h("select", { class: "nx-champ", "aria-label": "Moteur" }, h("option", { value: "auto", texte: "Auto : Gemini + Claude (recommandé avec les deux clés)" }), h("option", { value: "gemini", texte: "Gemini seul (gratuit, en ligne)" }), h("option", { value: "claude", texte: "Claude seul (API payante)" }), h("option", { value: "local", texte: "IA locale (PC, secours hors ligne)" }));
    moteur.value = noyau.reglage("moteur") || (s.claude.cle || s.libre.cle ? "auto" : "gemini"); moteur.addEventListener("change", () => { noyau.reglage("moteur", moteur.value); majBudget(); });
    const modele = h("select", { class: "nx-champ", "aria-label": "Modèle Gemini" }, h("option", { value: "gemini-flash-lite-latest", texte: "Flash-Lite (quota large, par défaut)" }), h("option", { value: "gemini-flash-latest", texte: "Flash (plus fin, quota plus serré)" }));
    modele.value = noyau.reglage("modele") || "gemini-flash-lite-latest"; modele.addEventListener("change", () => noyau.reglage("modele", modele.value));
    const plafond = h("input", { class: "nx-champ nx-court", type: "number", min: "1", max: "1500", value: String(s.budget.plafond), "aria-label": "Plafond de requêtes par jour" });
    plafond.addEventListener("change", () => { noyau.budget.definirPlafond(parseInt(plafond.value, 10) || 40); majBudget(); });
    const imports = h("div", { class: "nx-imports" });
    vueReglages.append(
      h("p", { class: "nx-intro", texte: `${s.moteur} · ${s.budget.utilisees}/${s.budget.plafond} requêtes aujourd'hui · ${s.hote}` }),
      h("div", { class: "nx-grille" }, h("label", {}, "Moteur", moteur), h("label", {}, "Modèle", modele), h("label", {}, "Plafond par jour", plafond)),
      h("p", { class: "nx-dim", texte: "La clé Gemini est celle de l'orbe (gardée chiffrée par le coffre, verrouillage actif obligatoire). Elle se colle dans le panneau de l'orbe : clic sur l'orbe → engrenage." }),
      bascule("Accueil du jour", "accueil", true, "Une phrase par jour, composée sans requête."),
      bascule("Remarques opportunes", "remarques", true, "Au plus une toutes les 2 heures, jamais en Focus ni la nuit."),
      bascule("Sommeil", "sommeil", true, "Consolide la mémoire une fois par jour (1 requête)."),
      bascule("Recommandation système toutes les 30 min", "recos", true, "Locale, sans requête Gemini. Silencieuse en Focus, la nuit et écran verrouillé."),
      h("div", { class: "nx-actions" }, h("button", { class: "nx-btn", type: "button", onclick: () => document.dispatchEvent(new CustomEvent("noyau:ouvrir-securite")) }, "Ouvrir la sécurité")),
      bascule("Curiosité (mode autonome)", "curiosite", false, "Hub ouvert seulement. 1 recherche par 30 min, sans requête Gemini."),
      bascule("Lire mes réponses à voix haute", "voix-auto", false),
      h("div", { class: "nx-actions" },
        h("button", { class: "nx-btn", type: "button", onclick: async (e) => { e.currentTarget.disabled = true; const r = await noyau.dormir({ force: true }); note(r.fait ? `Sommeil terminé : ${r.propositions} proposition(s) à valider.` : "Sommeil : " + r.raison); majNav(); majBudget(); e.currentTarget.disabled = false; } }, "Dormir maintenant"),
        h("button", { class: "nx-btn", type: "button", onclick: () => { noyau.cycle.oublierConversation(); fil.textContent = ""; accueilVide(); changerVue("chat"); } }, "Nouvelle conversation")),
      h("h4", { texte: "Claude (API payante) et choix automatique" }), claudeBloc(s),
      h("h4", { texte: "Relais gratuit de secours" }), libreBloc(s),
      h("h4", { texte: "Sauvegarde automatique" }), sauvegardeBloc(),
      h("h4", { texte: "Références consultées" }), sourcesBloc(),
      h("h4", { texte: "Importer" }), imports);
    imports.append(importBloc("Ma mémoire v3.8 (fichier noyau-full-state.json)", async (texte, zone) => {
      zone.textContent = "Lecture du fichier…";
      let ap; try { ap = await noyau.apercu38(texte); } catch (e) { zone.textContent = e.message; return; }
      const r = ap.resume;
      zone.textContent = "";
      zone.append(h("p", {}, `${r.total} éléments : ${r.souvenirs} souvenirs, ${r.faits} faits, ${r.fiches} fiches (${r["vérifiées"]} vérifiées, ${r["nonVérifiées"]} non vérifiées, ${r["archivées"]} archivées), ${r.articles} articles. ${r.identifiantsEnDouble} identifiant(s) en double renuméroté(s). Empreinte ${ap.empreinte.slice(0, 12)}… ${ap.coherent ? "(contrôle croisé réussi)" : "(CONTRÔLE CROISÉ EN ÉCHEC)"}`),
        h("p", { class: "nx-dim", texte: "Tout est importé, rien n'est supprimé. L'import est vérifié (comptage et empreinte) puis annulé en entier si une seule unité manque." }),
        h("button", { class: "nx-btn nx-primaire", type: "button", disabled: !ap.coherent, onclick: async (e) => {
          e.currentTarget.disabled = true; const bar = h("p", { class: "nx-dim" }); zone.append(bar);
          const res = await noyau.importer38(texte, (etape) => { bar.textContent = etape + "…"; });
          bar.textContent = res.ok ? `Import vérifié : ${res.comptes.total} éléments, empreinte identique avant et après (${res.empreinteApres.slice(0, 12)}…).` : res.raison;
          bar.className = res.ok ? "nx-ok" : "nx-erreur"; majNav();
          if (res.ok) proposerHub(texte, zone);
        } }, "Importer (avec vérification)"));
    }));
    imports.append(importBloc("Mon cerveau (noyau/cerveau.md)", async (texte, zone) => {
      try { const r = await noyau.importerCerveau(texte); zone.textContent = `Cerveau importé (${r.faitsFondateurs} fait(s) fondateur(s)). Il est gardé chiffré par le coffre.`; zone.className = "nx-ok"; }
      catch (e) { zone.textContent = e.message; zone.className = "nx-erreur"; }
    }, "Le cerveau personnalisé n'est jamais dans le dépôt public : il vient de ton Projet."));
  }
  function sourcesBloc() {
    let coupees = []; try { coupees = JSON.parse(noyau.reglage("sources-off") || "[]"); } catch (e) { coupees = []; }
    const enreg = () => noyau.reglage("sources-off", JSON.stringify(coupees));
    const zone = h("details", {}, h("summary", { texte: `${SOURCES.length - coupees.length} sources actives sur ${SOURCES.length}` }),
      h("p", { class: "nx-dim", texte: "Seuls des mots-clés partent vers ces sites, jamais ton nom, un mail ni un numéro. Décoche ce que tu ne veux pas consulter." }));
    for (const [d, nom] of Object.entries(DOMAINES)) {
      const l = SOURCES.filter((x) => x.domaines[0] === d); if (!l.length) continue;
      zone.append(h("p", { class: "nx-dim", texte: nom }));
      for (const x of l) {
        const cb = h("input", { type: "checkbox" }); cb.checked = !coupees.includes(x.id);
        cb.addEventListener("change", () => { coupees = cb.checked ? coupees.filter((i) => i !== x.id) : [...coupees, x.id]; enreg(); zone.querySelector("summary").textContent = `${SOURCES.length - coupees.length} sources actives sur ${SOURCES.length}`; });
        zone.append(h("label", { class: "nx-bascule" }, cb, h("span", {}, x.nom, h("small", { texte: x.hote }))));
      }
    }
    return zone;
  }
  function importBloc(titre, quand, aide) {
    const zone = h("div", { class: "nx-zone", "aria-live": "polite" });
    const fichier = h("input", { type: "file", accept: ".json,.md,.txt,application/json,text/markdown,text/plain", "aria-label": titre });
    fichier.addEventListener("change", async () => { const f = fichier.files[0]; if (!f) return; zone.className = "nx-zone"; quand(await f.text(), zone); });
    return h("div", { class: "nx-import" }, h("label", {}, h("b", { texte: titre }), fichier), aide ? h("p", { class: "nx-dim", texte: aide }) : null, zone);
  }
  function proposerHub(texte, zone) {
    let els = []; try { els = noyau.elementsHub38(texte); } catch (e) { return; }
    if (!els.length) return;
    const liste = h("div", { class: "nx-coches" }); const cases = [];
    els.forEach((el) => { const cb = h("input", { type: "checkbox", checked: false }); cases.push([cb, el.cle]); liste.append(h("label", {}, cb, h("span", {}, h("b", { texte: el.genre + " : " }), el.texte.slice(0, 90), el.detail ? h("small", { texte: " · " + el.detail }) : null))); });
    zone.append(h("h4", { texte: "Tâches, notes, favoris, rappel de l'ancienne app" }), h("p", { class: "nx-dim", texte: "Certains peuvent être des données de démonstration : coche seulement ce que tu veux dans le hub. Proposé une seule fois." }), liste,
      h("button", { class: "nx-btn", type: "button", onclick: async (e) => { const cles = cases.filter(([c]) => c.checked).map(([, k]) => k); const r = await noyau.importerHub38(texte, cles); e.currentTarget.replaceWith(h("p", { class: "nx-ok", texte: `Ajouté au hub : ${r.taches} tâche(s), ${r.notes} note(s), ${r.favoris} favori(s), ${r.rappels} rappel(s).` })); } }, "Importer la sélection"));
  }

  // ---------- Navigation ----------
  const VUES = { chat: ["Échange", () => {}], valider: ["À valider", rendreValider], journal: ["Journal", () => rendreJournal()], memoire: ["Mémoire", () => rendreMemoire()], reglages: ["Réglages", rendreReglages] };
  const nav = h("nav", { class: "nx-nav", "aria-label": "Sections du Noyau" });
  const boutons = {};
  for (const [k, [nom]] of Object.entries(VUES)) { boutons[k] = h("button", { class: "nx-onglet", type: "button", "aria-pressed": k === "chat" ? "true" : "false", onclick: () => changerVue(k) }, nom); nav.append(boutons[k]); }
  function changerVue(k) { racine.dataset.vue = k; Object.entries(boutons).forEach(([n, b]) => b.setAttribute("aria-pressed", String(n === k))); VUES[k][1](); if (k === "chat") fil.scrollTop = fil.scrollHeight; }
  function majNav() { const n = noyau.aValider().length; boutons.valider.textContent = "À valider" + (n ? ` (${n})` : ""); boutons.valider.classList.toggle("alerte", n > 0); }

  racine.append(etat, chat, vueValider, vueJournal, vueMemoire, vueReglages, nav);

  // ---------- Messages du Noyau ----------
  noyau.surMessage((m) => {
    if (m.type === "etat") { racine.dataset.phase = m.phase; phaseTxt.textContent = PHASES[m.phase] || m.phase; if (m.budget != null) majBudget(); }
    else if (m.type === "reponse") {
      if (m.refaite) { majReponse(m); return; }
      majReponse(m); tourActif = m.tour; majNav(); majBudget();
      if ((noyau.reglage("voix-auto") || "off") === "on" && lectureDispo()) lireVoix(m.texte, { ton: m.ton });
    } else if (m.type === "erreur") { /* le texte de la réponse en mode réduit explique déjà */ }
    else if (m.type === "initiative") {
      fil.querySelector(".nx-vide")?.remove();
      fil.append(h("article", { class: "nx-m nx-noyau nx-init", "data-ton": m.niveau === "critique" ? "preoccupe" : m.niveau === "alerte" ? "vigilant" : "curieux" }, h("p", { texte: m.texte }), h("div", { class: "nx-meta" }, h("span", { class: "nx-etiq" + (m.niveau === "critique" ? " bad" : m.niveau === "alerte" ? " warn" : ""), texte: m.raison === "accueil" ? "accueil" : m.raison === "systeme" ? "recommandation système" : m.raison === "resume" ? "résumé" : m.raison === "curiosite" ? "curiosité" : m.raison === "soir" ? "fin de journée" : "remarque" }), m.action === "revue" ? h("button", { class: "nx-btn nx-primaire", type: "button", onclick: (e) => { e.currentTarget.disabled = true; poser("Revue de fin de journée"); } }, "Faire le point") : null, m.action === "export" ? h("button", { class: "nx-btn nx-primaire", type: "button", onclick: (e) => { noyau.exporter(); e.currentTarget.disabled = true; e.currentTarget.textContent = "Export lancé"; } }, "Exporter maintenant") : null, m.raison === "systeme" && m.niveau !== "ok" && m.action !== "export" ? h("button", { class: "nx-lien", type: "button", onclick: () => document.dispatchEvent(new CustomEvent("noyau:ouvrir-securite")) }, "Ouvrir la sécurité") : null, h("button", { class: "nx-lien", type: "button", onclick: (e) => e.currentTarget.closest(".nx-m").remove() }, "Ignorer"))));
      fil.scrollTop = fil.scrollHeight;
    } else if (m.type === "a_valider") majNav();
  });

  document.addEventListener("noyau:initiative", (e) => { const m = e.detail || {}; noyau.cycle.emettre({ type: "initiative", texte: m.texte, raison: m.raison || "systeme", niveau: m.niveau || "info" }); });
  accueilVide(); majBudget(); majNav();
  return {
    racine, poser, note, changerVue,
    ouvrir() { const w = conteneur.closest(".win"); if (w) { document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: w.dataset.id })); w.classList.remove("hid"); } saisie.focus(); },
    rafraichir() { majBudget(); majNav(); }
  };
}
