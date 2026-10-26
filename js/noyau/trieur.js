// Noyau · trieur intelligent de mails et de fichiers (idée de Lucien du 25/10). Moteur à règles, SANS IA : il PROPOSE, Lucien VALIDE.
// Principes : (1) jamais de suppression sans validation explicite, élément par élément ou par lot montré en entier ; (2) « supprimer » = corbeille
// récupérable pendant 30 jours, jamais définitif ; (3) tout ce qui peut compter (factures, impôts, contrats, santé, expéditeurs protégés, non lus
// récents, favoris) est PROTÉGÉ d'office ; (4) le Noyau n'a aucun outil pour supprimer : l'application d'un lot est un bouton cliqué par Lucien.
// Les éléments sont décrits, pas lus : { id, genre: "mail"|"fichier", titre, expediteur?, date, taille?, lu?, favori?, etiquettes?, nom? }.
import { normaliser } from "./recherche.js";

export const PROTEGES = /\b(facture|impot|impots|avis d'imposition|contrat|bail|assurance|mutuelle|ordonnance|medecin|sante|banque|releve|attestation|passeport|carte d'identite|diplome|notaire|retraite|caf|urssaf|garantie|billet|reservation|code|mot de passe)\b/;
const PROMO = /\b(promo|promotion|soldes?|-\s?\d{1,2}\s?%|offre (exclusive|speciale|limitee)|newsletter|se desabonner|desinscri\w+|ventes? privees?|bon plan|code de reduction|derniere chance)\b/;
const NOTIF = /\b(notification|nouveau message|vous avez \d+|a commente|vous a identifie|rappel automatique|ne pas repondre|noreply|no-reply)\b/;
const TEMP = /(\.tmp|\.crdownload|\.part|\.bak|~\$.*|thumbs\.db|\.ds_store|\(\d+\))$/i;
export const jours = (a, b) => Math.floor((b - new Date(a)) / 86400000);

/** Classe UN élément. Renvoie { action: "garder"|"archiver"|"supprimer", raison, confiance, protege }. */
export function classer(e, { now = new Date(), protegesExpediteurs = [], ageFichierJours = 365 } = {}) {
  const texte = normaliser([e.titre, e.nom, e.expediteur].filter(Boolean).join(" "));
  const age = e.date ? jours(e.date, now) : 0;
  const garde = (raison) => ({ action: "garder", raison, confiance: 1, protege: true });
  if (e.favori) return garde("marqué favori");
  if ((e.etiquettes || []).some((t) => /important|starred|etoile|garder/i.test(t))) return garde("étiquette « important »");
  if (protegesExpediteurs.some((p) => e.expediteur && normaliser(e.expediteur).includes(normaliser(p)))) return garde("expéditeur protégé");
  if (PROTEGES.test(texte)) return garde("peut être un document important (facture, contrat, santé…)");
  if (e.genre === "mail") {
    if (e.lu === false && age < 30) return garde("non lu depuis moins de 30 jours");
    if (PROMO.test(texte) && e.lu !== false) return { action: "supprimer", raison: "publicité ou newsletter déjà vue", confiance: 0.85, protege: false };
    if (PROMO.test(texte)) return { action: "archiver", raison: "publicité ou newsletter non ouverte", confiance: 0.7, protege: false };
    if (NOTIF.test(texte) && age > 30) return { action: "supprimer", raison: "notification automatique de plus de 30 jours", confiance: 0.8, protege: false };
    if (age > 365 && e.lu !== false) return { action: "archiver", raison: "mail de plus d'un an, déjà lu", confiance: 0.6, protege: false };
    return garde("rien d'anormal");
  }
  if (e.genre === "fichier") {
    if (TEMP.test(e.nom || "")) return { action: "supprimer", raison: "fichier temporaire ou incomplet", confiance: 0.9, protege: false };
    if (age > ageFichierJours && !e.ouvertRecemment) return { action: "archiver", raison: `fichier de plus de ${ageFichierJours} jours jamais rouvert`, confiance: 0.55, protege: false };
    return garde("rien d'anormal");
  }
  return garde("genre inconnu : par prudence, rien n'est proposé");
}

/** Doublons de fichiers : même nom (sans « (1) ») et même taille. Le plus ancien est proposé, jamais le plus récent. */
export function trouverDoublons(fichiers) {
  const groupes = new Map();
  for (const f of fichiers.filter((x) => x.genre === "fichier" && x.taille != null)) { const cle = normaliser((f.nom || "").replace(/\s*\(\d+\)(?=\.[^.]+$|$)/, "")) + "|" + f.taille; (groupes.get(cle) || groupes.set(cle, []).get(cle)).push(f); }
  const out = new Map();
  for (const l of groupes.values()) if (l.length > 1) { l.sort((a, b) => new Date(b.date) - new Date(a.date)); for (const f of l.slice(1)) out.set(f.id, `doublon de « ${l[0].nom} » (le plus récent est gardé)`); }
  return out;
}

/** Prépare un lot de propositions. Rien n'est exécuté ; `parAction` sert à montrer le lot en entier à Lucien avant de valider. */
export function preparerLot(elements, options = {}) {
  const dou = trouverDoublons(elements), props = [];
  for (const e of elements) {
    let c = classer(e, options);
    if (dou.has(e.id) && !c.protege) c = { action: "supprimer", raison: dou.get(e.id), confiance: 0.8, protege: false };
    if (c.action !== "garder") props.push({ id: e.id, titre: e.titre || e.nom || e.id, genre: e.genre, date: e.date || null, ...c });
  }
  const parAction = { supprimer: props.filter((p) => p.action === "supprimer"), archiver: props.filter((p) => p.action === "archiver") };
  return { propositions: props, parAction, resume: { a_supprimer: parAction.supprimer.length, a_archiver: parAction.archiver.length, gardes: elements.length - props.length }, protegesVus: elements.filter((e) => classer(e, options).protege).length };
}

/**
 * Applique le lot VALIDÉ par Lucien : `choix` = ids cochés, `confirmation === true` obligatoire ; `agir(action, element)` est fourni par le hub
 * (corbeille ou archive, jamais une suppression définitive). Un id absent du lot, ou protégé, est refusé.
 */
export async function appliquerLot(lot, { choix = [], confirmation = false, apercuVu = false, agir, ecrireHistorique = async () => {} } = {}) {
  if (apercuVu !== true) return { ok: false, raison: "Montre d'abord le lot en entier à Lucien." };
  if (confirmation !== true) return { ok: false, raison: "Pas de confirmation de Lucien : rien n'est touché." };
  if (typeof agir !== "function") return { ok: false, raison: "Aucune action branchée : rien n'est touché." };
  const fait = [], refuses = [];
  for (const id of choix) {
    const p = lot.propositions.find((x) => x.id === id);
    if (!p || p.protege || p.action === "garder") { refuses.push({ id, raison: !p ? "pas dans le lot montré (élément gardé ou protégé)" : "élément protégé" }); continue; }
    try { await agir(p.action, p); fait.push({ id, action: p.action }); } catch (e) { refuses.push({ id, raison: "échec : " + String(e && e.message || e).slice(0, 80) }); }
  }
  await ecrireHistorique({ quand: new Date().toISOString(), fait, refuses });
  return { ok: true, fait, refuses, annulation: "Les éléments supprimés sont dans la corbeille pendant 30 jours." };
}
