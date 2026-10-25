// Noyau · sentinelle : surveillance du hub, recommandations toutes les 30 minutes, audit du code.
// Tout est LOCAL et sans requête Gemini, sauf « Analyser » (une requête, à la demande de Lucien).
// Limites assumées, dites dans la fenêtre : une page web ne voit ni les adresses IP de ceux qui la visitent, ni ce qui se passe sur le PC.
// Ce qu'elle peut surveiller pour de vrai : les échecs de déverrouillage, l'état du coffre et des sauvegardes, les connexions sortantes du Noyau,
// les erreurs du code en marche, l'empreinte des fichiers du hub, et l'activité du dépôt GitHub (qui a poussé quoi, et quand).
// Le Noyau ne modifie JAMAIS le code : il propose un correctif, Lucien le valide, et le correctif est appliqué hors du Noyau (principe 6 : le Noyau ne touche
// ni à ses règles ni au code qui les applique).
import { hote } from "./hote.js";

export const DEPOT = "lulu78440/hub";
const FICHIERS_SENSIBLES = ["index.html", "sw.js", "js/main.js", "js/version.js", "js/store/vault.js", "js/ui/lockui.js", "js/widgets/ai.js", "js/noyau/noyau.js", "js/noyau/barriere.js", "js/noyau/outils.js", "js/noyau/hote.js", "js/noyau/boucle.js"];
const CONSEILS = [
  ["Appuie longuement sur l'orbe : le Noyau s'ouvre. Un clic court ouvre le chat IA.", "tip-orbe"],
  ["Dans le Noyau, « À valider » contient ce qu'il aimerait retenir. Un coup d'œil par jour garde sa mémoire propre.", "tip-valider"],
  ["Le Journal du Noyau liste chaque action qu'il a faite. Parcours-le de temps en temps pour t'assurer qu'il n'a rien fait d'inattendu.", "tip-journal"],
  ["Pense à une sauvegarde : Diag → Exporter. Range le fichier sur le PC et dans Google Drive.", "tip-export"],
  ["Tu peux couper les sources que tu ne veux pas consulter : Noyau → Réglages → Références consultées.", "tip-sources"],
  ["Demande au Noyau de préparer ta journée : « Que dois-je faire aujourd'hui ? ». Il lit tes tâches, ton agenda et la météo.", "tip-journee"],
  ["Le mode Focus coupe les remarques du Noyau : lance-le quand tu veux travailler sans être dérangé.", "tip-focus"],
  ["Dans Sécurité → Code, l'analyse repère les petits défauts du hub et prépare un correctif que tu valides.", "tip-code"]
];
const NIVEAUX = { ok: 0, info: 1, alerte: 2, critique: 3 };
const jours = (iso) => { const t = Date.parse(iso); return t ? (hote.maintenant().getTime() - t) / 864e5 : Infinity; };
const coupe = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").slice(0, n);

