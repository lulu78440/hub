// Noyau · routines (lab-n8n-routines, lab-n8n-modeles). Idée reprise de n8n (déclencheur → étapes → validation de Lucien → historique), écrite
// à la main, sans copier de code ni installer de serveur. Moteur à règles, SANS IA : l'IA peut proposer une routine, jamais la lancer seule.
//  - Une routine = un déclencheur (heure, événement du hub, phrase exacte de Lucien) + 1 à 5 étapes (outils VALIDÉS du catalogue).
//  - Avant de démarrer, Lucien voit la liste des étapes et valide (« validation globale ») ; ensuite CHAQUE étape garde son niveau :
//    une étape CONFIRMATION redemande son accord par la barrière. Sans Lucien présent, rien d'autre qu'une lecture ne s'exécute.
//  - Chaque passage laisse une ligne d'historique (ce qui a tourné, quand, pourquoi arrêté). Aucune étape ne simule une action.
import { EXCLUS } from "./raccourcis.js";
import { OUTILS_VALIDES } from "./outils.js";

export const EVENEMENTS = ["ouverture-du-jour", "fin-de-focus", "ecran-deverrouille", "tache-cochee"];
export const MAX = { routines: 15, etapes: 5, historique: 100 };
const jours = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
export const cleLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;   // jour local (pas UTC : une routine de 00 h 10 ne doit pas compter pour la veille)
const heureOk = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h || "");

/** Contrôle une routine. Renvoie la liste des problèmes (vide = valide). `barriere.outil(nom)` retrouve un outil du catalogue actif. */
export function validerRoutine(r, { barriere = null, valides = OUTILS_VALIDES } = {}) {
  const p = [];
  if (!r || typeof r !== "object") return ["routine illisible"];
  if (!r.id || !/^[a-z0-9-]{2,40}$/.test(r.id)) p.push("id : minuscules, chiffres et tirets");
  if (!r.nom || String(r.nom).length > 60) p.push("nom manquant ou trop long");
  const d = r.declencheur || {};
  if (d.type === "heure") { if (!heureOk(d.heure)) p.push("heure : HH:MM"); if (d.jours && !(Array.isArray(d.jours) && d.jours.every((j) => jours.includes(j)))) p.push("jours : lun, mar, mer, jeu, ven, sam, dim"); }
  else if (d.type === "evenement") { if (!EVENEMENTS.includes(d.nom)) p.push("événement inconnu : " + d.nom); }
  else if (d.type === "phrase") { if (!d.phrase || String(d.phrase).length < 4 || String(d.phrase).length > 80) p.push("phrase : 4 à 80 signes"); }
  else p.push("déclencheur : heure, événement ou phrase");
  if (!Array.isArray(r.etapes) || r.etapes.length < 1 || r.etapes.length > MAX.etapes) p.push(`1 à ${MAX.etapes} étapes`);
  else for (const e of r.etapes) {
    if (!e || typeof e.outil !== "string") { p.push("étape sans outil"); continue; }
    if (!Object.prototype.hasOwnProperty.call(valides, e.outil)) p.push(`« ${e.outil} » n'est pas un outil validé par Lucien`);
    else if (EXCLUS.has(e.outil)) p.push(`« ${e.outil} » ne peut pas entrer dans une routine`);
    else if (barriere && !barriere.outil(e.outil)) p.push(`« ${e.outil} » est absent du catalogue actif`);
    if (e.params !== undefined && (typeof e.params !== "object" || Array.isArray(e.params) || e.params === null)) p.push(`paramètres de « ${e.outil} » : un objet`);
  }
  return p;
}

/** Routines dues à l'instant `now` (déclencheur « heure » seulement). Une routine ne part qu'une fois par jour, et jamais plus d'1 h après son heure. */
export function routinesDues(routines, now, historique = []) {
  const jour = cleLocale(now), min = now.getHours() * 60 + now.getMinutes();
  return routines.filter((r) => r.actif !== false && r.declencheur && r.declencheur.type === "heure").filter((r) => {
    const [h, m] = r.declencheur.heure.split(":").map(Number), cible = h * 60 + m;
    if (r.declencheur.jours && !r.declencheur.jours.includes(jours[now.getDay()])) return false;
    if (min < cible || min - cible > 60) return false;
    return !historique.some((l) => l.routine === r.id && l.jour === jour);
  });
}
export const routinesPourEvenement = (routines, nom) => routines.filter((r) => r.actif !== false && r.declencheur && r.declencheur.type === "evenement" && r.declencheur.nom === nom);
export const routinePourPhrase = (routines, phrase) => { const c = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); return routines.find((r) => r.actif !== false && r.declencheur && r.declencheur.type === "phrase" && c(r.declencheur.phrase) === c(phrase)) || null; };

