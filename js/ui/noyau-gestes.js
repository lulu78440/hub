// Refonte 6 (7.43.0) · panneau « Modules, espaces et workflows » de la fenêtre du Noyau : les gestes de Lucien des lots 5, 8 et 9, branchés à de vrais boutons.
// Monté par js/ui/noyau-controles.js (import dynamique). Ouvert par le bouton « Modules » de la fenêtre, ou par la palette (Outils / Ctrl+K) : événement « noyau:vue » { vue: "gestes" }.
//
// RÈGLE : chaque geste ne part que d'un VRAI clic ou d'une vraie touche de Lucien (event.isTrusted === true). Un clic simulé par du code, donc par le Noyau, est refusé et dit.
//  - Les fonctions viennent de js/noyau/modules/gestes-lucien.js (via hote.ui.orchestrateur.gestes()) et de workflows.js (rejouer) : aucune n'est contournée, aucune n'est gardée
//    hors de ce module (ni sur window, ni dans l'API de la fenêtre, ni dans un outil).
//  - Supprimer un module : confirmation écrite dans le panneau, sauvegarde faite AVANT par retirerModule (corbeille), possibilité d'annuler juste après.
//  - Workflows et modèles : après le formulaire, une validation montre les étapes, leur niveau et le budget annoncé ; sans clic sur « Lancer le plan », rien ne part.
//    Les étapes à confirmation redemandent l'accord de Lucien (fenêtre du Noyau), une par une. Aucune requête au modèle, aucune clé.
//  - Aucun script en ligne, aucun eval : du DOM construit par h().
import { hote } from "../noyau/hote.js";
import { ouvrirSignal, fermerSignal } from "../noyau/annulation.js";

const MSG = (e) => String((e && e.message) || e).slice(0, 300);
const DATE = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return String(iso || ""); } };
const JOUR = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR"); } catch (e) { return String(iso || ""); } };
const VUES = { courbe: "courbe", barres: "barres", tableau: "tableau", chiffre_cle: "chiffre clé" };
const NIVEAUX = { LIBRE: "accès libre", CONFIRMATION: "accord demandé", INTERDIT: "interdit" };
const slug = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
let validation = null;          // résolveur de la validation de lancement en cours (une seule à la fois)

