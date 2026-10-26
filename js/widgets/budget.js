// Atelier · fenêtre « Budget » : relevé bancaire CSV importé sur l'appareil, enveloppes mensuelles, règles de classement.
// Moteurs : moteurs/bud-csv.js (lecture du relevé, règles) et moteurs/bud-enveloppes.js (calcul, report, bilan).
// Données (collection kv, donc chiffrées si le verrouillage est actif, exportées et synchronisées comme le reste) :
//   « budget-etat » = { enveloppes: [{ id, nom }], allocations: { "AAAA-MM": { idEnveloppe: centimes } }, regles: [règle] } ;
//   « budget-ops-AAAA-MM » = { operations: [{ id, date, libelle, montant (centimes), categorieManuelle? }] }.
// Le fichier du relevé n'est jamais envoyé nulle part ni gardé : seules les opérations lues sont enregistrées. Rien n'est retiré sans second geste.
import { store } from "../store/storage.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { dayKey } from "./when.js";
import { importerReleve, nouvelles, categoriser, suggererRegle } from "./moteurs/bud-csv.js";
import { calculerMois, allouer, reprendreMoisPrecedent, bilanTexte, euros, moisSuivant, moisPrecedent, nomMois } from "./moteurs/bud-enveloppes.js";
import { h, lireEuros, euroChamp, boutonDeuxTemps, garderFocus, poserStyle } from "./atelier-outils.js";

const ETAT = "budget-etat", OPS = "budget-ops-", MAX_OCTETS = 3 * 1024 * 1024, MAX_OPS = 20000, REVENUS = "Revenus";
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "env";
const etatVide = () => ({ id: ETAT, enveloppes: [], allocations: {}, regles: [] });

