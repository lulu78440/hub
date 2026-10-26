// Laboratoire · essais des routines : `node labo/essais-routines.mjs` (barrière simulée, aucune IA, aucune requête)
import { cleLocale, validerRoutine, routinesDues, routinesPourEvenement, routinePourPhrase, lancerRoutine, MODELES_ROUTINES } from "../js/noyau/routines.js";
import { OUTILS_VALIDES } from "../js/noyau/outils.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const catalogue = Object.entries(OUTILS_VALIDES).map(([nom, niveau]) => ({ nom, niveau }));
const fauxBarriere = (reponses = {}) => ({ appels: [], outil: (n) => catalogue.find((o) => o.nom === n), async executer(a, opts) { this.appels.push([a.outil, opts.origine]); const r = reponses[a.outil]; return r || { ok: true, donnees: {} }; } });
const bar = fauxBarriere();
const base = { id: "ma-routine", nom: "Ma routine", declencheur: { type: "heure", heure: "20:30" }, etapes: [{ outil: "lire_taches" }] };
ok(validerRoutine(base, { barriere: bar }).length === 0, "routine saine : valide");
ok(MODELES_ROUTINES.length >= 4 && MODELES_ROUTINES.every((m) => validerRoutine(m, { barriere: bar }).length === 0), "les " + MODELES_ROUTINES.length + " modèles prêts à l'emploi sont valides (outils déjà validés seulement)");
ok(validerRoutine({ ...base, etapes: [{ outil: "supprimer_tout" }] }, { barriere: bar }).some((x) => /pas un outil validé/.test(x)), "outil inconnu ou non validé refusé");
ok(validerRoutine({ ...base, etapes: [{ outil: "memoriser" }] }, { barriere: bar }).some((x) => /ne peut pas entrer/.test(x)), "outils exclus (mémoire, personnalisation, mails) refusés");
ok(validerRoutine({ ...base, etapes: Array(6).fill({ outil: "heure" }) }, { barriere: bar }).length > 0, "plus de 5 étapes refusé");
ok(validerRoutine({ ...base, declencheur: { type: "heure", heure: "25:99" } }).length > 0 && validerRoutine({ ...base, declencheur: { type: "evenement", nom: "inconnu" } }).length > 0 && validerRoutine({ ...base, declencheur: { type: "magie" } }).length > 0, "déclencheurs mal formés refusés");
ok(validerRoutine({ ...base, etapes: [{ outil: "afficher", params: "x" }] }, { barriere: bar }).length > 0, "paramètres qui ne sont pas un objet refusés");
// Déclenchement par l'heure
const dim = new Date(2026, 9, 25, 20, 40);          // dimanche 25/10/2026 20:40
ok(routinesDues([base], dim).length === 1, "20 h 40 : la routine de 20 h 30 est due");
ok(routinesDues([base], new Date(2026, 9, 25, 20, 10)).length === 0, "pas avant son heure");
ok(routinesDues([base], new Date(2026, 9, 25, 22, 0)).length === 0, "plus d'1 h après : on ne rattrape pas (pas de surprise tardive)");
ok(routinesDues([base], dim, [{ routine: "ma-routine", jour: cleLocale(dim) }]).length === 0, "une seule fois par jour");
ok(routinesDues([{ ...base, declencheur: { type: "heure", heure: "20:30", jours: ["ven"] } }], dim).length === 0, "jour de la semaine respecté");
ok(routinesDues([{ ...base, actif: false }], dim).length === 0, "routine coupée : jamais due");
ok(routinesPourEvenement(MODELES_ROUTINES, "ouverture-du-jour").length === 1 && routinePourPhrase(MODELES_ROUTINES, "Mode SOIREE !")?.id === "mode-soiree" && routinePourPhrase(MODELES_ROUTINES, "mode soirée ou pas") === null, "événement et phrase exacte (jamais une phrase approximative)");
ok(routinesDues([{ ...base, declencheur: { type: "heure", heure: "00:10" } }], new Date(2026, 9, 26, 0, 20), [{ routine: "ma-routine", jour: "2026-10-25" }]).length === 1, "jour local : une routine de 00 h 10 déjà faite la veille repart le lendemain");
// Lancement
const histo = []; const ecrire = async (l) => histo.push(l);
let b = fauxBarriere(); let r = await lancerRoutine({ ...base, etapes: [{ outil: "lire_taches" }, { outil: "lire_agenda" }] }, { barriere: b, validerEtapes: async (i) => i.etapes.length === 2 && i.etapes[0].niveau === "LIBRE", ecrireHistorique: ecrire });
ok(r.issue === "terminee" && b.appels.length === 2 && b.appels.every((a) => a[1] === "lucien") && histo.length === 1, "routine validée : étapes dans l'ordre, une ligne d'historique");
b = fauxBarriere(); r = await lancerRoutine(base, { barriere: b, validerEtapes: async () => false, ecrireHistorique: ecrire });
ok(r.issue === "refusee" && b.appels.length === 0, "validation refusée : aucune étape ne part");
b = fauxBarriere(); r = await lancerRoutine(base, { barriere: b, ecrireHistorique: ecrire });
ok(r.issue === "annulee" && b.appels.length === 0 && /aucune fenêtre/.test(r.raison), "sans fenêtre de validation : rien ne s'exécute (exécution sans Lucien impossible)");
b = fauxBarriere(); r = await lancerRoutine(base, { barriere: b, validerEtapes: async () => "oui", ecrireHistorique: ecrire });
ok(r.issue === "refusee", "seul « vrai » vaut validation");
b = fauxBarriere(); r = await lancerRoutine(base, { barriere: b, validerEtapes: async () => true, verrouille: () => true, ecrireHistorique: ecrire });
ok(r.issue === "annulee" && /verrouillé/.test(r.raison) && b.appels.length === 0, "écran verrouillé : rien ne part");
b = fauxBarriere({ ajouter_tache: { ok: false, refus: { raison: "refuse_par_lucien" }, erreur: "Lucien a refusé cette action." } });
r = await lancerRoutine({ ...base, etapes: [{ outil: "lire_taches" }, { outil: "ajouter_tache", params: { texte: "x" } }, { outil: "lire_agenda" }] }, { barriere: b, validerEtapes: async () => true, ecrireHistorique: ecrire });
ok(r.issue === "interrompue" && r.etapes.length === 2 && r.etapes[1].statut === "refuse" && b.appels.length === 2, "étape CONFIRMATION refusée par Lucien : la routine s'arrête, la suivante ne part pas");
b = fauxBarriere({ lire_agenda: { ok: false, erreur: "panne" } });
r = await lancerRoutine({ ...base, etapes: [{ outil: "lire_agenda" }, { outil: "lire_taches" }] }, { barriere: b, validerEtapes: async () => true, ecrireHistorique: ecrire });
ok(r.issue === "interrompue" && r.etapes[0].statut === "erreur" && b.appels.length === 1, "erreur d'une étape : arrêt net, trace dans l'historique");
r = await lancerRoutine({ ...base, etapes: [{ outil: "memoriser" }] }, { barriere: fauxBarriere(), validerEtapes: async () => true, ecrireHistorique: ecrire });
ok(r.issue === "annulee" && /invalide/.test(r.raison), "routine devenue invalide (outil exclu) : annulée avant toute étape");
ok(histo.length === 8 && histo.every((l) => l.id && l.debut && l.fin && l.issue), "chaque passage, même refusé, laisse une ligne d'historique complète");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
