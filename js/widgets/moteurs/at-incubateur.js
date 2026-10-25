// Atelier · moteur at-incubateur : une idée brute devient une fiche à tester (titre, variantes, essais, critères, prochaine action).
// Module pur : sans DOM, sans réseau, sans IA. Tout se fait par règles simples et lisibles (mots repères, montants, durées) :
// la fiche est un point de départ que Lucien corrige, jamais une décision.
// Fiche : { titre, type, typeNom, budget, duree, variantes[], essais[], criteres[], prochaineAction, motsCles[], problemes[], texte }

// Types d'idée reconnus par mots repères (le premier qui a le plus de repères l'emporte ; à égalité, l'ordre ci-dessous).
const TYPES = [
  { id: "achat", nom: "Achat", reperes: ["acheter", "achat", "commander", "s'offrir", "investir dans", "remplacer mon", "remplacer ma", "louer"] },
  { id: "apprendre", nom: "Apprentissage", reperes: ["apprendre", "cours", "formation", "maîtriser", "réviser", "comprendre", "tuto", "langue"] },
  { id: "habitude", nom: "Habitude", reperes: ["chaque jour", "tous les jours", "chaque semaine", "toutes les semaines", "habitude", "routine", "arrêter de", "moins de", "plus de", "le matin", "le soir"] },
  { id: "evenement", nom: "Événement", reperes: ["organiser", "soirée", "anniversaire", "voyage", "week-end", "fête", "sortie", "invités"] },
  { id: "creation", nom: "Création", reperes: ["créer", "fabriquer", "construire", "coder", "écrire", "dessiner", "monter", "application", "site", "jeu", "projet", "outil"] },
];

// Modèles par type : variantes, essais, critères, prochaine action. « {objet} » est remplacé par l'objet de l'idée.
const MODELES = {
  achat: {
    variantes: ["Ne rien acheter : utiliser ce que j'ai déjà", "Emprunter ou louer {objet} pour essayer", "Acheter d'occasion", "Acheter neuf, modèle d'entrée de gamme"],
    essais: ["Noter pendant 7 jours chaque fois que {objet} m'aurait servi", "Comparer au moins 3 offres (prix livré, garantie, retour)", "Lire 2 avis négatifs récents"],
    criteres: ["Servirait au moins une fois par semaine", "Coût total dans le budget prévu", "Retour possible si déçu"],
    action: "Ouvrir une note et compter les occasions d'usage de {objet} cette semaine",
  },
  apprendre: {
    variantes: ["Version découverte : une séance d'essai de 30 min", "Version guidée : un cours ou un tutoriel suivi", "Version projet : apprendre en réalisant une petite chose concrète"],
    essais: ["Faire 3 séances courtes sur une semaine", "Noter après chaque séance ce qui a été compris", "Montrer le résultat à quelqu'un"],
    criteres: ["Les 3 séances sont faites", "Je peux expliquer une notion sans aide", "J'ai envie de continuer"],
    action: "Bloquer 30 min dans l'agenda pour une première séance sur {objet}",
  },
  habitude: {
    variantes: ["Version minuscule : 2 minutes par jour", "Version liée : accrocher l'habitude à un geste déjà quotidien", "Version hebdomadaire : une seule fois par semaine, mais bien faite"],
    essais: ["Tenir 7 jours d'affilée en version minuscule", "Cocher chaque jour dans un suivi simple", "Noter ce qui a bloqué les jours manqués"],
    criteres: ["Au moins 5 jours sur 7", "Moins de 5 minutes d'effort pour démarrer", "Toujours envie au bout d'une semaine"],
    action: "Choisir le geste quotidien auquel accrocher {objet}",
  },
  evenement: {
    variantes: ["Version simple : chez moi, peu de monde", "Version sortie : dans un lieu existant, rien à préparer", "Version complète : thème, programme, invitations"],
    essais: ["Sonder 3 personnes sur la date et l'envie", "Faire une liste de ce qu'il faut (lieu, nourriture, matériel)", "Estimer le coût par personne"],
    criteres: ["Date qui convient à la majorité", "Budget respecté", "Préparation tenable en moins de 3 soirées"],
    action: "Envoyer un message à 3 personnes pour proposer {objet}",
  },
  creation: {
    variantes: ["Version minimale : la plus petite chose qui marche en une soirée", "Version papier : un croquis ou une maquette avant de construire", "Version réutilisée : partir de quelque chose qui existe déjà"],
    essais: ["Faire la version minimale en 2 heures au plus", "La faire essayer à une personne", "Noter les 3 premiers manques constatés"],
    criteres: ["La version minimale fonctionne", "Quelqu'un l'a essayée sans aide", "Je sais quelle est l'étape suivante"],
    action: "Écrire en 3 lignes ce que fait la version minimale de {objet}",
  },
  general: {
    variantes: ["Version minimale : le plus petit pas possible", "Version accompagnée : avec quelqu'un", "Version reportée : y revenir dans un mois"],
    essais: ["Faire le plus petit pas possible cette semaine", "Noter ce qu'il a appris", "Décider : continuer, modifier ou abandonner"],
    criteres: ["Le premier pas est fait", "J'en sais plus qu'avant", "Une décision claire est prise"],
    action: "Écrire le plus petit premier pas pour {objet}",
  },
};