/**
 * Lance une routine. `validerEtapes(info)` est la fenêtre de Lucien (liste des étapes) : sans elle ou sur un refus, rien ne s'exécute.
 * `barriere.executer({ outil, params }, { origine })` garde les niveaux : une étape CONFIRMATION redemande son accord.
 * S'arrête à la première étape refusée ou en échec. Renvoie la ligne d'historique (déjà écrite via `ecrireHistorique`).
 */
export async function lancerRoutine(routine, { barriere, validerEtapes, ecrireHistorique = async () => {}, maintenant = () => new Date(), declencheur = null, verrouille = () => false }) {
  const t0 = maintenant(), ligne = { id: "run-" + t0.getTime().toString(36), routine: routine.id, nom: routine.nom, jour: cleLocale(t0), debut: t0.toISOString(), declencheur: declencheur || routine.declencheur.type, etapes: [], issue: "", raison: "" };
  const finir = async (issue, raison = "") => { ligne.issue = issue; ligne.raison = raison; ligne.fin = maintenant().toISOString(); await ecrireHistorique(ligne); return ligne; };
  const pb = validerRoutine(routine, { barriere }); if (pb.length) return finir("annulee", "routine invalide : " + pb[0]);
  if (verrouille()) return finir("annulee", "écran verrouillé");
  if (typeof validerEtapes !== "function") return finir("annulee", "aucune fenêtre de validation : rien ne s'exécute");
  const ok = await validerEtapes({ routine: routine.nom, etapes: routine.etapes.map((e) => ({ outil: e.outil, niveau: barriere.outil(e.outil).niveau, params: e.params || {} })) });
  if (ok !== true) return finir("refusee", "refusée par Lucien");
  for (const e of routine.etapes) {
    const r = await barriere.executer({ outil: e.outil, params: e.params || {} }, { origine: "lucien" });
    ligne.etapes.push({ outil: e.outil, statut: r.ok ? "fait" : r.refus ? "refuse" : "erreur", detail: r.ok ? "" : String(r.erreur || "").slice(0, 120) });
    if (!r.ok) return finir("interrompue", `étape « ${e.outil} » ${r.refus ? "refusée" : "en erreur"}`);
  }
  return finir("terminee");
}

/** Modèles prêts à l'emploi (proposés, jamais activés d'office). N'utilisent que des outils déjà validés. */
export const MODELES_ROUTINES = [
  { id: "revue-du-soir", nom: "Revue du soir", declencheur: { type: "heure", heure: "20:30" }, etapes: [{ outil: "lire_taches", params: { filtre: "en_retard" } }, { outil: "lire_agenda" }, { outil: "afficher", params: { fenetre: "tasks" } }], pourquoi: "Voir les tâches en retard et l'agenda de demain, avec les tâches à l'écran." },
  { id: "ouverture-du-jour", nom: "Ouverture du jour", declencheur: { type: "evenement", nom: "ouverture-du-jour" }, etapes: [{ outil: "lire_meteo" }, { outil: "lire_agenda" }, { outil: "lire_actus", params: { max: 3 } }], pourquoi: "Météo, rendez-vous et trois titres d'actualité à la première ouverture." },
  { id: "mode-soiree", nom: "Mode soirée", declencheur: { type: "phrase", phrase: "mode soirée" }, etapes: [{ outil: "lancer_focus", params: { minutes: 25 } }, { outil: "afficher", params: { fenetre: "rituels" } }], pourquoi: "Un Focus de 25 minutes et les rituels à l'écran." },
  { id: "point-veille", nom: "Point sur la veille", declencheur: { type: "heure", heure: "18:00", jours: ["ven"] }, etapes: [{ outil: "lire_veille" }, { outil: "lire_actus", params: { max: 5 } }], pourquoi: "Chaque vendredi : sites en ligne ou en panne et cinq titres." }
];