export function monterGestes({ racine, api, h }) {
  if (!racine || racine.__gestes) return null;
  racine.__gestes = true;
  let panneau = null, enCours = false;

  const orch = () => { const o = hote.ui && hote.ui.orchestrateur; if (!o) throw new Error("Orchestrateur non chargé : ouvre le Noyau et réessaie."); return o; };

  // ---------- Construction du panneau ----------
  function construire() {
    const etat = h("p", { class: "ng-etat", role: "status", "aria-live": "polite" });
    const annuler = h("div", { class: "ng-annuler" });
    const sect = (id, titre, aide) => { const s = h("section", { class: "ng-sect", "aria-labelledby": "ng-t-" + id }, h("h4", { id: "ng-t-" + id, class: "ng-titre" }, titre)); if (aide) s.append(h("p", { class: "ng-aide" }, aide)); return s; };
    const sSession = sect("session", "Reprendre", "Remet en mémoire les données de ton dernier plan depuis le cache de cet appareil. Aucun appel réseau.");
    const sModules = sect("modules", "Modules enregistrés");
    const sEspaces = sect("espaces", "Espaces de travail", "Un espace rouvre ensemble plusieurs modules (10 espaces au plus, 12 modules chacun).");
    const sFlux = sect("flux", "Workflows et modèles de plan", "Rien ne part sans ta validation du budget annoncé. Les étapes à accord te le redemandent une par une.");
    const fermer = h("button", { class: "nx-btn ng-btn", type: "button", "aria-label": "Fermer le panneau Modules, espaces et workflows", onclick: () => { const a = el.closest(".nx-m"); if (validation) { validation(false); validation = null; } if (a) a.remove(); } }, "Fermer");
    const el = h("section", { class: "ng", role: "region", "aria-label": "Modules, espaces de travail et workflows" },
      h("div", { class: "ng-tete" }, h("h3", { class: "ng-h" }, "Modules, espaces et workflows"), fermer),
      h("p", { class: "ng-aide" }, "Chaque bouton agit seulement quand c'est toi qui cliques ou qui appuies sur une touche : le Noyau ne peut pas les déclencher."),
      etat, annuler, sSession, sModules, sEspaces, sFlux);
    return { el, etat, annuler, sSession, sModules, sEspaces, sFlux };
  }

  const echanger = (s, corps) => { s.querySelectorAll(".ng-corps").forEach((x) => x.remove()); s.append(corps); };
  const dire = (t) => { if (panneau) panneau.etat.textContent = t; };

  /** Enveloppe d'un geste : refuse tout ce qui ne vient pas de Lucien, évite le double clic, dit l'échec en clair. */
  const geste = (fn, { occupe = true } = {}) => async (e) => {
    if (!e || e.isTrusted !== true) { dire("Geste refusé : il ne part que d'un vrai clic ou d'une vraie touche de Lucien."); return; }
    const b = e.currentTarget; if (occupe && b && b.disabled) return;
    if (occupe && b) b.disabled = true;
    try { await fn(e); } catch (err) { dire("Échec : " + MSG(err)); }
    finally { if (occupe && b && b.isConnected) b.disabled = false; }
  };
  const bouton = (texte, aria, fn, extra = {}) => h("button", { class: "nx-btn ng-btn" + (extra.primaire ? " nx-primaire" : "") + (extra.danger ? " ng-danger" : ""), type: "button", "aria-label": aria || null, "aria-expanded": extra.expanded ?? null, disabled: extra.disabled || null, onclick: geste(fn, { occupe: extra.occupe !== false }) }, texte);

  let gestesCache = null;
  const gestes = async () => gestesCache || (gestesCache = await orch().gestes());
  const compo = () => orch().composants();

  // ---------- Affichage d'un module dans l'échange (lecture) ----------
  async function afficherModule(id) {
    const c = await compo(), m = await c.modules.lire(id);
    const vues = (m.vues && m.vues.length ? m.vues : [{ type: m.vue, options: m.options || {} }]);
    let n = 0;
    for (const v of vues) {
      const options = c.M.optionsParDefaut(v.type, m.jeu, v.options || {});
      const el = api.afficherComposant(v.type, m.jeu, { ...options, titre: v.titre || m.titre });
      if (el && el.classList && el.classList.contains("nxc-refus")) throw new Error(el.getAttribute("data-raison") || "Affichage refusé.");
      n++;
    }
    return n;
  }

  // ---------- Reprise ----------
  async function rendreSession() {
    const s = panneau.sSession;
    const c = await compo(), der = await c.sessions.derniere();
    const corps = h("div", { class: "ng-corps" });
    if (!der) corps.append(h("p", { class: "ng-vide" }, "Aucune session gardée pour l'instant : une session est notée après un plan qui a lu des données (ou coupée dans les réglages)."));
    else {
      corps.append(h("p", { class: "ng-ligne-texte" }, h("strong", {}, der.libelle), ` · ${DATE(der.date)} · ${der.etapes} étape(s)` + (der.reussies != null ? `, ${der.reussies} réussie(s)` : "") + ` · ${der.jeux} jeu(x) de données` + (der.vue ? ` · vue : ${VUES[der.vue] || der.vue}` : "")));
      corps.append(bouton("Reprendre la dernière session", `Reprendre la dernière session : ${der.libelle}`, async () => {
        const r = await c.sessions.reprendre(der.id), notes = [];
        let ouvert = false;
        if (r.vue && r.vue.module) { try { await afficherModule(r.vue.module); ouvert = true; } catch (e) { notes.push(`module « ${r.vue.module} » : ${MSG(e)}`); } }
        else if (r.vue && r.vue.jeu) {
          try { const j = await orch().lireJeu(r.vue.jeu), opts = c.M.optionsParDefaut(r.vue.type, j, r.vue.options || {}); api.afficherComposant(r.vue.type, j, { ...opts, titre: r.vue.titre || j.titre || undefined }); ouvert = true; } catch (e) { notes.push(MSG(e)); }
        }
        const perimes = r.jeux.filter((j) => j.perime);
        let t = `Session reprise : ${r.jeux.length} jeu(x) remis en mémoire depuis le cache de cet appareil (aucun appel réseau)` + (ouvert ? ", vue réaffichée" : "") + ".";
        if (perimes.length) t += ` Périmé : ${perimes.map((j) => `« ${j.titre} » (${Math.round(j.age_h)} h)`).join(", ")}.`;
        if (r.manquants.length) t += ` Manquant dans le cache : ${r.manquants.map((m) => `« ${m.titre} » — ${m.comment}`).join(" ; ")}.`;
        if (notes.length) t += " " + notes.join(" ");
        dire(t);
      }, { primaire: true }));
    }
    echanger(s, corps);
  }

  // ---------- Modules ----------
  const retourAnnuler = (texte, ariaBouton, fn) => {
    const z = panneau.annuler; z.textContent = "";
    z.append(h("span", { class: "ng-annuler-t" }, texte), bouton("Annuler", ariaBouton, async () => { await fn(); z.textContent = ""; await tout({ session: false, flux: false }); }, { primaire: true }));
  };

  async function rendreModules() {
    const s = panneau.sModules;
    const c = await compo(), liste = await c.modules.lister();
    const corps = h("div", { class: "ng-corps" });
    if (!liste.length) corps.append(h("p", { class: "ng-vide" }, "Aucun module enregistré. Demande au Noyau de tracer une série, puis accepte son enregistrement."));
    const ul = h("ul", { class: "ng-liste" });
    for (const m of liste) ul.append(ligneModule(m, c));
    if (liste.length) corps.append(ul);
    echanger(s, corps);
    return liste;
  }

  function ligneModule(m, c) {
    const zone = h("div", { class: "ng-zone" }), versBtn = bouton("Versions", `Versions du module « ${m.titre} »`, async () => { const ouvert = versBtn.getAttribute("aria-expanded") === "true"; zone.textContent = ""; if (ouvert) { versBtn.setAttribute("aria-expanded", "false"); return; } await montrerVersions(m, c, zone); versBtn.setAttribute("aria-expanded", "true"); }, { expanded: "false" });
    const li = h("li", { class: "ng-ligne" },
      h("div", { class: "ng-info" }, h("strong", { class: "ng-nom" }, m.titre), h("span", { class: "ng-meta" }, `${VUES[m.vue] || m.vue} · ${m.source} · ${m.periode} · données du ${m.donnees_du} · version ${m.version}` + (m.versions > 1 ? ` (${m.versions} gardées)` : "")), m.ancien_format ? h("span", { class: "ng-etiq" }, "ancien format") : null, m.exemple ? h("span", { class: "ng-etiq" }, "EXEMPLE") : null),
      h("div", { class: "ng-boutons" },
        bouton("Ouvrir", `Ouvrir le module « ${m.titre} » dans l'échange`, async () => { const n = await afficherModule(m.id); dire(`Module « ${m.titre} » affiché (${n} vue${n > 1 ? "s" : ""}), sous ce panneau.`); }),
        versBtn,
        bouton("Exporter", `Exporter le module « ${m.titre} » en fichier JSON`, async () => {
          const g = await gestes(), obj = await g.exporterModule(m.id), nom = `hub-module-${m.id}-${new Date().toISOString().slice(0, 10)}.json`;
          const u = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })), a = h("a", { href: u, download: nom, hidden: true });
          document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
          dire(`Export prêt : ${nom} (spécification, versions et copies de données, sources comprises).`);
        }),
        bouton("Supprimer", `Supprimer le module « ${m.titre} »`, async () => confirmerSuppression(li, m), { danger: true, occupe: false })),
      zone);
    return li;
  }

  async function montrerVersions(m, c, zone) {
    const vs = await c.modules.versions(m.id), ul = h("ul", { class: "ng-liste ng-sous", "aria-label": `Versions de « ${m.titre} »` });
    for (const v of [...vs].reverse()) {
      const gardees = v.donnees_gardees !== false, ligne = h("li", { class: "ng-ligne ng-version" },
        h("div", { class: "ng-info" }, h("strong", {}, `Version ${v.n}${v.courante ? " (en cours)" : ""}`), h("span", { class: "ng-meta" }, `${v.date ? JOUR(v.date) + " · " : ""}${v.titre || ""} · ${gardees ? "données gardées" : "données non gardées (seules les deux dernières versions les gardent)"}`)));
      if (!v.courante) ligne.append(h("div", { class: "ng-boutons" }, bouton("Restaurer", `Restaurer la version ${v.n} du module « ${m.titre} » (crée une nouvelle version)`, async () => {
        const g = await gestes(), r = await g.restaurerVersion(m.id, v.n);
        dire(`Version ${v.n} restaurée : le module « ${m.titre} » est maintenant en version ${r.version} (rien n'est perdu).`); await tout({ session: false, flux: false });
      }, { disabled: !gardees })));
      ul.append(ligne);
    }
    zone.append(ul);
  }

  function confirmerSuppression(li, m) {
    const zone = li.querySelector(".ng-zone"); zone.textContent = "";
    const non = bouton("Garder le module", `Ne pas supprimer le module « ${m.titre} »`, async () => { zone.textContent = ""; }, { occupe: false });
    const oui = bouton("Confirmer la suppression", `Confirmer la suppression du module « ${m.titre} »`, async () => {
      const g = await gestes(), r = await g.retirerModule(m.id);
      dire(`Module « ${m.titre} » retiré. Une sauvegarde complète a été faite avant (${r.sauvegarde}).`);
      retourAnnuler(`« ${m.titre} » est retiré, sauvegarde faite.`, `Annuler la suppression de « ${m.titre} » et le remettre`, async () => { await g.restaurerCorbeille(m.id); dire(`Module « ${m.titre} » remis.`); });
      await tout({ session: false, flux: false });
    }, { danger: true });
    zone.append(h("div", { class: "ng-confirme", role: "group", "aria-label": `Confirmer la suppression de « ${m.titre} »` },
      h("p", {}, h("strong", {}, "Supprimer « " + m.titre + " » ?"), " Une sauvegarde complète (toutes les versions) est faite avant, et tu peux annuler juste après."), h("div", { class: "ng-boutons" }, oui, non)));
    non.focus();
  }

  // ---------- Espaces ----------
  async function rendreEspaces(modules) {
    const s = panneau.sEspaces;
    const c = await compo(), liste = await c.espaces.lister(), titres = new Map(modules.map((m) => [m.id, m.titre]));
    const corps = h("div", { class: "ng-corps" });
    if (!liste.length) corps.append(h("p", { class: "ng-vide" }, "Aucun espace de travail."));
    const ul = h("ul", { class: "ng-liste" });
    for (const e of liste) {
      const zone = h("div", { class: "ng-zone" });
      ul.append(h("li", { class: "ng-ligne" },
        h("div", { class: "ng-info" }, h("strong", { class: "ng-nom" }, e.titre), h("span", { class: "ng-meta" }, e.modules.map((id) => titres.get(id) || id + " (introuvable)").join(" · ")), e.note ? h("span", { class: "ng-meta" }, e.note) : null),
        h("div", { class: "ng-boutons" },
          bouton("Ouvrir", `Ouvrir l'espace « ${e.titre} » (${e.modules.length} module${e.modules.length > 1 ? "s" : ""})`, async () => {
            let n = 0; const rates = [];
            for (const id of e.modules) { try { await afficherModule(id); n++; } catch (err) { rates.push(`« ${titres.get(id) || id} » : ${MSG(err)}`); } }
            dire(`Espace « ${e.titre} » : ${n} module(s) affiché(s) sous ce panneau.` + (rates.length ? " Impossible d'afficher " + rates.join(" ; ") + "." : ""));
          }, { primaire: true }),
          bouton("Retirer", `Retirer l'espace « ${e.titre} »`, async () => {
            zone.textContent = "";
            const non = bouton("Garder l'espace", `Ne pas retirer l'espace « ${e.titre} »`, async () => { zone.textContent = ""; }, { occupe: false });
            zone.append(h("div", { class: "ng-confirme", role: "group", "aria-label": `Confirmer le retrait de l'espace « ${e.titre} »` }, h("p", {}, h("strong", {}, `Retirer l'espace « ${e.titre} » ?`), " Les modules restent ; une sauvegarde de l'espace est faite avant."),
              h("div", { class: "ng-boutons" }, bouton("Confirmer le retrait", `Confirmer le retrait de l'espace « ${e.titre} »`, async () => { const g = await gestes(); await g.retirerEspace(e.id); dire(`Espace « ${e.titre} » retiré (sauvegarde gardée). Les modules n'ont pas bougé.`); await tout({ session: false, flux: false }); }, { danger: true }), non)));
            non.focus();
          }, { danger: true, occupe: false })),
        zone));
    }
    if (liste.length) corps.append(ul);
    corps.append(formEspace(modules));
    echanger(s, corps);
  }

  function formEspace(modules) {
    const titre = h("input", { class: "nx-champ ng-champ", id: "ng-esp-titre", type: "text", maxlength: "60", autocomplete: "off" }), note = h("input", { class: "nx-champ ng-champ", id: "ng-esp-note", type: "text", maxlength: "200", autocomplete: "off" });
    const coches = modules.map((m) => ({ m, c: h("input", { type: "checkbox", id: "ng-esp-m-" + m.id, value: m.id }) }));
    const creer = async (e) => {
      const choisis = coches.filter((x) => x.c.checked).map((x) => x.m.id);
      const g = await gestes(), r = await g.enregistrerEspace({ id: slug(titre.value), titre: titre.value, modules: choisis, note: note.value });
      dire(`Espace « ${titre.value.trim()} » créé (${choisis.length} module${choisis.length > 1 ? "s" : ""}).`); await tout({ session: false, flux: false }); return r;
    };
    const b = bouton("Créer l'espace", "Créer l'espace de travail avec le titre et les modules cochés", creer, { primaire: true, disabled: !modules.length });
    const clavier = geste(creer, { occupe: false }), enter = (ev) => { if (ev.key === "Enter" && !b.disabled) { ev.preventDefault(); clavier(ev); } };
    titre.addEventListener("keydown", enter); note.addEventListener("keydown", enter);
    return h("fieldset", { class: "ng-form" }, h("legend", {}, "Créer un espace"),
      modules.length ? null : h("p", { class: "ng-vide" }, "Il faut au moins un module enregistré."),
      h("label", { for: "ng-esp-titre", class: "ng-label" }, "Titre (60 signes au plus)"), titre,
      h("fieldset", { class: "ng-coches" }, h("legend", {}, "Modules de l'espace (de 1 à 12)"), ...coches.map((x) => h("div", { class: "ng-coche" }, x.c, h("label", { for: x.c.id }, x.m.titre)))),
      h("label", { for: "ng-esp-note", class: "ng-label" }, "Note (facultative)"), note, h("div", { class: "ng-boutons" }, b));
  }

  // ---------- Workflows et modèles ----------
  async function rendreFlux() {
    const s = panneau.sFlux;
    const W = await orch().workflows(), l = await W.lister(), corps = h("div", { class: "ng-corps" });
    const defs = async (id, modele) => { if (modele) return modele.parametres || []; const M = await import("../noyau/workflows.js"); return (await M.creerWorkflows({ stockage: hote.stockage }).lire(id)).parametres; };
    const bloc = (titre, items, estModele) => {
      const ul = h("ul", { class: "ng-liste", "aria-label": titre });
      for (const it of items) {
        const zone = h("div", { class: "ng-zone" });
        const lancerB = bouton("Lancer…", `Lancer ${estModele ? "le modèle" : "le workflow"} « ${it.nom} »`, async () => {
          const ouvert = lancerB.getAttribute("aria-expanded") === "true"; zone.textContent = "";
          if (ouvert) { lancerB.setAttribute("aria-expanded", "false"); return; }
          lancerB.setAttribute("aria-expanded", "true");
          zone.append(formLancement(it, await defs(it.id, estModele ? it : null), W, zone, lancerB));
          const prem = zone.querySelector("input, select, button"); if (prem) prem.focus();
        }, { expanded: "false", primaire: true, occupe: false });
        const detail = estModele ? it.pourquoi : `${it.etapes} étape(s)` + (it.parametres.length ? ` · à remplir : ${it.parametres.join(", ")}` : "") + ` · lancé ${it.lancements} fois` + (it.dernier_lancement ? `, dernier le ${JOUR(it.dernier_lancement)}` : "");
        ul.append(h("li", { class: "ng-ligne" }, h("div", { class: "ng-info" }, h("strong", { class: "ng-nom" }, it.nom), h("span", { class: "ng-meta" }, detail)), h("div", { class: "ng-boutons" }, lancerB), zone));
      }
      return h("div", {}, h("h5", { class: "ng-sous-titre" }, titre), items.length ? ul : h("p", { class: "ng-vide" }, estModele ? "Aucun modèle." : "Aucun workflow enregistré pour l'instant."));
    };
    corps.append(bloc("Workflows enregistrés", l.enregistres, false), bloc("Modèles de plan (sans IA)", l.modeles, true));
    echanger(s, corps);
  }

  function formLancement(it, params, W, zone, declencheur) {
    const champs = params.map((p) => {
      const id = `ng-p-${it.id}-${p.id}`;
      const ctl = p.type === "choix" ? h("select", { class: "nx-champ ng-champ", id }, ...p.choix.map((c) => h("option", { value: c }, c)))
        : h("input", { class: "nx-champ ng-champ", id, type: "text", inputmode: p.type === "nombre" ? "decimal" : null, autocomplete: "off", placeholder: p.exemple ? "ex. " + p.exemple : null, maxlength: "200" });
      return { p, ctl, bloc: h("div", { class: "ng-champ-bloc" }, h("label", { for: id, class: "ng-label" }, p.libelle), ctl) };
    });
    const sortie = h("div", { class: "ng-validation-zone" });
    const preparer = async () => {
      if (enCours || validation) { dire("Un lancement est déjà en cours : valide-le, refuse-le ou annule le plan."); return; }
      const valeurs = {}; for (const f of champs) valeurs[f.p.id] = f.ctl.value;
      await lancer(it, valeurs, W, sortie);
    };
    const prep = bouton("Voir les étapes et le budget", `Préparer le lancement de « ${it.nom} » : voir les étapes et le budget annoncé`, preparer, { primaire: true, occupe: false });
    const clavier = geste(preparer, { occupe: false }), enter = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); clavier(ev); } };
    for (const f of champs) f.ctl.addEventListener("keydown", enter);
    return h("div", { class: "ng-form", role: "group", "aria-label": `Lancement de « ${it.nom} »` }, champs.length ? champs.map((f) => f.bloc) : h("p", { class: "ng-aide" }, "Aucun paramètre à remplir."), h("div", { class: "ng-boutons" }, prep), sortie);
  }

  /** Fenêtre de validation : étapes, niveaux et budget annoncé. Rend vrai SEULEMENT sur un vrai clic de Lucien sur « Lancer le plan ». */
  function valider(info, sortie) {
    sortie.textContent = "";
    const b = info.budget;
    return new Promise((resolve) => {
      const fin = (v) => { validation = null; boite.remove(); resolve(v); };
      const lancerB = h("button", { class: "nx-btn ng-btn nx-primaire", type: "button", onclick: (e) => { if (!e.isTrusted) { dire("Lancement refusé : il ne part que de ton clic."); return; } fin(true); } }, "Lancer le plan");
      const refuser = h("button", { class: "nx-btn ng-btn", type: "button", onclick: (e) => { if (!e.isTrusted) return; dire("Lancement refusé : rien n'est parti."); fin(false); } }, "Refuser");
      const ol = h("ol", { class: "ng-etapes" }, ...info.etapes.map((e) => h("li", {}, h("strong", {}, e.outil), ` — ${NIVEAUX[e.niveau] || e.niveau}${e.niveau === "CONFIRMATION" ? " (ton accord sera redemandé)" : ""} — réseau : ${e.reseau ? "oui" : "non"}`, h("span", { class: "ng-meta" }, " " + Object.entries(e.params || {}).map(([k, v]) => `${k} : ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ; ").slice(0, 160)))));
      const boite = h("div", { class: "ng-validation", role: "group", "aria-labelledby": "ng-val-t" },
        h("h5", { id: "ng-val-t", class: "ng-sous-titre" }, `Validation avant lancement : « ${info.nom} »`),
        h("p", { class: "ng-budget" }, h("strong", {}, "Budget annoncé : "), `${b.etapes} étape(s) · ${b.confirmations} accord(s) demandé(s) · ${b.appels_reseau} étape(s) avec appel réseau · ${b.requetes_modele} requête(s) au modèle.`),
        ol, h("p", { class: "ng-aide" }, "Tu peux annuler le plan en cours avec le bouton « Annuler le plan » de la fenêtre."), h("div", { class: "ng-boutons" }, lancerB, refuser));
      sortie.append(boite); validation = resolve; lancerB.focus();
    });
  }

  async function lancer(it, valeurs, W, sortie) {
    const idPlan = "gestes-" + it.id + "-" + Date.now().toString(36), ctl = new AbortController();
    enCours = true; panneau.el.setAttribute("aria-busy", "true");
    try {
      const r = await W.rejouer(it.id, valeurs, {
        signal: ctl.signal, origine: "lucien",
        annoncer: async (info) => { const ok = await valider(info, sortie); if (ok) { const sig = ouvrirSignal(idPlan); sig.addEventListener("abort", () => ctl.abort(), { once: true }); dire(`Plan « ${info.nom} » en cours…`); } return ok; }
      });
      if (!r.lance) { dire(`Rien n'est parti : ${r.raison}.`); return; }
      const bi = r.bilan || {};
      dire(`Plan terminé : ${bi.reussies ?? 0} étape(s) réussie(s), ${bi.en_echec ?? 0} en échec, ${bi.refusees ?? 0} refusée(s), ${bi.non_executees ?? 0} non exécutée(s)` + (ctl.signal.aborted ? " (annulé)" : "") + ".");
      await rendreFlux();
    } catch (e) { dire("Lancement impossible : " + MSG(e)); sortie.textContent = ""; }
    finally { fermerSignal(idPlan); enCours = false; if (panneau && panneau.el) panneau.el.removeAttribute("aria-busy"); }
  }

  // ---------- Chargement ----------
  async function tout({ session = true, flux = true } = {}) {
    const essais = [];
    if (session) { try { await rendreSession(); } catch (e) { essais.push("reprise : " + MSG(e)); } }
    let modules = [];
    try { modules = await rendreModules(); } catch (e) { essais.push("modules : " + MSG(e)); }
    try { await rendreEspaces(modules); } catch (e) { essais.push("espaces : " + MSG(e)); }
    if (flux) { try { await rendreFlux(); } catch (e) { essais.push("workflows : " + MSG(e)); } }
    if (essais.length) dire("Lecture impossible — " + essais.join(" ; "));
  }

  async function ouvrir() {
    if (racine.dataset.vue !== "chat" && api.changerVue) api.changerVue("chat");
    if (validation) { validation(false); validation = null; }
    if (panneau && panneau.el.isConnected) { await tout(); panneau.el.scrollIntoView && panneau.el.scrollIntoView({ block: "start" }); const f = panneau.el.querySelector("button"); if (f) f.focus(); return; }
    await api.afficherVue(async () => { panneau = construire(); return panneau.el; });
    await tout();
    const t = panneau.el.querySelector(".ng-h"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); }
  }

  document.addEventListener("noyau:vue", (e) => {
    const d = e.detail; if (!d || d.vue !== "gestes") return;
    d.pris = true;
    document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: "noyau" }));
    const w = racine.closest && racine.closest(".win"); if (w) w.classList.remove("hid");
    ouvrir().catch((err) => { if (panneau) dire("Panneau indisponible : " + MSG(err)); });
  });
  return { ouvrir };
}
