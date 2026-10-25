// Laboratoire · essais des usages du quotidien : `node labo/essais-usages.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { parseQuand } from "../js/noyau/usages.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const base = new Date(2026, 9, 26, 9, 0, 0);       // lundi 26 octobre 2026, 9 h
const q = (t) => parseQuand(t, base);
let r = q(" demain à 9 h d'appeler le garage"); ok(r.date === "2026-10-27" && r.heure === "09:00" && r.reste === "Appeler le garage", "demain à 9 h d'appeler le garage → " + JSON.stringify(r));
r = q("lundi 14h30 envoyer le devis"); ok(r.date === "2026-11-02" && r.heure === "14:30" && /^Envoyer le devis/.test(r.reste), "lundi 14h30 → lundi suivant " + JSON.stringify(r));
r = q("dans 2 heures de sortir le pain"); ok(r.date === "2026-10-26" && r.heure === "11:00" && r.reste === "Sortir le pain", "dans 2 heures → 11:00 " + JSON.stringify(r));
r = q("le 12 novembre de payer l'assurance"); ok(r.date === "2026-11-12" && !r.heure && r.reste === "Payer l'assurance", "le 12 novembre " + JSON.stringify(r));
r = q("ce soir de lancer une lessive"); ok(r.date === "2026-10-26" && r.heure === "19:00" && r.reste === "Lancer une lessive", "ce soir → 19:00 " + JSON.stringify(r));
r = q("à 8h de courir"); ok(r.date === "2026-10-27" && r.heure === "08:00", "8 h déjà passée → demain " + JSON.stringify(r));
r = q("de faire quelque chose"); ok(!r.date && !r.heure, "sans date ni heure : rien d'inventé");

creerHubSimule({ maintenant: base });
const n = await creerNoyau(); n.confirmerAvec(async () => true);
const dire = async (t) => (await n.poser(t)).texte;
let t = await dire("Note : idée de cadeau pour Paul, un livre de cuisine"); ok(/Note ajoutée/.test(t), "capture « Note : » → " + t);
t = await dire("Tâche : acheter du pain demain"); ok(/Tâche ajoutée pour/.test(t), "capture « Tâche : » avec date → " + t);
t = await dire("Retiens que je prends mon café sans sucre"); ok(/retenu/.test(t) && n.memoire.tous({ archive: false }).some((x) => x.type === "sem" && /sans sucre/.test(x.texte)), "« Retiens que… » écrit un fait confirmé");
t = await dire("Rappelle-moi demain à 9 h d'appeler le notaire"); ok(/Rappel créé/.test(t) && /09:00/.test(t), "rappel complet → " + t);
t = await dire("Rappelle-moi d'appeler le notaire"); ok(/Pour quand/.test(t), "rappel sans date : demande de précision");
t = await dire("Rappelle-moi vendredi d'appeler le notaire"); ok(/Tâche ajoutée pour/.test(t) && /heure/.test(t), "rappel sans heure : tâche + invitation à préciser");
n.confirmerAvec(async () => false);
const avant = n.memoire.tous({ archive: false }).length; t = await dire("Retiens que j'aime la pluie"); ok(/refusé/.test(t) && n.memoire.tous({ archive: false }).length === avant, "refus : rien n'est enregistré");
n.confirmerAvec(async () => true);
t = await dire("Briefing"); ok(/tâche/.test(t) && /Agenda|rendez-vous/.test(t) && t.split("\n").length >= 3, "briefing composé localement :\n" + t);
t = await dire("Fais ma revue de fin de journée"); ok(/Revue/.test(t) && /demain/i.test(t), "revue du soir :\n" + t);
t = await dire("Cherche partout garage"); ok(/résultat/.test(t) && /Tâches/.test(t), "recherche globale :\n" + t);
t = await dire("Cherche partout zzqxv"); ok(/Rien trouvé/.test(t), "recherche sans résultat : le dit honnêtement");
ok(n.budget.utilisees() === 0, "aucune requête Gemini utilisée (" + n.budget.utilisees() + ")");
const hs = creerHubSimule({ maintenant: new Date(2026, 9, 26, 19, 0) }); const n2 = await creerNoyau(); const vus = []; n2.surMessage((m) => { if (m.type === "initiative") vus.push(m); });
ok(n2.suggererRevue() === true && vus[0].action === "revue", "le soir (19 h) : le Noyau propose la revue de fin de journée");
ok(n2.suggererRevue() === false, "une seule fois par jour");
hs.fixer(new Date(2026, 9, 27, 10, 0)); ok(n2.suggererRevue() === false, "jamais en pleine matinée");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