// Mots vides retirés pour les mots-clés et l'objet.
const VIDES = new Set("je j me m moi mon ma mes tu te ton ta tes il elle on nous vous ils elles le la les l un une des du de d au aux et ou mais donc or ni car que qu qui quoi dont où à a en dans sur sous pour par avec sans ce cet cette ces se s y est être avoir ai as faire fais fait veux voudrais vouloir aimerais bien peut-être truc chose genre idée envie pas plus très trop tout tous".split(" "));
const AMORCES = /^(?:idée\s*:\s*|et si (?:je|on)\s+|(?:je|j')\s*(?:voudrais|veux|aimerais|pourrais|devrais|vais)\s+|(?:on|il faudrait)\s+(?:pourrait|devrait)?\s*|(?:je|j')\s*(?:fais|faisais|ferais|me mettais à|me mets à)\s+|(?:faisais|faisait|ferais|fais)\s+|peut-être\s+|faudrait\s+)/i;
// Verbes d'action retirés en tête du titre pour obtenir l'objet (« Acheter un vélo » → « un vélo »).
const VERBES = /^(?:acheter|commander|louer|s'offrir|investir dans|apprendre(?: à)?|maîtriser|réviser|créer|fabriquer|construire|coder|écrire|dessiner|monter|organiser|faire)\s+/i;
// Contractions et élisions après remplacement de {objet} (« de un » → « d'un », « de le » → « du »).
const accorder = (s) => s.replace(/\b(de|que) (une?)\b/g, (_, a, b) => `${a === "de" ? "d" : "qu"}'${b}`).replace(/\bde le /g, "du ").replace(/\bde les /g, "des ").replace(/\bà le /g, "au ").replace(/\bà les /g, "aux ");

const minus = (s) => s.toLocaleLowerCase("fr");
const majuscule = (s) => (s ? s[0].toLocaleUpperCase("fr") + s.slice(1) : s);

/** Montant repéré dans le texte, en centimes (« 50 € », « 49,90 euros », « 1 200€ »), ou null. */
export function lireBudget(texte) {
  const m = /(\d{1,3}(?:[ \u00a0\u202f]\d{3})*|\d+)(?:[,.](\d{1,2}))?\s*(?:€|euros?\b|eur\b)/i.exec(texte || "");
  if (!m) return null;
  return parseInt(m[1].replace(/[ \u00a0\u202f]/g, ""), 10) * 100 + (m[2] ? parseInt(m[2].padEnd(2, "0"), 10) : 0);
}

/** Durée repérée, en jours (« 2 semaines » → 14, « un mois » → 30, « 3 jours » → 3), ou null. */
export function lireDuree(texte) {
  const nombres = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10, quinze: 15 };
  const m = /\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|dix|quinze)\s+(jours?|semaines?|mois|ans?)\b/i.exec(texte || "");
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? +m[1] : nombres[minus(m[1])];
  const u = minus(m[2]);
  return n * (u.startsWith("jour") ? 1 : u.startsWith("semaine") ? 7 : u === "mois" ? 30 : 365);
}

