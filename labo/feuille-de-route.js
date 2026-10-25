// Laboratoire · feuille de route du Noyau. Chaque chantier a ses étapes ; le pourcentage est le nombre d'étapes faites sur le total.
// Une étape peut être « mesurée » : elle ne passe à « faite » que quand la mesure réelle du labo atteint la cible (notes, banc, comparaisons).
// statut : fait | en_cours | prochain | attend (c'est à Lucien de faire quelque chose).
export const CHANTIERS = [
  { id: "base", nom: "Noyau de base", etapes: [
    { t: "Cycle réflexe → rappel → modèle → outils → vérification", s: "fait" }, { t: "Barrière de permissions (libre / confirmation / interdit)", s: "fait" },
    { t: "Mémoire à 5 types et boîte « À valider »", s: "fait" }, { t: "Mode réduit sans modèle", s: "fait" }, { t: "Fusion dans le hub (Noyau 1.0)", s: "fait" }, { t: "Contradiction constructive, ton humain, sans question réflexe, sans répétition", s: "fait" }, { t: "Test sur Android", s: "attend", n: "À faire par Lucien" }] },
  { id: "savoir", nom: "Savoir et références", etapes: [
    { t: "30 sources publiques dans 15 domaines", s: "fait" }, { t: "Carte 3D du savoir (16 domaines, 110 sous-thèmes)", s: "fait" }, { t: "Étudier un sous-thème avec validation de Lucien", s: "fait" },
    { t: "Curiosité autonome guidée par le programme", s: "fait" }, { t: "Recherche tolérante (synonymes, fautes, « -mot »)", s: "fait" }, { t: "Import de la mémoire v3.8", s: "attend", n: "Optionnel, par Lucien" }, { t: "Premier domaine couvert à 25 %", s: "attend", n: "Dépend de ce que tu valides dans la fenêtre Savoir" }] },
  { id: "securite", nom: "Sécurité", etapes: [
    { t: "Sentinelle : journal, empreintes des fichiers, activité du dépôt", s: "fait" }, { t: "Audit du code avec correctifs validés par Lucien", s: "fait" }, { t: "Recommandation système toutes les 30 min", s: "fait" },
    { t: "Alerte quand un fichier sensible change sans commit connu", s: "fait" }] },
  { id: "usages", nom: "Usages du quotidien", etapes: [
    { t: "Briefing et revue du soir", s: "fait" }, { t: "Capture rapide « Note : », « Tâche : », « Retiens que »", s: "fait" }, { t: "Rappels en français", s: "fait" },
    { t: "Résumé de fenêtre, recherche globale, mode hors ligne, rappel de sauvegarde", s: "fait" }, { t: "Suggestion du soir proposant la revue", s: "fait" }, { t: "Sauvegarde automatique chiffrée vers un dossier du PC", s: "fait" }] },
  { id: "moteurs", nom: "Moteurs et durabilité", etapes: [
    { t: "Moteur Claude avec plafonds séparés", s: "fait" }, { t: "Routage automatique Gemini / Claude selon la complexité et les jetons", s: "fait" }, { t: "Relais gratuit compatible OpenAI (Groq, Mistral, OpenRouter, Cerebras)", s: "fait" },
    { t: "Essayer une vraie clé Claude et un vrai relais", s: "attend", n: "Colle les clés dans Réglages" }] },
  { id: "orbe", nom: "Orbe et voix", etapes: [
    { t: "Orbe branchée sur le Noyau (mémoire, outils, barrière)", s: "fait" }, { t: "Vue vocale plein écran (bouton Parler)", s: "fait" }, { t: "Bouton Labo réservé à Lucien, labo fermé au Noyau", s: "fait" },
    { t: "Essayer la vue vocale sur Android (Chrome)", s: "attend", n: "Bouton « Parler » en haut" }] },
  { id: "avance", nom: "Options avancées (facultatives)", etapes: [
    { t: "Synchro PC/téléphone : les journaux se fusionnent sans rien écraser", s: "fait" }, { t: "Recherche par le sens (embeddings, WebGPU ou WebAssembly)", s: "fait" }, { t: "Voix naturelle Piper avec repli sur la voix du système", s: "fait" }, { t: "Interruption à la voix dans la vue vocale", s: "fait" },
    { t: "Essayer le sens et Piper sur ton appareil (téléchargements)", s: "attend", n: "Réglages → Sens, voix naturelle, interruption" }, { t: "Kiwix (encyclopédie hors ligne)", s: "attend", n: "Demande un fichier ZIM et un serveur local de ta part" }] },
  { id: "visuel", nom: "Visuel", etapes: [
    { t: "Carte neuronale : influx électriques sur les sous-thèmes en cours ou validés", s: "fait" }, { t: "Onglet Visuel du labo : carte, radars des critères, courbes", s: "fait" },
    { t: "Orbe centrale avec flux de données, domaines proches voisins, vue entièrement occupée", s: "fait" }, { t: "Test automatique pour valider un point de connaissance", s: "fait" }] },
  { id: "qualite", nom: "Qualité mesurée (laboratoire)", etapes: [
    { t: "Banc d'essai mécanique sans erreur", s: "mesure", mesure: "banc_vert", cible: 1 }, { t: "Historique du banc avec détection de régression", s: "fait" },
    { t: "Deux labos (social, réflexion) avec grille de notes", s: "fait" }, { t: "Comparateur A/B de consignes", s: "fait" },
    { t: "30 réponses notées par Lucien, labo social", s: "mesure", mesure: "notes_social", cible: 30 }, { t: "30 réponses notées par Lucien, labo réflexion", s: "mesure", mesure: "notes_reflexion", cible: 30 },
    { t: "20 comparaisons A/B tranchées", s: "mesure", mesure: "ab", cible: 20 }, { t: "Banc réel (Gemini) lancé au moins une fois", s: "mesure", mesure: "banc_reel", cible: 1 }] }
];

