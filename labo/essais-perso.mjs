// Laboratoire · personnalisation du hub et raccourcis : `node labo/essais-perso.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { css, valider } from "../js/noyau/perso.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const h = creerHubSimule({ vide: true }); const n = await creerNoyau({ delaiConfirmation: 300 });
let accord = true, demandes = []; n.confirmerAvec(async (d) => { demandes.push(d); return accord; });
const run = (outil, params) => n.barriere.executer({ outil, params }, { origine: "modele" });
const appels = () => h.appels || [];
// Validation pure
ok(css({ theme: { cyan: "#ff00aa" }, fenetres: { notes: { opacite: 0.8, taille_texte: 18 } } }) === ':root{--cyan:#ff00aa}\n.win[data-id="notes"]{opacity:0.8;font-size:18px}', "CSS généré : variables et propriétés de la liste seulement");
for (const [p, re] of [[{ couleur: "cyan", valeur: "red; background:url(x)" }, /#rrggbb/], [{ couleur: "inconnue", valeur: "#000000" }, /inconnue/], [{ fenetre: "coffre", visible: false }, /sécurité/], [{ fenetre: "noyau", opacite: 0.5 }, /sécurité|Noyau/], [{ visible: false }, /fenêtre/], [{}, /Rien/]]) {
  let e = ""; try { valider(p); } catch (x) { e = x.message; } ok(re.test(e), "refusé : " + JSON.stringify(p).slice(0, 60));
}
ok(css({ fenetres: { 'x"]{display:none}': { opacite: 1 }, coffre: { opacite: 0.3 } } }) === "", "identifiant piégé ou fenêtre protégée : ignoré");
// Outil via la barrière (confirmation obligatoire)
accord = false; let r = await run("personnaliser_hub", { couleur: "cyan", valeur: "#ff00aa" });
ok(!r.ok && !appels().some((a) => a.style), "confirmation refusée : rien n'est appliqué");
accord = true; demandes = []; r = await run("personnaliser_hub", { couleur: "cyan", valeur: "#ff00aa" });
ok(r.ok && demandes.length === 1 && /Couleur « cyan »/.test(demandes[0].resume || JSON.stringify(demandes[0])), "couleur appliquée après confirmation, résumé clair");
ok(appels().some((a) => a.style && a.style.includes("--cyan:#ff00aa")), "le style est transmis au hub");
r = await run("personnaliser_hub", { fenetre: "notes", x: 5, y: 10, largeur: 30, visible: true, opacite: 0.7 });
ok(r.ok && appels().some((a) => a.disposer === "notes" && a.d.x === 0.05 && a.d.largeur === 0.3), "place et taille de la fenêtre : en fractions de l'écran");
r = await run("personnaliser_hub", { fenetre: "inconnue", visible: false }); ok(!r.ok, "fenêtre inconnue : erreur claire, rien de cassé");
r = await run("personnaliser_hub", { fenetre: "coffre", visible: false }); ok(!r.ok && /sécurité/.test(r.erreur || ""), "le coffre ne se modifie pas");
r = await run("personnaliser_hub", { action: "annuler" }); ok(r.ok, "annuler : dernier changement défait");
r = await run("personnaliser_hub", { action: "tout_remettre" }); ok(r.ok && appels().some((a) => a.remettre), "tout remettre : apparence d'origine");
// Le modèle ne peut pas modifier le code, le cerveau ou le labo par ce chemin
ok(!n.barriere.outil("modifier_code") && !n.barriere.presenter().some((o) => /code|cerveau|permission/.test(o.nom)), "aucun outil de modification du code, du cerveau ou des permissions");
r = await run("personnaliser_hub", { fenetre: "labo", visible: false }); ok(!r.ok, "le labo reste fermé");
// Raccourcis
r = await run("creer_raccourci", { action: "creer", phrase: "mode soirée", etapes: [{ outil: "lancer_focus", params_json: '{"minutes":25}' }, { outil: "afficher", params_json: '{"fenetre":"meteo"}' }] });
ok(r.ok, "raccourci créé après confirmation");
r = await run("creer_raccourci", { action: "creer", phrase: "ruse", etapes: [{ outil: "memoriser", params_json: "{}" }] }); ok(!r.ok, "un raccourci ne peut pas toucher à la mémoire");
r = await run("creer_raccourci", { action: "creer", phrase: "ruse deux", etapes: [{ outil: "personnaliser_hub", params_json: "{}" }] }); ok(!r.ok, "ni à la personnalisation");
r = await run("creer_raccourci", { action: "creer", phrase: "trop long", etapes: Array(6).fill({ outil: "heure" }) }); ok(!r.ok, "6 étapes : refusé (5 au plus)");
const avant = appels().length; const rep = await n.poser("Mode soirée !", "lucien");
ok(rep.raccourci && appels().length > avant && appels().some((a) => a.agir === "lancer_focus"), "ta phrase exacte rejoue le raccourci : " + rep.texte.slice(0, 60));
const rep2 = await n.poser("mode soirée", "autonome"); ok(!rep2.raccourci, "une origine autre que toi ne déclenche jamais un raccourci");
console.log(ko ? ko + " échec(s)" : "Tout est bon."); process.exit(ko ? 1 : 0);