export function creerSentinelle({ demander = null } = {}) {
  const ecouteurs = new Set(); let dernier = { quand: null, controles: [] };
  const lieu = (id) => hote.stockage.lire("kv", id);
  const garder = async (id, fn, defaut) => { const d = (await lieu(id)) || { id, ...defaut }; const r = fn(d); await hote.stockage.ecrire("kv", d); return r; };
  const racine = () => (hote.racine ? hote.racine() : new URL("./", location.href).href);

  // ---------- Journal de sécurité (ajout seulement, 500 lignes) ----------
  async function noter(type, detail = "") {
    await garder("noyau-secu-journal", (d) => { d.lignes = d.lignes || []; d.lignes.push({ quand: hote.maintenant().toISOString(), type, detail: coupe(detail, 200) }); if (d.lignes.length > 500) d.lignes = d.lignes.slice(-500); }, { lignes: [] });
    ecouteurs.forEach((f) => { try { f({ type: "evenement", evt: type }); } catch (e) { /* ignoré */ } });
  }
  async function journal({ limite = 60, type = "" } = {}) { const d = await lieu("noyau-secu-journal"); return ((d && d.lignes) || []).filter((l) => !type || l.type === type).slice(-limite).reverse(); }

  /** Branche les capteurs du hub : échecs de déverrouillage et erreurs du code en marche. Renvoie une fonction d'arrêt. */
  function surveiller() {
    const surDeverrou = (e) => { const ok = e.detail && e.detail.ok; noter(ok ? "deverrouillage_ok" : "deverrouillage_echec", e.detail && e.detail.secours ? "clé de secours" : "").catch(() => {}); if (!ok) veille().catch(() => {}); };
    const surErreur = (e) => { noter("erreur_js", `${e.message || e.reason && e.reason.message || "erreur"} ${e.filename ? "(" + String(e.filename).split("/").slice(-2).join("/") + ":" + e.lineno + ")" : ""}`).catch(() => {}); };
    document.addEventListener("hub:unlock", surDeverrou); addEventListener("error", surErreur); addEventListener("unhandledrejection", surErreur);
    return () => { document.removeEventListener("hub:unlock", surDeverrou); removeEventListener("error", surErreur); removeEventListener("unhandledrejection", surErreur); };
  }

  // ---------- Contrôles locaux ----------
  async function controles() {
    const c = [], add = (id, niveau, titre, detail, conseil = "") => c.push({ id, niveau, titre, detail, conseil });
    const s = hote.systeme ? await hote.systeme().catch(() => ({})) : {};
    if (s.verrou === false) add("verrou", "critique", "Le verrouillage du hub est désactivé", "Tes données ne sont pas chiffrées sur cet appareil et la clé Gemini ne peut pas être gardée.", "Diag → Verrouillage.");
    else if (s.verrou) add("verrou", "ok", "Verrouillage actif", "Les données sensibles sont chiffrées par le coffre.");
    if (s.cleIA && s.verrou === false) add("cle-sans-coffre", "critique", "Une clé IA est enregistrée sans coffre actif", "La clé pourrait être lisible par d'autres programmes de ce navigateur.", "Active le verrouillage, ou supprime la clé.");
    const echecs = (await journal({ limite: 500, type: "deverrouillage_echec" })).filter((l) => jours(l.quand) < 7);
    const recents = echecs.filter((l) => jours(l.quand) < 1);
    if (recents.length >= 5) add("echecs", "critique", `${recents.length} échecs de déverrouillage en 24 h`, "Quelqu'un (ou toi) a essayé plusieurs fois une mauvaise phrase.", "Si ce n'est pas toi, change ta phrase secrète (Diag → Verrouillage).");
    else if (echecs.length) add("echecs", "alerte", `${echecs.length} échec(s) de déverrouillage cette semaine`, "Le dernier : " + new Date(echecs[0].quand).toLocaleString("fr-FR"), "Si ce n'est pas toi, change ta phrase secrète.");
    else add("echecs", "ok", "Aucun échec de déverrouillage cette semaine", "Le journal ne montre que ce qui s'est passé hub ouvert sur cet appareil.");
    if (s.dernierExport !== undefined) {
      const j = jours(s.dernierExport);
      if (!isFinite(j)) add("export", "alerte", "Aucune sauvegarde exportée", "Si l'appareil est perdu ou le navigateur vidé, tout disparaît.", "Diag → Exporter.");
      else if (j > 14) add("export", "alerte", `Dernière sauvegarde il y a ${Math.round(j)} jours`, "", "Diag → Exporter, puis range le fichier sur le PC et dans Google Drive.");
      else if (j > 8) add("export", "info", `Dernière sauvegarde il y a ${Math.round(j)} jours`, "", "Pense à un export cette semaine.");
      else add("export", "ok", "Sauvegarde récente", `Il y a ${Math.max(0, Math.round(j))} jour(s).`);
    }
    if (s.stockagePersistant === false) add("persistant", "info", "Le stockage n'est pas marqué persistant", "Le navigateur pourrait le vider s'il manque de place.", "Installe le hub (PWA) ou autorise le stockage persistant.");
    if (s.quotaPct != null && s.quotaPct > 80) add("quota", "alerte", `Le stockage du navigateur est rempli à ${s.quotaPct} %`, "", "Exporte puis allège les images.");
    if (s.version && s.swVersion && s.version !== s.swVersion) add("version", "info", "Une mise à jour est en attente", `Le code est en ${s.version}, le cache hors ligne en ${s.swVersion}.`, "Recharge le hub deux fois.");
    else if (s.version) add("version", "ok", "Version du hub " + s.version, s.swVersion ? "Le cache hors ligne est à jour." : "");
    const vus = new Set(((await journal({ limite: 500, type: "erreur_js" })).filter((l) => jours(l.quand) < 1)).map((l) => l.detail));
    if (vus.size >= 3) add("erreurs", "alerte", `${vus.size} erreurs différentes du code en 24 h`, [...vus].slice(0, 2).join(" · "), "Sécurité → Code pour les analyser.");
    else if (vus.size) add("erreurs", "info", `${vus.size} erreur(s) du code en 24 h`, [...vus][0], "Sécurité → Code pour les analyser.");
    else add("erreurs", "ok", "Aucune erreur du code en 24 h", "");
    const hotes = await reseau();
    const inconnus = hotes.filter((h) => !h.attendu);
    if (inconnus.length) add("reseau", "alerte", `Connexion du Noyau vers un site inattendu : ${inconnus[0].hote}`, "Le Noyau ne doit parler qu'à Google (Gemini) et aux sources de références.", "Ouvre Sécurité → Activité.");
    else add("reseau", "ok", "Connexions du Noyau conformes", hotes.length ? `${hotes.length} site(s) contacté(s), tous attendus.` : "Aucune connexion externe pour l'instant.");
    const b = await base();
    if (b.etat === "differe") {
      const n = await commitsDepuis(b.reference);          // null = GitHub injoignable ; 0 = aucune modification connue du dépôt
      if (n === 0) add("empreintes", "critique", `${b.differents.length} fichier(s) sensible(s) modifié(s) sans aucun commit sur le dépôt`, b.differents.slice(0, 3).join(", "), "Ce n'est pas une mise à jour normale. Vérifie le journal de sécurité GitHub ; si tu ne reconnais rien, change ton mot de passe GitHub et ta phrase secrète du hub.");
      else add("empreintes", "alerte", `${b.differents.length} fichier(s) du hub modifié(s) depuis ta dernière validation`, b.differents.slice(0, 3).join(", ") + (n ? ` · ${n} commit(s) sur le dépôt depuis ta référence` : ""), "Si c'est une mise à jour que tu as faite, accepte l'état actuel (Sécurité → Activité). Sinon, vérifie l'activité GitHub.");
    }
    else if (b.etat === "sans-reference") add("empreintes", "info", "Aucune empreinte de référence enregistrée", "Elle permet de repérer toute modification du code que tu n'as pas faite.", "Sécurité → Activité → Enregistrer la référence.");
    else if (b.etat === "ok") add("empreintes", "ok", "Fichiers du hub conformes à la référence", `${FICHIERS_SENSIBLES.length} fichiers sensibles contrôlés.`);
    dernier = { quand: hote.maintenant().toISOString(), controles: c };
    return c;
  }
  async function veille() { const c = await controles(); const pire = c.reduce((m, x) => Math.max(m, NIVEAUX[x.niveau]), 0); ecouteurs.forEach((f) => { try { f({ type: "veille", pire, controles: c }); } catch (e) { /* ignoré */ } }); return c; }

  // ---------- Connexions sortantes du Noyau ----------
  const ATTENDUS = /(^|\.)(googleapis\.com|wikipedia\.org|wiktionary\.org|wikivoyage\.org|wikibooks\.org|wikidata\.org|openalex\.org|crossref\.org|ebi\.ac\.uk|doaj\.org|zenodo\.org|openfoodfacts\.org|themealdb\.com|openlibrary\.org|gutendex\.com|archive\.org|stackexchange\.com|github\.com|npmjs\.org|dblp\.org|mozilla\.org|algolia\.com|spaceflightnewsapi\.net|thespacedevs\.com|nasa\.gov|gbif\.org|inaturalist\.org|ncbi\.nlm\.nih\.gov|data\.gouv\.fr|openstreetmap\.org|open-meteo\.com|jsdelivr\.net)$/;
  async function reseau() {
    const l = hote.reseauJournal ? hote.reseauJournal() : [];
    const par = new Map(); for (const x of l) { const p = par.get(x.hote) || { hote: x.hote, n: 0, dernier: x.quand, attendu: ATTENDUS.test(x.hote) }; p.n++; p.dernier = x.quand; par.set(x.hote, p); }
    return [...par.values()].sort((a, b) => b.n - a.n);
  }

  // ---------- Empreintes des fichiers ----------
  const sha = async (txt) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  async function empreintes() {
    const out = {};
    await Promise.all(FICHIERS_SENSIBLES.map(async (f) => { try { const r = await hote.fetch(new URL(f, racine()).href, { cache: "no-store" }); out[f] = r.ok ? (await sha(await r.text())).slice(0, 16) : "absent"; } catch (e) { out[f] = "illisible"; } }));
    return out;
  }
  async function base() {
    try {
      const ref = await lieu("noyau-secu-base"); if (!ref || !ref.h) return { etat: "sans-reference", differents: [] };
      const now = await empreintes(), diff = FICHIERS_SENSIBLES.filter((f) => now[f] !== ref.h[f] && now[f] !== "illisible");
      if (Object.values(now).every((v) => v === "illisible")) return { etat: "indisponible", differents: [] };
      return { etat: diff.length ? "differe" : "ok", differents: diff, reference: ref.date, maintenant: now, ancien: ref.h };
    } catch (e) { return { etat: "indisponible", differents: [] }; }
  }
  async function accepterReference() { const h = await empreintes(); await hote.stockage.ecrire("kv", { id: "noyau-secu-base", date: hote.maintenant().toISOString(), h }); await noter("reference", "empreintes enregistrées"); return h; }

  // ---------- Activité du dépôt GitHub ----------
  let cacheCommits = { ref: "", t: 0, n: null };
  /** Nombre de commits du dépôt depuis la date de référence (null si GitHub injoignable). Mis en cache 30 min : GitHub limite les appels sans compte. */
  async function commitsDepuis(ref) {
    const t = hote.maintenant().getTime(); if (cacheCommits.ref === ref && t - cacheCommits.t < 30 * 6e4) return cacheCommits.n;
    let n = null; try { const r = await hote.fetch(`https://api.github.com/repos/${DEPOT}/commits?since=${encodeURIComponent(ref)}&per_page=5`, { headers: { Accept: "application/vnd.github+json" } }); if (r.ok) n = (await r.json()).length; } catch (e) { n = null; }
    cacheCommits = { ref, t, n }; return n;
  }
  async function activiteDepot() {
    const r = await hote.fetch(`https://api.github.com/repos/${DEPOT}/commits?per_page=12`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(r.status === 403 ? "Limite de requêtes GitHub atteinte, réessaie dans une heure." : "GitHub répond " + r.status);
    const l = (await r.json()).map((c) => ({ sha: c.sha.slice(0, 7), quand: c.commit.author.date, auteur: (c.author && c.author.login) || c.commit.author.name, message: coupe(c.commit.message.split("\n")[0], 90) }));
    const vu = (await lieu("noyau-secu-vu")) || { auteurs: [], sha: "" };
    const nouveaux = []; for (const x of l) { if (x.sha === vu.sha) break; nouveaux.push(x); }
    const inconnus = [...new Set(l.filter((x) => vu.auteurs.length && !vu.auteurs.includes(x.auteur)).map((x) => x.auteur))];
    return { commits: l, nouveaux, auteursNouveaux: inconnus, premiereVisite: !vu.sha };
  }
  async function marquerVu(act) { await hote.stockage.ecrire("kv", { id: "noyau-secu-vu", sha: act.commits[0] ? act.commits[0].sha : "", auteurs: [...new Set([...(((await lieu("noyau-secu-vu")) || {}).auteurs || []), ...act.commits.map((x) => x.auteur)])] }); }

  // ---------- Audit du code ----------
  async function texteDe(chemin) { const r = await hote.fetch(new URL(chemin, racine()).href, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }
  const REGLES = [
    [/\beval\s*\(/, "haute", "Appel à eval()", "Exécute du texte comme du code : à éviter."],
    [/\bnew Function\s*\(/, "moyenne", "Construction de code avec new Function", "Même risque qu'eval ; acceptable seulement si le texte est contrôlé."],
    [/document\.write\s*\(/, "moyenne", "document.write()", "Obsolète et fragile."],
    [/\bdebugger\b/, "faible", "Instruction debugger oubliée", ""],
    [/console\.log\(/, "faible", "console.log oublié", "Bruit dans la console ; à retirer en version finale."],
    [/["'`]http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/, "moyenne", "Adresse en http:// (non chiffrée)", "Un contenu en http peut être bloqué ou modifié en route."],
    [/\.innerHTML\s*=\s*[^;]*(\$\{|\+\s*[a-z_]+\b)/i, "moyenne", "innerHTML construit avec une variable", "Risque d'injection si la variable vient de l'extérieur."],
    [/(TODO|FIXME|XXX)\b/, "faible", "Reste à faire dans le code", ""]
  ];
  async function auditCode({ surProgres = () => {} } = {}) {
    const trouvailles = []; const add = (f) => trouvailles.push({ id: "f" + (trouvailles.length + 1), ...f });
    let html = ""; try { html = await texteDe("index.html"); } catch (e) { return { trouvailles: [], erreur: "index.html illisible (" + e.message + "). Ouvre le hub depuis son adresse GitHub Pages." }; }
    const doc = new DOMParser().parseFromString(html, "text/html"), ids = {};
    doc.querySelectorAll("[id]").forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
    Object.entries(ids).filter(([, n]) => n > 1).forEach(([id, n]) => add({ fichier: "index.html", ligne: 0, gravite: "haute", titre: `Identifiant en double : #${id} (${n} fois)`, extrait: "id=\"" + id + "\"" }));
    doc.querySelectorAll("img:not([alt])").forEach((e) => add({ fichier: "index.html", ligne: 0, gravite: "faible", titre: "Image sans texte alternatif", extrait: coupe(e.outerHTML, 140) }));
    doc.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])').forEach((e) => add({ fichier: "index.html", ligne: 0, gravite: "moyenne", titre: "Lien externe sans rel=noopener", extrait: coupe(e.outerHTML, 140) }));
    doc.querySelectorAll("button").forEach((e) => { if (!e.textContent.trim() && !e.getAttribute("aria-label") && !e.getAttribute("title")) add({ fichier: "index.html", ligne: 0, gravite: "faible", titre: "Bouton sans nom accessible", extrait: coupe(e.outerHTML, 140) }); });
    let sw = ""; try { sw = await texteDe("sw.js"); } catch (e) { /* ignoré */ }
    const liste = [...new Set([...sw.matchAll(/"([^"]+\.(?:js|css|html))"/g)].map((m) => m[1]))].filter((p) => !/^https?:/.test(p) && !p.startsWith("vendor/")).slice(0, 120);
    let n = 0;
    for (const f of liste) {
      surProgres(++n, liste.length, f); let t;
      try { t = await texteDe(f); } catch (e) { add({ fichier: f, ligne: 0, gravite: "haute", titre: "Fichier du cache hors ligne introuvable", extrait: f + " : " + e.message }); continue; }
      if (!f.endsWith(".js") || /vendor\//.test(f)) continue;
      const lignes = t.split("\n");
      const regles = f.endsWith("noyau/sentinelle.js") ? [] : REGLES;     // ce fichier contient les motifs eux-mêmes
      lignes.forEach((l, i) => { if (/^\s*(\/\/|\*)/.test(l)) return; for (const [re, g, titre, why] of regles) if (re.test(l)) add({ fichier: f, ligne: i + 1, gravite: g, titre, extrait: coupe(l.trim(), 160), pourquoi: why }); });
      for (const m of t.matchAll(/getElementById\("([^"]+)"\)/g)) if (!ids[m[1]] && !t.includes(`.id = "${m[1]}"`) && !t.includes(`id="${m[1]}"`) && !t.includes(`id=\\"${m[1]}\\"`)) add({ fichier: f, ligne: t.slice(0, m.index).split("\n").length, gravite: "faible", titre: `Élément #${m[1]} cherché mais absent de index.html`, extrait: m[0], pourquoi: "Peut être créé plus tard par le code : à vérifier." });
    }
    const ordre = { haute: 0, moyenne: 1, faible: 2 };
    trouvailles.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
    const erreurs = await journal({ limite: 40, type: "erreur_js" });
    erreurs.forEach((e) => add({ fichier: "(à l'exécution)", ligne: 0, gravite: "moyenne", titre: "Erreur du code en marche", extrait: e.detail, quand: e.quand }));
    return { trouvailles, fichiers: liste.length + 1 };
  }

  const PROMPT_ANALYSE = `Tu es un relecteur de code web prudent (JavaScript sans framework, page statique PWA). On te montre un défaut détecté automatiquement. Réponds en français, en deux parties exactes :
1) EXPLICATION : 2 à 4 phrases. Dis d'abord si c'est un vrai défaut ou un faux positif, et pourquoi.
2) CORRECTIF : si c'est un vrai défaut, un correctif MINIMAL au format diff (lignes - et +, quelques lignes de contexte), sans réécrire le reste. Sinon écris « Aucun correctif nécessaire ».
N'invente pas de code que tu ne vois pas. Si le contexte fourni ne suffit pas, dis-le.`;
  async function analyser(f) {
    if (!demander) throw new Error("Analyse indisponible : aucun moteur branché.");
    let contexte = ""; if (f.fichier && !f.fichier.startsWith("(")) { try { const l = (await texteDe(f.fichier)).split("\n"), a = Math.max(0, (f.ligne || 1) - 16); contexte = l.slice(a, a + 32).map((x, i) => `${a + i + 1}: ${x}`).join("\n"); } catch (e) { contexte = ""; } }
    return demander(PROMPT_ANALYSE, `Fichier : ${f.fichier}${f.ligne ? " ligne " + f.ligne : ""}\nDéfaut : ${f.titre}\nExtrait : ${f.extrait}\n${f.pourquoi ? "Remarque : " + f.pourquoi + "\n" : ""}${contexte ? "Contexte :\n" + contexte : ""}`);
  }
  async function validerCorrectif(f, texte) { await garder("noyau-secu-correctifs", (d) => { d.liste = d.liste || []; d.liste.push({ id: "c" + Date.now(), quand: hote.maintenant().toISOString(), fichier: f.fichier, ligne: f.ligne, titre: f.titre, texte: String(texte).slice(0, 4000), statut: "valide" }); }, { liste: [] }); await noter("correctif_valide", f.titre); }
  async function correctifs() { const d = await lieu("noyau-secu-correctifs"); return (d && d.liste) || []; }
  async function marquerApplique(id) { await garder("noyau-secu-correctifs", (d) => { const c = (d.liste || []).find((x) => x.id === id); if (c) c.statut = "applique"; }, { liste: [] }); }
  async function demandeDeCorrection() {
    const l = (await correctifs()).filter((c) => c.statut === "valide");
    if (!l.length) return "";
    return "Claude, voici des correctifs du hub que Lucien a VALIDÉS après analyse du Noyau. Applique-les sur la branche `noyau`, vérifie chacun contre le code réel (le Noyau ne voit qu'un extrait), teste, puis dis-moi ce que tu as fait.\n\n" + l.map((c, i) => `### ${i + 1}. ${c.titre}\nFichier : ${c.fichier}${c.ligne ? " ligne " + c.ligne : ""}\n\n${c.texte}\n`).join("\n");
  }

  // ---------- Recommandation de l'orbe (toutes les 30 minutes) ----------
  async function recommandation() {
    const c = await controles(), vus = JSON.parse(hote.reglage.lire("noyau-reco-vus", "{}")), t = hote.maintenant().getTime();
    const frais = (id, h) => !vus[id] || t - vus[id] > h * 36e5;
    const cands = c.filter((x) => x.niveau === "critique" || x.niveau === "alerte" || x.niveau === "info").sort((a, b) => NIVEAUX[b.niveau] - NIVEAUX[a.niveau]);
    try { const taches = (await hote.stockage.tout("tasks")).filter((x) => !x.done && x.due && x.due < hote.maintenant().toISOString().slice(0, 10)); if (taches.length) cands.push({ id: "taches", niveau: "info", titre: `${taches.length} tâche(s) en retard`, detail: coupe(taches[0].text, 60), conseil: "Choisis-en une à finir maintenant, et reporte les autres." }); } catch (e) { /* ignoré */ }
    const choix = cands.find((x) => frais(x.id, x.niveau === "critique" ? 1 : 8));
    let id, texte, niveau = "info";
    if (choix) { id = choix.id; niveau = choix.niveau; texte = `${choix.titre}.${choix.detail ? " " + choix.detail : ""}${choix.conseil ? " " + choix.conseil : ""}`; }
    else { const i = (parseInt(hote.reglage.lire("noyau-reco-tip", "0"), 10) || 0) % CONSEILS.length; hote.reglage.ecrire("noyau-reco-tip", String(i + 1)); id = CONSEILS[i][1]; texte = "Tout est en ordre côté système. Astuce : " + CONSEILS[i][0]; niveau = "ok"; }
    vus[id] = t; hote.reglage.ecrire("noyau-reco-vus", JSON.stringify(vus));
    return { id, texte, niveau };
  }

  return { noter, journal, surveiller, controles, veille, reseau, empreintes, base, accepterReference, activiteDepot, marquerVu, auditCode, analyser, validerCorrectif, correctifs, marquerApplique, demandeDeCorrection, recommandation, surMessage: (f) => { ecouteurs.add(f); return () => ecouteurs.delete(f); }, dernier: () => dernier, FICHIERS_SENSIBLES, DEPOT };
}