/** Calcule l'avancement réel. `etat` = creerEtatLabo(). Renvoie les chantiers avec leurs étapes résolues et leur pourcentage. */
export function avancement(etat) {
  const banc = etat.banc(), dernier = banc[banc.length - 1];
  const mesures = { banc_vert: dernier && dernier.ko === 0 && dernier.ok > 0 ? 1 : 0, notes_social: etat.notes("social").length, notes_reflexion: etat.notes("reflexion").length, ab: etat.ab().length, banc_reel: banc.filter((b) => b.reel).length, ton_ok: (() => { const m = etat.resumeMetriques(10); return m && m.n >= 10 && m.pctFinQuestion <= 30 && m.nRepetitions === 0 ? 10 : (m ? Math.min(m.n, 9) : 0); })() };
  const chantiers = CHANTIERS.map((c) => {
    const etapes = c.etapes.map((e) => {
      if (e.s !== "mesure") return { ...e, fait: e.s === "fait", avance: e.s === "fait" ? 1 : 0 };
      const v = mesures[e.mesure] || 0, a = Math.min(1, v / e.cible);
      return { ...e, fait: a >= 1, avance: a, valeur: v, s: a >= 1 ? "fait" : v > 0 ? "en_cours" : "prochain" };
    });
    return { id: c.id, nom: c.nom, etapes, pct: Math.round((etapes.reduce((a, e) => a + e.avance, 0) / etapes.length) * 100) };
  });
  const total = chantiers.reduce((a, c) => a + c.etapes.length, 0), faites = chantiers.reduce((a, c) => a + c.etapes.reduce((x, e) => x + e.avance, 0), 0);
  return { chantiers, pct: Math.round((faites / total) * 100), suivantes: chantiers.flatMap((c) => c.etapes.filter((e) => e.s === "prochain" || e.s === "en_cours").map((e) => ({ chantier: c.nom, ...e }))).slice(0, 6), attendent: chantiers.flatMap((c) => c.etapes.filter((e) => e.s === "attend").map((e) => ({ chantier: c.nom, ...e }))) };
}

/** Plan de test de la version, à cocher par Lucien (l'état est gardé dans le labo). */
export const PLAN_TEST = [
  ["t-savoir", "Fenêtre Savoir : choisir un domaine, cliquer « Étudier », garder une fiche dans « À valider » et voir le % monter"],
  ["t-curiosite", "Activer la curiosité autonome (fenêtre Savoir) et vérifier qu'une étude arrive dans « À valider » dans l'heure"],
  ["t-capture", "Écrire « Note : test » puis « Rappelle-moi demain à 9 h de tester » dans le Noyau et confirmer"],
  ["t-briefing", "Cliquer Briefing puis Revue du soir"],
  ["t-resume", "Clic droit sur une fenêtre → « Résumer avec le Noyau »"],
  ["t-sauvegarde", "Noyau → Réglages → Sauvegarde automatique : choisir un dossier puis « Sauvegarder maintenant »"],
  ["t-securite", "Sécurité : enregistrer la référence des fichiers, puis vérifier la vue d'ensemble"],
  ["t-ton", "Labo social : essayer 3 situations (dont « Décision risquée ») et noter les réponses"],
  ["t-reflexion", "Labo réflexion : essayer 3 situations et noter les réponses"],
  ["t-ab", "Comparer deux consignes A/B sur une situation (Gemini réel)"],
  ["t-test", "Savoir : « Réaliser le test pour valider ce point » sur un sous-thème et lire le compte rendu"],
  ["t-neurones", "Ouvrir Savoir, valider une fiche et voir le neurone passer de « en cours » à « validé »"],
  ["t-relais", "Réglages : coller une clé de relais gratuit (Groq par exemple) et vérifier qu'il répond quand Gemini est en quota"],
  ["t-vocal", "Android (Chrome) : bouton « Parler », poser une question à voix haute, entendre la réponse"],
  ["t-labo-bouton", "Hub : le bouton « Labo » ouvre le laboratoire dans un nouvel onglet"],
  ["t-sens", "Réglages : activer la recherche par le sens, attendre l'indexation, poser une question avec un synonyme"],
  ["t-piper", "Réglages : activer la voix naturelle et écouter une réponse (puis vérifier le repli si hors ligne)"],
  ["t-sync", "Faire une action sur le PC puis sur le téléphone, synchroniser, et vérifier que le journal du Noyau contient les deux"],
  ["t-android", "Ouvrir le hub sur Android et refaire une capture « Note : »"]
];
