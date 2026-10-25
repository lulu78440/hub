// Laboratoire · essais de la sauvegarde automatique : `node labo/essais-sauvegarde.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const h = creerHubSimule({ vide: true }); const n = await creerNoyau(); const sv = n.sauvegarde;
let r = await sv.auto(); ok(!r.fait && /aucun dossier/.test(r.raison), "sans dossier choisi : rien n'est écrit");
await sv.choisir(); let e = await sv.etat(); ok(e.dossier && e.dossier.nom === "Sauvegardes-fictives", "dossier choisi par Lucien");
r = await sv.auto(); ok(r.fait && /^hub-sauvegarde-/.test(r.nom), "première sauvegarde automatique : " + r.nom);
r = await sv.auto(); ok(!r.fait && /24 h/.test(r.raison), "une seule par jour");
h.avancer(25 * 36e5); h.definirDroitDossier("prompt"); r = await sv.auto(); ok(!r.fait && r.reautoriser, "autorisation perdue : demande de réautoriser, aucune écriture");
r = await sv.maintenant({ demander: true }); ok(r.nom, "depuis un clic, l'autorisation est redemandée et la sauvegarde passe");
const ex = await n.exporter(); ok(ex && ex.nom, "le bouton « Exporter maintenant » utilise le dossier choisi");
await sv.retirer(); e = await sv.etat(); ok(!e.dossier, "« Oublier ce dossier »");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
