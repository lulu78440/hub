// Essais du moteur at-radar-donnees (export entièrement factice).
import { controler, jourValide, urlComparable } from "../../../js/widgets/moteurs/at-radar-donnees.js";
import { vrai, egal, fin } from "./_outil.mjs";

const NOW = Date.UTC(2026, 9, 25, 12);
const propre = {
  format: "hub-donnees", formatVersion: 1, exportedAt: "2026-10-24T10:00:00Z",
  data: {
    notes: [{ id: "n1", text: "Idée : voir https://exemple.test/a", created: NOW - 1e6 }],
    tasks: [{ id: "t1", text: "Arroser", done: false, due: "2026-10-30", remindAt: "2026-10-30T09:00", created: NOW - 1e6 }],
    events: [{ id: "e1", title: "Dentiste fictif", date: "2026-11-02", start: "09:00", end: "09:30" }],
    favs: [{ id: "f1", url: "https://exemple.test/", title: "Exemple" }],
    kv: [{ id: "radar-dates", v: [] }], images: [{ id: "i1", blob: "data:image/png;base64,AAAA" }],
  }, prefs: {},
};
const r0 = controler(propre, { maintenant: NOW });
vrai(r0.ok && r0.problemes.length === 0, "export propre : aucun problème");
egal(r0.resume, "Tout est en ordre (6 éléments contrôlés).", "résumé propre");
egal(controler(JSON.stringify(propre), { maintenant: NOW }).ok, true, "accepte le texte du fichier");
egal(controler("﻿" + JSON.stringify(propre), { maintenant: NOW }).ok, true, "accepte le BOM du Bloc-notes");

vrai(jourValide("2028-02-29") && !jourValide("2026-02-29") && !jourValide("2026-13-01") && !jourValide("26-1-1"), "jours valides");
egal(urlComparable("HTTP://www.Exemple.test/page/#haut"), "exemple.test/page", "adresse comparable");

const abime = JSON.parse(JSON.stringify(propre));
abime.exportedAt = "2026-09-01T10:00:00Z";
abime.data.notes.push({ id: "n2", text: "idee : voir   https://exemple.test/a" }, { id: "n3", text: "  " }, { id: "n4", text: "clic javascript:alert(1)" });
abime.data.tasks.push({ id: "t1", text: "Copie" }, { text: "sans id" }, { id: "t3", text: "x", due: "2026-02-30" }, { id: "t4", text: "y", remindAt: "demain" }, { id: "t5", text: "z", done: true });
abime.data.events.push({ id: "e2", title: "", date: "2026-11-31" }, { id: "e3", title: "Sans date" }, { id: "e4", title: "Envers", date: "2026-11-03", start: "18:00", end: "17:00" }, { id: "e5", title: "Dentiste fictif", date: "2026-11-02", start: "09:00" });
abime.data.favs.push({ id: "f2", url: "http://www.exemple.test", title: "Doublon http" }, { id: "f3", url: "ftp://x.test", title: "FTP" }, { id: "f4", url: "", title: "Vide" });
abime.data.images.push({ id: "i2" });
abime.data.kv = "abîmé";
abime.data.notes[0].created = NOW + 10 * 86400000;
const r = controler(abime, { maintenant: NOW });
const a = (col, type, id) => r.problemes.some((p) => p.collection === col && p.type === type && (id == null || p.id === id));
vrai(!r.ok, "export abîmé : pas ok");
vrai(a("export", "sauvegarde"), "sauvegarde trop vieille");
vrai(a("notes", "doublon", "n2"), "note en double (casse, accents, espaces)");
vrai(a("notes", "manquant", "n3"), "note vide");
vrai(a("notes", "lien", "n4") && r.problemes.find((p) => p.id === "n4").gravite === "erreur", "lien javascript: dangereux");
vrai(a("notes", "date", "n1"), "date de création dans le futur");
vrai(a("tasks", "doublon", "t1"), "identifiant en double");
vrai(a("tasks", "manquant", null), "tâche sans identifiant");
vrai(a("tasks", "date", "t3") && a("tasks", "date", "t4"), "échéance 30 février et rappel invalide");
vrai(a("tasks", "manquant", "t5"), "tâche faite sans date de fin");
vrai(a("events", "date", "e2") && a("events", "manquant", "e2"), "31 novembre et titre manquant");
vrai(a("events", "manquant", "e3"), "rendez-vous sans date");
vrai(a("events", "date", "e4"), "finit avant de commencer");
vrai(a("events", "doublon", "e5"), "rendez-vous en double");
vrai(a("favs", "doublon", "f2") && a("favs", "lien", "f2"), "favori en double et non https");
vrai(a("favs", "lien", "f3") && a("favs", "manquant", "f4"), "favori ftp et favori vide");
vrai(a("images", "manquant", "i2"), "image sans contenu");
vrai(a("kv", "format"), "collection abîmée");
egal(r.problemes[0].gravite, "erreur", "erreurs en tête du rapport");
vrai(r.texte.split("\n").length === r.problemes.length + 1 && r.texte.includes("✖"), "rapport lisible ligne par ligne");
vrai(!controler(null).ok && !controler("pas du json").ok && !controler({ format: "autre" }).ok, "fichiers étrangers refusés");
vrai(controler({ format: "hub-donnees", data: {} }, { maintenant: NOW }).problemes.some((p) => p.message.includes("sa date")), "export sans date signalé");
fin("at-radar-donnees");