/** Type de l'idée d'après ses mots repères : { id, nom, reperes } (id "general" si rien n'est reconnu). */
export function typer(texte) {
  const t = " " + minus(texte || "") + " ";
  let meilleur = { id: "general", nom: "Idée", reperes: [] };
  for (const ty of TYPES) {
    const trouves = ty.reperes.filter((r) => new RegExp(`(^|[^\\p{L}])${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u").test(t));
    if (trouves.length > meilleur.reperes.length) meilleur = { id: ty.id, nom: ty.nom, reperes: trouves };
  }
  return meilleur;
}

/** Mots-clés : mots de 3 lettres ou plus, hors mots vides, sans doublon, dans l'ordre d'apparition (6 au plus). */
export function motsCles(texte, max = 6) {
  const vus = new Set(), out = [];
  for (const m of minus(texte || "").match(/[\p{L}\d][\p{L}\d'-]*/gu) || []) {
    const mot = m.replace(/^[a-z]'/u, "");
    if (mot.length < 3 || VIDES.has(mot) || /^\d+$/.test(mot) || vus.has(mot)) continue;
    vus.add(mot); out.push(mot);
    if (out.length >= max) break;
  }
  return out;
}

/** Titre court : première phrase, sans amorce (« je voudrais… »), sans montant, 60 caractères au plus, majuscule initiale. */
export function titrer(texte, max = 60) {
  let t = String(texte || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s|\n/)[0] || "";
  t = t.replace(/[.!?…]+$/, "");
  for (let i = 0; i < 3; i++) t = t.replace(AMORCES, "");
  t = t.replace(/\s*(?:pour|à|a|de|environ|max(?:imum)?)?\s*(?:\d[\d \u00a0\u202f]*(?:[,.]\d{1,2})?)\s*(?:€|euros?\b|eur\b)/gi, "").replace(/[\s,;:-]+$/, "").trim();
  if (t.length > max) { t = t.slice(0, max + 1); t = t.slice(0, Math.max(t.lastIndexOf(" "), max * 0.6 | 0)).replace(/[\s,;:-]+$/, "") + "…"; }
  return majuscule(t);
}

/** Transforme une idée brute (texte) en fiche. Options : { type } pour imposer un type ("achat", "apprendre"…). */
export function incuber(idee, { type } = {}) {
  const texte = String(idee ?? "").replace(/\s+/g, " ").trim(), problemes = [];
  if (!texte) return { titre: "", type: "invalide", typeNom: "", budget: null, duree: null, variantes: [], essais: [], criteres: [], prochaineAction: "", motsCles: [], problemes: ["idée vide"], texte: "Idée vide : rien à incuber." };
  if (texte.length < 8) problemes.push("idée très courte : la fiche sera générique");
  const ty = type && MODELES[type] ? { id: type, nom: (TYPES.find((x) => x.id === type) || { nom: "Idée" }).nom, reperes: [] } : typer(texte);
  if (type && !MODELES[type]) problemes.push(`type « ${type} » inconnu : type reconnu automatiquement`);
  const titre = titrer(texte) || majuscule(motsCles(texte).join(" ")) || "Idée sans titre";
  const objet = minus(titre.replace(/…$/, "")).replace(VERBES, "").replace(/\s+pendant\s+\S+\s+\S+$/, "") || minus(titre);
  const M = MODELES[ty.id], remplir = (s) => accorder(s.replace(/\{objet\}/g, objet));
  const budget = lireBudget(texte), duree = lireDuree(texte);
  const variantes = M.variantes.map(remplir), essais = M.essais.map(remplir), criteres = M.criteres.map(remplir);
  if (budget != null) {
    const e = (c) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/[\u00a0\u202f]/g, " ") + " €";
    criteres[ty.id === "achat" || ty.id === "evenement" ? 1 : criteres.length] = `Coût total de ${e(budget)} au plus`;
    variantes.push(`Version à moitié prix : ${e(Math.round(budget / 2))} au plus`);
  }
  if (duree != null) essais.unshift(`Tester pendant ${duree} jour${duree > 1 ? "s" : ""}, puis faire le bilan`);
  if (ty.id === "general") problemes.push("type non reconnu : modèle général utilisé");
  const fiche = { titre, objet, type: ty.id, typeNom: ty.nom, budget, duree, variantes, essais, criteres: criteres.filter(Boolean), prochaineAction: remplir(M.action), motsCles: motsCles(texte), problemes };
  fiche.texte = ficheTexte(fiche);
  return fiche;
}

/** Fiche en texte lisible (pour une note ou un partage). */
export function ficheTexte(f) {
  if (!f || !f.titre) return "Idée vide : rien à incuber.";
  const liste = (titre, l) => (l && l.length ? [`${titre} :`, ...l.map((x) => `- ${x}`)] : []);
  return [`# ${f.titre}`, `Type : ${f.typeNom}`, "", ...liste("Variantes", f.variantes), "", ...liste("Essais à faire", f.essais), "", ...liste("Critères de réussite", f.criteres), "", `Prochaine action : ${f.prochaineAction}`].join("\n");
}
