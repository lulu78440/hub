// Noyau · fenêtre Sécurité. Quatre vues : Vue d'ensemble, Activité, Code, Correctifs. Texte inséré uniquement avec textContent.
import { hote } from "./hote.js";

const NIV = { ok: "ok", info: "info", alerte: "warn", critique: "bad" };
const GRAV = { haute: "bad", moyenne: "warn", faible: "info" };
function h(tag, a = {}, ...k) { const e = document.createElement(tag); for (const [n, v] of Object.entries(a || {})) { if (v == null || v === false) continue; if (n === "class") e.className = v; else if (n.startsWith("on")) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; }
const quand = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

export function monterSecurite(conteneur, sentinelle) {
  conteneur.textContent = "";
  const racine = h("div", { class: "nx nx-secu", "data-vue": "ensemble" });
  conteneur.append(racine);
  const vues = {}, onglets = {};
  const NOMS = { ensemble: "Vue d'ensemble", activite: "Activité", code: "Code", correctifs: "Correctifs" };
  const nav = h("nav", { class: "nx-nav nx-haut", "aria-label": "Sections de la sécurité" });
  for (const [k, n] of Object.entries(NOMS)) { vues[k] = h("section", { class: "nx-vue", "data-nom": k }); onglets[k] = h("button", { class: "nx-onglet", type: "button", "aria-pressed": k === "ensemble" ? "true" : "false", onclick: () => aller(k) }, n); nav.append(onglets[k]); }
  racine.append(nav, ...Object.values(vues));
  const rendus = { ensemble: rendreEnsemble, activite: rendreActivite, code: rendreCode, correctifs: rendreCorrectifs };
  function aller(k) { racine.dataset.vue = k; Object.entries(onglets).forEach(([n, b]) => b.setAttribute("aria-pressed", String(n === k))); rendus[k](); }
  const pastille = (niv) => h("span", { class: "nx-puce " + (NIV[niv] || "") }, niv === "ok" ? "bon" : niv === "info" ? "à noter" : niv);

  // ----- Vue d'ensemble -----
  async function rendreEnsemble() {
    const v = vues.ensemble; v.textContent = "";
    v.append(h("p", { class: "nx-intro" }, "Le Noyau surveille ce que le hub peut voir de lui-même, en continu et sans aucune requête Gemini."),
      h("details", { class: "nx-aide" }, h("summary", {}, "Ce que cette surveillance ne peut pas faire"),
        h("p", {}, "Une page web ne voit pas l'adresse IP de ceux qui la visitent, ni ce qui se passe sur ton PC ou sur ton compte. Le hub est une page publique : n'importe qui peut la charger, mais ses données restent dans ton navigateur, chiffrées par le coffre."),
        h("p", {}, "Pour les connexions à ton compte GitHub (avec leurs adresses IP), regarde le journal de sécurité de GitHub. Pour ton compte Google, le contrôle de sécurité de Google."),
        h("div", { class: "nx-actions" }, h("a", { class: "nx-lien", href: "https://github.com/settings/security-log", target: "_blank", rel: "noopener noreferrer" }, "Journal de sécurité GitHub"), h("a", { class: "nx-lien", href: "https://myaccount.google.com/security-checkup", target: "_blank", rel: "noopener noreferrer" }, "Contrôle de sécurité Google"))));
    const zone = h("div", {}, h("p", { class: "nx-dim" }, "Analyse en cours…")); v.append(zone);
    const c = await sentinelle.veille(); zone.textContent = "";
    const ordre = { critique: 0, alerte: 1, info: 2, ok: 3 };
    c.slice().sort((a, b) => ordre[a.niveau] - ordre[b.niveau]).forEach((x) => zone.append(h("article", { class: "nx-av nx-ctl", "data-niv": x.niveau }, h("div", { class: "nx-av-t" }, h("b", {}, x.titre), pastille(x.niveau)), x.detail ? h("p", { class: "nx-dim" }, x.detail) : null, x.conseil ? h("p", {}, x.conseil) : null)));
    v.append(h("div", { class: "nx-actions" }, h("button", { class: "nx-btn", type: "button", onclick: rendreEnsemble }, "Analyser maintenant"), h("span", { class: "nx-dim" }, "Dernière analyse : " + quand(sentinelle.dernier().quand))));
  }

  // ----- Activité -----
  async function rendreActivite() {
    const v = vues.activite; v.textContent = "";
    v.append(h("h4", {}, "Journal de sécurité"));
    const jl = await sentinelle.journal({ limite: 40 }); const lib = { deverrouillage_echec: "Échec de déverrouillage", deverrouillage_ok: "Déverrouillage réussi", erreur_js: "Erreur du code", reference: "Référence enregistrée", correctif_valide: "Correctif validé" };
    if (!jl.length) v.append(h("p", { class: "nx-dim" }, "Rien d'enregistré pour l'instant. Les déverrouillages et les erreurs apparaîtront ici."));
    jl.forEach((l) => v.append(h("div", { class: "nx-j" }, h("span", { class: "nx-dim" }, quand(l.quand)), h("b", {}, lib[l.type] || l.type), h("span", { class: "nx-j-r" }, l.detail || ""), h("span", { class: "nx-puce " + (l.type === "deverrouillage_echec" ? "bad" : l.type === "erreur_js" ? "warn" : "ok") }, l.type === "deverrouillage_echec" ? "à surveiller" : "noté"))));
    v.append(h("h4", {}, "Connexions du Noyau vers l'extérieur"));
    const r = await sentinelle.reseau();
    if (!r.length) v.append(h("p", { class: "nx-dim" }, "Aucune connexion depuis l'ouverture du hub."));
    r.forEach((x) => v.append(h("div", { class: "nx-j" }, h("b", {}, x.hote), h("span", { class: "nx-dim" }, `${x.n} fois · dernière ${quand(x.dernier)}`), h("span", { class: "nx-puce " + (x.attendu ? "ok" : "bad") }, x.attendu ? "attendu" : "inattendu"))));
    v.append(h("h4", {}, "Empreinte des fichiers du hub"));
    const zEmp = h("div", {}, h("p", { class: "nx-dim" }, "Contrôle…")); v.append(zEmp);
    const b = await sentinelle.base(); zEmp.textContent = "";
    const msg = { "sans-reference": "Aucune référence : enregistre l'état actuel pour pouvoir repérer toute modification.", ok: "Tous les fichiers sensibles sont identiques à ta référence (" + quand(b.reference) + ").", differe: "Fichiers modifiés depuis ta référence : " + (b.differents || []).join(", "), indisponible: "Contrôle impossible (hors ligne, ou le hub n'est pas ouvert depuis son adresse GitHub Pages)." };
    zEmp.append(h("p", { class: b.etat === "differe" ? "nx-erreur" : "" }, msg[b.etat]), h("div", { class: "nx-actions" }, h("button", { class: "nx-btn", type: "button", disabled: b.etat === "indisponible", onclick: async () => { await sentinelle.accepterReference(); rendreActivite(); } }, b.etat === "differe" ? "J'ai fait ces modifications : accepter" : "Enregistrer l'état actuel comme référence")));
    v.append(h("h4", {}, "Activité du dépôt GitHub"));
    const zG = h("div", {}, h("p", { class: "nx-dim" }, "Lecture de GitHub…")); v.append(zG);
    try {
      const a = await sentinelle.activiteDepot(); zG.textContent = "";
      if (a.auteursNouveaux.length) zG.append(h("p", { class: "nx-erreur" }, "Nouvel auteur sur le dépôt : " + a.auteursNouveaux.join(", ") + ". Si ce n'est pas toi ou un outil que tu utilises, vérifie le journal GitHub."));
      else if (a.nouveaux.length && !a.premiereVisite) zG.append(h("p", {}, `${a.nouveaux.length} nouvelle(s) modification(s) depuis ta dernière visite.`));
      a.commits.forEach((c, i) => zG.append(h("div", { class: "nx-j" }, h("span", { class: "nx-dim" }, quand(c.quand)), h("b", {}, c.auteur), h("span", { class: "nx-j-r" }, c.message), h("span", { class: "nx-puce" + (i < a.nouveaux.length && !a.premiereVisite ? " warn" : "") }, c.sha))));
      zG.append(h("div", { class: "nx-actions" }, h("button", { class: "nx-btn", type: "button", onclick: async () => { await sentinelle.marquerVu(a); rendreActivite(); } }, "J'ai tout vu"), h("span", { class: "nx-dim" }, "GitHub ne montre pas les adresses IP : seulement qui a modifié le code, et quand.")));
    } catch (e) { zG.textContent = ""; zG.append(h("p", { class: "nx-erreur" }, e.message)); }
  }

  // ----- Code -----
  let trouvailles = null, analyses = new Map();
  async function rendreCode() {
    const v = vues.code; v.textContent = "";
    const prog = h("span", { class: "nx-dim" }); const liste = h("div");
    const btn = h("button", { class: "nx-btn nx-primaire", type: "button", onclick: async () => { btn.disabled = true; prog.textContent = "Lecture des fichiers…"; const r = await sentinelle.auditCode({ surProgres: (n, t) => { prog.textContent = `Fichier ${n} sur ${t}…`; } }); btn.disabled = false; if (r.erreur) { prog.textContent = r.erreur; return; } trouvailles = r.trouvailles; prog.textContent = `${r.trouvailles.length} point(s) relevé(s) dans ${r.fichiers} fichiers.`; rendreListe(); } }, trouvailles ? "Relancer l'analyse" : "Analyser le code du hub");
    v.append(h("p", { class: "nx-intro" }, "Relit index.html et les fichiers du hub à la recherche de défauts courants. Le Noyau peut ensuite expliquer un point et proposer un correctif, mais il ne modifie jamais le code lui-même : tu valides, puis le correctif est appliqué en dehors du Noyau."), h("div", { class: "nx-actions" }, btn, prog), liste);
    function rendreListe() {
      liste.textContent = "";
      (trouvailles || []).slice(0, 60).forEach((f) => {
        const zone = h("div", { class: "nx-analyse" });
        const carte = h("article", { class: "nx-av nx-ctl", "data-niv": GRAV[f.gravite] === "bad" ? "critique" : GRAV[f.gravite] === "warn" ? "alerte" : "info" }, h("div", { class: "nx-av-t" }, h("b", {}, f.titre), h("span", { class: "nx-puce " + GRAV[f.gravite] }, f.gravite)), h("p", { class: "nx-dim" }, f.fichier + (f.ligne ? " · ligne " + f.ligne : "")), f.extrait ? h("pre", { class: "nx-code" }, f.extrait) : null, f.pourquoi ? h("p", { class: "nx-dim" }, f.pourquoi) : null, zone,
          h("div", { class: "nx-actions" },
            h("button", { class: "nx-lien", type: "button", onclick: (e) => analyser(f, zone, e.currentTarget) }, "Analyser avec le Noyau (1 requête)"),
            h("button", { class: "nx-lien", type: "button", onclick: () => { trouvailles = trouvailles.filter((x) => x !== f); rendreListe(); } }, "Ignorer")));
        if (analyses.has(f.id)) montrerAnalyse(f, zone, analyses.get(f.id));
        liste.append(carte);
      });
      if ((trouvailles || []).length > 60) liste.append(h("p", { class: "nx-dim" }, `Les 60 plus importants sont affichés sur ${trouvailles.length}.`));
    }
    async function analyser(f, zone, bouton) {
      bouton.disabled = true; zone.textContent = ""; zone.append(h("p", { class: "nx-dim" }, "Analyse…"));
      try { const t = await sentinelle.analyser(f); analyses.set(f.id, t); montrerAnalyse(f, zone, t); } catch (e) { zone.textContent = ""; zone.append(h("p", { class: "nx-erreur" }, e.message)); }
      bouton.disabled = false;
    }
    function montrerAnalyse(f, zone, t) {
      zone.textContent = ""; zone.append(h("pre", { class: "nx-code nx-long" }, t), h("div", { class: "nx-actions" }, h("button", { class: "nx-btn", type: "button", onclick: async (e) => { await sentinelle.validerCorrectif(f, t); e.currentTarget.replaceWith(h("span", { class: "nx-ok" }, "Correctif validé : retrouve-le dans Correctifs.")); } }, "Valider ce correctif"), h("span", { class: "nx-dim" }, "Valider ne change aucun fichier.")));
    }
    if (trouvailles) rendreListe();
  }

  // ----- Correctifs -----
  async function rendreCorrectifs() {
    const v = vues.correctifs; v.textContent = "";
    const l = await sentinelle.correctifs();
    v.append(h("p", { class: "nx-intro" }, "Les correctifs que tu as validés. Le Noyau ne les applique pas : copie la demande ci-dessous et donne-la à Claude dans la discussion de construction, qui modifie le code, le teste et te le montre."));
    const attente = l.filter((c) => c.statut === "valide");
    v.append(h("div", { class: "nx-actions" }, h("button", { class: "nx-btn nx-primaire", type: "button", disabled: !attente.length, onclick: async (e) => { const t = await sentinelle.demandeDeCorrection(); try { await navigator.clipboard.writeText(t); e.currentTarget.textContent = "Copié"; } catch (er) { const z = h("textarea", { class: "nx-champ", rows: "8" }); z.value = t; v.append(z); z.select(); } } }, "Copier la demande pour Claude"), h("span", { class: "nx-dim" }, `${attente.length} en attente`)));
    if (!l.length) v.append(h("p", { class: "nx-dim" }, "Aucun correctif validé pour l'instant."));
    l.slice().reverse().forEach((c) => v.append(h("article", { class: "nx-av" }, h("div", { class: "nx-av-t" }, h("b", {}, c.titre), h("span", { class: "nx-puce " + (c.statut === "applique" ? "ok" : "warn") }, c.statut === "applique" ? "appliqué" : "à appliquer")), h("p", { class: "nx-dim" }, c.fichier + (c.ligne ? " · ligne " + c.ligne : "") + " · " + quand(c.quand)), h("pre", { class: "nx-code nx-long" }, c.texte), c.statut === "valide" ? h("div", { class: "nx-actions" }, h("button", { class: "nx-lien", type: "button", onclick: async () => { await sentinelle.marquerApplique(c.id); rendreCorrectifs(); } }, "Marquer comme appliqué")) : null)));
  }

  aller("ensemble");
  return { racine, ouvrir() { const w = conteneur.closest(".win"); if (w) { document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: w.dataset.id })); w.classList.remove("hid"); } aller(racine.dataset.vue || "ensemble"); }, rafraichir: () => aller(racine.dataset.vue) };
}
