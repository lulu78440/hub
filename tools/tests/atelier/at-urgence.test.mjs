// Essais du moteur at-urgence (fiche entièrement factice, numéros 06 00 00 00 0x non attribués).
import { normaliserTelephone, telephoneValide, afficherTelephone, ficheVide, normaliser, valider, exporterTexte, VERSION } from "../../../js/widgets/moteurs/at-urgence.js";
import { vrai, egal, fin } from "./_outil.mjs";

egal([normaliserTelephone("06 00.00-00 01"), normaliserTelephone("+33 (6) 00 00 00 02"), normaliserTelephone("abc")], ["0600000001", "+33600000002", ""], "téléphones normalisés");
egal(["06 00 00 00 01", "+33600000002", "112", "0600", "00 00 00 00 00", "+1"].map(telephoneValide), [true, true, true, false, false, false], "téléphones valides ou non");
egal([afficherTelephone("0600000001"), afficherTelephone("+33600000002"), afficherTelephone("+441234567890")], ["06 00 00 00 01", "+33 6 00 00 00 02", "+441234567890"], "affichage des téléphones");
const vide = ficheVide();
vrai(vide.version === VERSION && Array.isArray(vide.contacts) && vide.contacts.length === 0, "fiche vide prête à remplir");

const F = {
  version: 1, maj: "2026-01-10",
  personne: { nom: "Exemple", prenom: "Camille", naissance: "1990-04-12", groupeSanguin: "o pos", poidsKg: 70 },
  contacts: [{ nom: "Alex Fictif", lien: "frère", telephone: "06 00 00 00 01" }, { nom: "Sam Fictif", lien: "amie", telephone: "+33 6 00 00 00 02", prioritaire: true }],
  allergies: [{ substance: "Pollen", gravite: "légère" }, { substance: "Arachide", reaction: "gonflement", gravite: "sévère" }],
  traitements: [{ nom: "Médicament fictif A", dose: "1 comprimé", frequence: "le matin" }],
  procedures: [{ titre: "En cas de réaction allergique", etapes: ["Appeler le 15", "Prévenir le contact prioritaire"] }],
  champInconnu: "x",
};
const n = normaliser(F);
egal([n.personne.groupeSanguin, n.contacts[0].telephone, n.allergies[1].gravite, "champInconnu" in n], ["O+", "0600000001", "severe", false], "normalisation : groupe, téléphone, gravité, champ inconnu retiré");
vrai(F.contacts[0].telephone === "06 00 00 00 01", "l'original n'est pas modifié");
egal(normaliser({ allergies: ["Latex", ""], traitements: ["Médicament B"], contacts: [{}] }).allergies.map((a) => a.substance), ["Latex"], "entrées texte simples acceptées, vides retirées");
const v = valider(F, { aujourdhui: "2026-10-25" });
egal([v.ok, v.erreurs, v.avertissements], [true, [], []], "fiche complète valide, sans avertissement");

const mauvaise = valider({ personne: { naissance: "1990-02-30", groupeSanguin: "Z+" }, contacts: [{ nom: "Sans tel" }, { telephone: "123" }], allergies: [{ substance: "Lait", gravite: "forte" }], procedures: [{ titre: "Vide", etapes: [] }] });
egal(mauvaise.ok, false, "fiche incomplète refusée");
for (const e of ["nom de la personne manquant", "date de naissance invalide (AAAA-MM-JJ)", "groupe sanguin « Z+ » non reconnu", "Sans tel : téléphone manquant", "contact 2 : nom manquant", "contact 2 : téléphone « 123 » invalide", "procédure « Vide » : aucune étape"])
  vrai(mauvaise.erreurs.includes(e), "erreur attendue : " + e);
vrai(mauvaise.erreurs.some((e) => e.includes("gravité « forte »")), "gravité inconnue refusée");
vrai(valider({ personne: { nom: "X" } }).erreurs.includes("au moins un contact d'urgence est nécessaire"), "contact obligatoire");
vrai(valider({ personne: { nom: "X", naissance: "2030-01-01" }, contacts: [] }, { aujourdhui: "2026-10-25" }).erreurs.includes("date de naissance dans le futur"), "naissance future refusée");
const av = valider({ version: 3, personne: { nom: "X" }, contacts: [{ nom: "A", telephone: "0600000001" }, { nom: "B", telephone: "06 00 00 00 01", prioritaire: true }, { nom: "C", telephone: "0600000003", prioritaire: true }], traitements: [{ nom: "T" }], maj: "2024-01-01" }, { aujourdhui: "2026-10-25" });
vrai(av.ok, "avertissements seuls : fiche acceptée");
for (const a of ["version 3 inconnue (lue comme version 1)", "groupe sanguin non renseigné", "A : lien (conjoint, parent, ami…) non précisé", "téléphone 06 00 00 00 01 en double", "plusieurs contacts prioritaires", "traitement « T » : dose non précisée", "fiche non relue depuis 1028 jours"])
  vrai(av.avertissements.includes(a), "avertissement attendu : " + a);
vrai(av.avertissements.some((a) => a.startsWith("aucune allergie saisie")), "absence d'allergie signalée (doute à lever)");
egal(valider(null).erreurs, ["fiche absente"], "fiche absente");

const t = exporterTexte(F);
vrai(t.startsWith("FICHE D'URGENCE\n===============\nCamille EXEMPLE\nné(e) le 12/04/1990 · groupe sanguin O+ · 70 kg"), "en-tête de l'export");
vrai(t.indexOf("!! ALLERGIE SÉVÈRE : Arachide !!") < t.indexOf("CONTACTS"), "allergie sévère en tête");
vrai(t.includes("1. Sam Fictif (amie) : +33 6 00 00 00 02 — à appeler en premier\n2. Alex Fictif (frère) : 06 00 00 00 01"), "contact prioritaire en premier");
vrai(t.includes("- Arachide [SÉVÈRE] : gonflement\n- Pollen [légère]"), "allergies triées par gravité");
vrai(t.includes("> En cas de réaction allergique\n  1. Appeler le 15"), "procédures numérotées");
vrai(t.includes("NUMÉROS D'URGENCE : 15 SAMU") && t.endsWith("Mise à jour : 10/01/2026"), "numéros publics et date de mise à jour");
vrai(!exporterTexte(F, { numeros: false }).includes("NUMÉROS D'URGENCE"), "numéros publics facultatifs");
const tv = exporterTexte({});
vrai(tv.includes("(nom non renseigné)") && tv.includes("- non renseignées") && tv.includes("- aucun renseigné"), "export d'une fiche vide lisible");
fin("at-urgence");