export function initBudget() {
  const win = document.querySelector('.win[data-id="budget"]'); if (!win) return {};
  poserStyle();
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag");
  let pf = win.querySelector(".pf");
  if (!pf) { pf = h("div", { class: "pf" }); win.querySelector(".in").append(pf); }
  pb.textContent = "";
  const racine = h("div", { class: "atl", role: "region", "aria-label": "Budget" });
  pb.append(racine);
  const fichier = h("input", { type: "file", accept: ".csv,.txt,text/csv,text/plain", hidden: true, "aria-label": "Choisir le relevé bancaire (CSV)" });
  win.append(fichier);

  let ecriture = 0, saisie = false, etat = etatVide(), ops = [], mois = dayKey().slice(0, 7), suggestion = null, statut = "", pret = false;

  /** Nos propres écritures préviennent déjà l'écran : on n'écoute que les changements venus d'ailleurs (autre onglet, synchro). */
  const ecrire = async (fn) => { ecriture++; try { await fn(); } finally { setTimeout(() => { ecriture--; }, 0); } };
  async function charger() {
    const tout = await store.all("kv");
    const e = tout.find((x) => x.id === ETAT);
    etat = e ? { ...etatVide(), ...e, enveloppes: Array.isArray(e.enveloppes) ? e.enveloppes : [], regles: Array.isArray(e.regles) ? e.regles : [], allocations: e.allocations && typeof e.allocations === "object" ? e.allocations : {} } : etatVide();
    ops = tout.filter((x) => typeof x.id === "string" && x.id.startsWith(OPS) && Array.isArray(x.operations)).flatMap((x) => x.operations);
    pret = true; if (!saisie) dessiner();
  }
  const sauverEtat = async () => { etat.id = ETAT; await ecrire(() => store.put("kv", etat)); };
  async function sauverOps(liste) {   // réécrit les mois touchés
    const parMois = {};
    for (const o of liste) (parMois[o.date.slice(0, 7)] = parMois[o.date.slice(0, 7)] || []).push(o);
    for (const [m, l] of Object.entries(parMois)) await ecrire(() => store.put("kv", { id: OPS + m, operations: l }));
  }
  const classees = () => categoriser(ops, etat.regles).operations;

  function calcul() {
    const cat = classees();
    return { cat, r: calculerMois({ enveloppes: etat.enveloppes, allocations: etat.allocations, revenus: [REVENUS] }, cat, mois) };
  }

  // ---------- Gestes ----------
  async function importer(f) {
    if (!f) return;
    if (f.size > MAX_OCTETS) { statut = "Fichier trop gros (3 Mo au plus). Exporte un relevé plus court."; dessiner(); return; }
    try {
      const lu = importerReleve(new Uint8Array(await f.arrayBuffer()));
      const nouv = nouvelles(ops, lu.operations);
      if (ops.length + nouv.length > MAX_OPS) { statut = "Trop d'opérations gardées (" + MAX_OPS + " au plus)."; dessiner(); return; }
      const a = nouv.map((o) => ({ id: o.id, date: o.date, libelle: o.libelle.slice(0, 200), montant: o.montant }));
      ops = ops.concat(a); await sauverOps(a);
      const dates = a.map((o) => o.date).sort();
      if (dates.length) mois = dates[dates.length - 1].slice(0, 7);
      const deja = lu.operations.length - nouv.length;
      statut = `${a.length} opération${a.length > 1 ? "s" : ""} ajoutée${a.length > 1 ? "s" : ""}` + (deja ? `, ${deja} déjà connue${deja > 1 ? "s" : ""}` : "") + (lu.ignorees.length ? `, ${lu.ignorees.length} ligne${lu.ignorees.length > 1 ? "s" : ""} ignorée${lu.ignorees.length > 1 ? "s" : ""} (${[...new Set(lu.ignorees.map((x) => x.raison))].join(", ")})` : "") + ".";
      toast("Relevé lu : " + statut);
    } catch (e) { statut = "Relevé illisible : " + (e && e.message ? e.message : e); }
    dessiner();
  }
  fichier.addEventListener("change", async () => { const f = fichier.files && fichier.files[0]; fichier.value = ""; await importer(f); });
  const choisirReleve = () => fichier.click();

  async function ajouterEnveloppe(nom) {
    nom = nom.trim().slice(0, 40); if (!nom) return;
    if (etat.enveloppes.some((e) => e.nom.toLowerCase() === nom.toLowerCase() || e.nom.toLowerCase() === REVENUS.toLowerCase())) { statut = "Une enveloppe porte déjà ce nom."; dessiner(); return; }
    let id = slug(nom), n = 2; while (etat.enveloppes.some((e) => e.id === id)) id = slug(nom) + "-" + n++;
    etat.enveloppes.push({ id, nom }); await sauverEtat(); statut = "Enveloppe « " + nom + " » ajoutée."; dessiner();
  }
  async function retirerEnveloppe(id) {   // les opérations restent : elles repassent « à classer »
    const e = etat.enveloppes.find((x) => x.id === id); if (!e) return;
    etat.enveloppes = etat.enveloppes.filter((x) => x.id !== id);
    for (const m of Object.keys(etat.allocations)) delete etat.allocations[m][id];
    await sauverEtat(); statut = "Enveloppe « " + e.nom + " » retirée ; ses opérations sont à reclasser."; dessiner();
  }
  async function fixerAllocation(id, texte) {
    const c = lireEuros(texte);
    if (c == null || c < 0) { statut = "Montant illisible : écris par exemple 250 ou 250,50."; dessiner(); return; }
    etat = { ...etat, ...allouer(etat, mois, id, c) }; await sauverEtat(); dessiner();
  }
  async function reprendre() {
    etat = { ...etat, ...reprendreMoisPrecedent(etat, mois) }; await sauverEtat(); statut = "Enveloppes du mois précédent reprises (ce qui était déjà saisi est gardé)."; dessiner();
  }
  async function classer(op, categorie) {
    if (!categorie) return;
    ops = ops.map((o) => (o.id === op.id ? { ...o, categorieManuelle: categorie } : o));
    await ecrire(() => store.put("kv", { id: OPS + op.date.slice(0, 7), operations: ops.filter((o) => o.date.slice(0, 7) === op.date.slice(0, 7)) }));
    const s = suggererRegle(op.libelle, categorie);
    suggestion = s && !etat.regles.some((r) => r.id === s.id) ? s : null;
    statut = "Classé dans « " + categorie + " »."; dessiner();
  }
  async function accepterRegle() {
    if (!suggestion) return;
    const { suggeree, ...r } = suggestion; etat.regles.push(r); suggestion = null; await sauverEtat();
    statut = "Règle ajoutée : les opérations qui correspondent seront classées toutes seules."; dessiner();
  }
  async function retirerRegle(id) { etat.regles = etat.regles.filter((r) => r.id !== id); await sauverEtat(); statut = "Règle retirée."; dessiner(); }
  const changerMois = (m) => { mois = m; suggestion = null; dessiner(); };

  // ---------- Dessin ----------
  function dessiner() {
    if (!pret) return;
    saisie = false;   // un nouveau dessin repart des données ; les rechargements venus d'ailleurs ne l'emportent jamais sur une saisie en cours (écouteur « input »)
    garderFocus(racine, () => { racine.textContent = ""; racine.append(...vue()); });
  }
  function vue() {
    const { cat, r } = calcul(), V = [];
    const choix = [...etat.enveloppes.map((e) => e.nom), REVENUS];
    tag.textContent = nomMois(mois).toUpperCase();
    pf.textContent = ""; pf.append(h("span", {}, `${ops.length} opération${ops.length > 1 ? "s" : ""} sur l'appareil`), h("span", {}, `${etat.enveloppes.length} enveloppe${etat.enveloppes.length > 1 ? "s" : ""}`));

    // Mois et import
    V.push(h("div", { class: "rg", role: "group", "aria-label": "Mois affiché" },
      h("button", { type: "button", class: "btn", "data-k": "prec", "aria-label": "Mois précédent", onclick: () => changerMois(moisPrecedent(mois)) }, "‹"),
      h("strong", { class: "grow", "aria-live": "polite", style: "text-align:center;font:700 15px var(--mono);text-transform:capitalize" }, nomMois(mois)),
      h("button", { type: "button", class: "btn", "data-k": "suiv", "aria-label": "Mois suivant", onclick: () => changerMois(moisSuivant(mois)) }, "›")));
    V.push(h("div", { class: "rg" },
      h("button", { type: "button", class: "btn ok grow", "data-k": "import", onclick: choisirReleve }, "Importer un relevé (CSV)…"),
      h("button", { type: "button", class: "btn", "data-k": "reprendre", onclick: reprendre, disabled: !etat.enveloppes.length }, "Reprendre le mois précédent")));
    V.push(h("p", { class: "etat", role: "status", "aria-live": "polite" }, statut));

    // Argent à répartir
    V.push(h("div", { class: "card" },
      h("div", { class: "tete" }, h("span", { class: "dim" }, "À répartir"), h("span", { class: "gros " + (r.aRepartir < 0 ? "bad" : r.aRepartir > 0 ? "good" : "") }, euros(r.aRepartir))),
      h("div", { class: "dim" }, `Revenus du mois : ${euros(r.revenus)} · réparti : ${euros(r.totaux.alloue)} · reste dans les enveloppes : ${euros(r.totaux.reste)}`)));
    if (r.alertes.length) V.push(h("ul", { "aria-label": "Alertes" }, r.alertes.map((a) => h("li", { class: "txt warn" }, "⚠ " + a))));

    // Enveloppes
    V.push(h("h3", {}, "Enveloppes"));
    if (!r.enveloppes.length) V.push(h("p", { class: "vide" }, "Aucune enveloppe. Crée-en une ci-dessous (Courses, Loyer, Loisirs…), puis importe un relevé."));
    const liste = h("ul", {});
    for (const l of r.enveloppes) {
      const part = l.report + l.alloue > 0 ? Math.min(100, Math.round(-l.activite / (l.report + l.alloue) * 100)) : (l.activite < 0 ? 100 : 0);
      const champ = h("input", { class: "inl", type: "text", inputmode: "decimal", autocomplete: "off", "data-k": "alloc-" + l.id, value: euroChamp(l.alloue), "aria-label": "Montant mis dans l'enveloppe " + l.nom + " en " + nomMois(mois) + ", en euros" });
      champ.addEventListener("change", () => fixerAllocation(l.id, champ.value));
      champ.addEventListener("keydown", (e) => e.stopPropagation());
      liste.append(h("li", { class: "card" + (l.depasse ? " alerte" : "") },
        h("div", { class: "tete" }, h("span", { class: "nom" }, l.nom), h("span", { class: "gros " + (l.depasse ? "bad" : "good") }, euros(l.reste), l.depasse ? " (dépassée)" : "")),
        h("div", { class: "bar" + (l.depasse ? " bad" : ""), role: "img", "aria-label": `${Math.max(0, part)} % utilisé` }, h("i", { style: "width:" + Math.max(0, Math.min(100, part)) + "%" })),
        h("div", { class: "dim" }, `Report ${euros(l.report)} · dépensé ${euros(-l.activite)}`),
        h("div", { class: "rg" }, h("label", {}, "Mis dans l'enveloppe (€)", champ),
          boutonDeuxTemps("Retirer", "Confirmer le retrait", () => retirerEnveloppe(l.id), { nom: l.nom }))));
    }
    V.push(liste);
    const nom = h("input", { class: "inl", type: "text", maxlength: "40", autocomplete: "off", "data-k": "nouvelle", placeholder: "Nouvelle enveloppe (Courses…)", "aria-label": "Nom de la nouvelle enveloppe" });
    nom.addEventListener("keydown", (e) => e.stopPropagation());
    V.push(h("form", { class: "rg", onsubmit: (e) => { e.preventDefault(); ajouterEnveloppe(nom.value); } }, h("div", { class: "grow" }, nom), h("button", { type: "submit", class: "btn" }, "Ajouter")));

    // À classer
    const sans = cat.filter((o) => !o.categorie && o.date.slice(0, 7) === mois);
    V.push(h("h3", {}, `À classer (${sans.length})`));
    if (suggestion) {
      V.push(h("div", { class: "card", role: "group", "aria-label": "Règle proposée" },
        h("p", { class: "txt" }, "Toujours classer " + suggestion.nom.replace("→", "dans") + " ?"),
        h("div", { class: "rg" }, h("button", { type: "button", class: "btn ok", "data-k": "regle-oui", onclick: accepterRegle }, "Oui, créer la règle"), h("button", { type: "button", class: "btn", onclick: () => { suggestion = null; dessiner(); } }, "Non merci"))));
    }
    if (!sans.length) V.push(h("p", { class: "vide" }, ops.some((o) => o.date.slice(0, 7) === mois) ? "Tout est classé pour ce mois." : "Aucune opération ce mois-ci. Importe le relevé de ta banque."));
    else if (!etat.enveloppes.length) V.push(h("p", { class: "vide" }, "Crée d'abord une enveloppe pour pouvoir classer."));
    else {
      const ul = h("ul", {});
      sans.slice(0, 40).forEach((o) => {
        const sel = h("select", { class: "inl", "data-k": "cl-" + o.id, "aria-label": "Classer « " + o.libelle + " » du " + o.date.split("-").reverse().join("/") }, h("option", { value: "" }, "Classer dans…"), choix.map((c) => h("option", { value: c }, c)));
        sel.addEventListener("change", () => classer(o, sel.value));
        ul.append(h("li", { class: "card" }, h("div", { class: "tete" }, h("span", { class: "txt" }, o.libelle || "(sans libellé)"), h("span", { class: "gros " + (o.montant < 0 ? "" : "good"), style: "font-size:16px" }, euros(o.montant))), h("div", { class: "dim" }, o.date.split("-").reverse().join("/")), sel));
      });
      V.push(ul);
      if (sans.length > 40) V.push(h("p", { class: "vide" }, `${sans.length - 40} autres : classe celles-ci d'abord.`));
    }

    // Règles et bilan
    V.push(h("details", {}, h("summary", {}, `Règles de classement (${etat.regles.length})`),
      etat.regles.length ? h("ul", { style: "margin-top:6px" }, etat.regles.map((g) => h("li", { class: "rg" }, h("span", { class: "txt grow" }, g.nom || g.categorie), boutonDeuxTemps("Retirer", "Confirmer", () => retirerRegle(g.id), { nom: g.nom || g.categorie }))))
        : h("p", { class: "vide", style: "margin-top:6px" }, "Aucune règle. Quand tu classes une opération à la main, je te propose d'en créer une.")));
    const bilan = bilanTexte(r);
    V.push(h("details", {}, h("summary", {}, "Bilan du mois"), h("pre", {}, bilan),
      h("div", { class: "rg", style: "margin-top:6px" }, h("button", { type: "button", class: "btn", onclick: async () => { try { await navigator.clipboard.writeText(bilan); toast("Bilan copié"); } catch (e) { toast("Copie impossible : sélectionne le texte"); } } }, "Copier le bilan"))));
    return V;
  }

  racine.addEventListener("input", () => { saisie = true; });
  registerMenu("budget", () => [{ t: "Importer un relevé CSV…", fn: choisirReleve }, { t: "Reprendre les enveloppes du mois précédent", fn: reprendre }]);
  store.on("kv", () => { if (!ecriture && !saisie) charger(); });
  charger();
  return { importer, charger, etat: () => etat, mois: () => mois };
}
