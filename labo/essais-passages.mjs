// Laboratoire · essais de la recherche par passages : `node labo/essais-passages.mjs`
import { decouperPassages, empreinte, creerIndexPassages } from "../js/noyau/passages.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const long = Array.from({ length: 30 }, (_, i) => `Phrase numéro ${i} qui parle de sujets variés comme le jardinage et la cuisine du dimanche.`).join(" ");
const ps = decouperPassages(long, { mots: 40 });
ok(ps.length > 3 && ps.every((p) => p.split(/\s+/).length <= 60), "un long texte est coupé en passages courts (" + ps.length + ")");
ok(ps[1].startsWith(ps[0].split(/(?<=\.)\s+/).pop().slice(0, 20)), "un passage reprend la dernière phrase du précédent (le contexte ne se perd pas à la coupe)");
ok(decouperPassages("").length === 0 && decouperPassages(null).length === 0 && decouperPassages("Une seule phrase.").length === 1, "texte vide ou court sans plantage");
ok(empreinte("abc") === empreinte("abc") && empreinte("abc") !== empreinte("abd"), "empreinte stable, sensible aux changements");
const ix = creerIndexPassages({ mots: 40 });
const docs = [{ id: "journal", texte: long + " Le thé vert de Kyoto se prépare à 70 degrés pendant deux minutes. " + long }, { id: "cuisine", texte: "Recette de crêpes : farine, lait, oeufs. Le thé se sert avec des crêpes." }, { id: "voyage", texte: "Kyoto est une ville du Japon. Le thé y est une tradition. Prévoir un budget de 2500 euros." }];
let b = ix.maj(docs); ok(b.ajoutes === 3 && ix.taille > 8, "premier passage : 3 documents indexés (" + ix.taille + " passages)");
let r = await ix.chercher("température du thé vert de Kyoto");
ok(r[0].doc === "journal" && /70 degrés/.test(r[0].extrait) && r[0].extrait.split(/\s+/).length < 80, "le passage utile ressort, pas le document entier : « " + r[0].extrait.slice(0, 60) + "… »");
ok(new Set(r.slice(0, 3).map((x) => x.doc)).size === Math.min(3, r.length), "en tête, un passage par document (diversité)");
b = ix.maj(docs); ok(b.inchanges === 3 && b.ajoutes === 0 && b.modifies === 0, "rien n'a changé : rien n'est réindexé");
b = ix.maj([docs[0], { id: "cuisine", texte: "Recette de crêpes modifiée avec du sucre." }, docs[2]]); ok(b.modifies === 1 && b.inchanges === 2, "un document modifié : lui seul est réindexé");
r = await ix.chercher("sucre crêpes"); ok(r[0].doc === "cuisine" && /sucre/.test(r[0].extrait), "la nouvelle version est trouvée");
b = ix.maj([docs[0]]); ok(b.retires === 2, "documents disparus : retirés de l'index");
r = await ix.chercher("budget Japon"); ok(r.length === 0 || !r.some((x) => x.doc === "voyage"), "un document retiré ne ressort plus");
// Second tri : termes proches > termes dispersés
const ix2 = creerIndexPassages(); ix2.maj([{ id: "dispersé", texte: "Le chat dort. " + "Mot ".repeat(30) + "Le canapé est rouge." }, { id: "proche", texte: "Le chat noir dort sur le canapé du salon." }]);
r = await ix2.chercher("chat canapé"); ok(r[0].doc === "proche", "second tri : termes de la question proches l'un de l'autre passent devant");
ok((await ix2.chercher("")).length === 0 && (await ix2.chercher("zzzz")).length === 0, "question vide ou sans résultat : liste vide");
let appel = 0; const ix3 = creerIndexPassages({ reclasser: async (q, res) => { appel++; return [...res].reverse(); } }); ix3.maj([{ id: "a", texte: "Alpha beta gamma." }, { id: "b", texte: "Alpha delta." }]);
r = await ix3.chercher("alpha"); ok(appel === 1 && r.length === 2, "point d'accroche pour la recherche par le sens (reclasser)");
const ix4 = creerIndexPassages({ reclasser: async () => { throw new Error("modèle absent"); } }); ix4.maj([{ id: "a", texte: "Alpha beta." }]);
ok((await ix4.chercher("alpha")).length === 1, "si le modèle de sens échoue : retour au classement par mots");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
