// Noyau · la perception (contrat, section 4.1) : un court « état du monde » assemblé en local, sans aucune requête.
// Au plus 5 lignes, et seulement ce qui sert la question.
import { hote } from "./hote.js";
import { jetons, normaliser } from "./recherche.js";
import { depuis } from "./actualite.js";

const jourDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const T = {
  agenda: /\b(agenda|rendez-?vous|rdv|reunion|planning|semaine|demain|aujourd|journee|soiree|prevu|programme|libre|dispo|organis)\w*/,
  taches: /\b(tache|todo|faire|retard|urgent|prioris|organis|journee|planning|productif|avancer|aujourd)\w*/,
  meteo: /\b(meteo|temps|pluie|pleut|soleil|froid|chaud|temperature|parapluie|sortir|veste|vent)\w*/,
  humeur: /\b(humeur|fatigue|moral|habitude|sport|eau|rituel|forme|ca va|comment (tu )?vas)\w*/,
  actu: /\b(actu|actualite|nouveau|nouvelle|news|quoi de neuf|se passe|derniere|recent|aujourd)\w*/,
  veille: /\b(site|panne|en ligne|veille|down|tombe)\w*/
};

export function creerPerception({ actualite, etat }) {
  return {
    async contexte(question) {
      const q = normaliser(question), qt = new Set(jetons(question)), now = hote.maintenant(), j = jourDe(now), L = [];
      const add = (score, texte) => { if (texte) L.push({ score, texte }); };
      const h = now.getHours(), part = h < 6 ? "nuit" : h < 12 ? "matin" : h < 18 ? "après-midi" : h < 22 ? "soir" : "nuit";
      const we = [0, 6].includes(now.getDay()) ? "week-end" : "en semaine";
      add(0.5, `Il est ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} (${part}, ${we}).`);
      if (!hote.enLigne()) add(0.9, "Le hub est hors ligne : pas de recherche sur le web ni d'appel à Gemini possible.");
      const [ev, ta, kv] = await Promise.all([hote.stockage.tout("events"), hote.stockage.tout("tasks"), hote.stockage.tout("kv")]);
      const rel = (re) => (re.test(q) ? 1 : 0);
      // Agenda
      const hhmm = now.toTimeString().slice(0, 5);
      const proches = ev.filter((e) => e.date === j && (!e.start || e.start >= hhmm) || e.date === jourDe(new Date(now.getTime() + 864e5))).sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || ""))).slice(0, 3);
      if (proches.length) add(0.35 + 0.6 * rel(T.agenda), "Prochains rendez-vous : " + proches.map((e) => `${e.date === j ? "aujourd'hui" : "demain"}${e.start ? " " + e.start : ""} ${e.title}`).join(" ; ") + ".");
      // Tâches
      const afaire = ta.filter((t) => !t.done), retard = afaire.filter((t) => t.due && t.due < j), urg = afaire.filter((t) => t.prio);
      if (afaire.length) add(0.25 + 0.65 * rel(T.taches), `Tâches : ${afaire.length} à faire${retard.length ? `, ${retard.length} en retard` : ""}${urg.length ? `, urgentes : ${urg.slice(0, 2).map((t) => t.text).join(" ; ")}` : ""}.`);
      // Météo
      const m = hote.hub.meteo(), c = m && m.data && m.data.current;
      if (c) add(0.2 + 0.7 * rel(T.meteo), `Météo${m.name ? " à " + m.name : ""} : ${Math.round(c.temperature_2m)} °C.`);
      // Humeur, habitudes
      const rit = kv.find((x) => x.id === "rit-" + j), cfg = kv.find((x) => x.id === "rituels-config");
      if (rit || cfg) {
        const hab = ((cfg && cfg.habits) || []).map((x) => `${x.name} ${(rit && rit.counts && rit.counts[x.id]) || 0}/${x.goal}`).join(", ");
        add(0.15 + 0.7 * rel(T.humeur), `${rit && rit.mood ? `Humeur du jour notée : ${rit.mood}/5. ` : ""}${hab ? "Habitudes : " + hab + "." : ""}`.trim());
      }
      // Mode Focus, fenêtre, vidéo (si le hub les fournit)
      const live = hote.hub.contexteLive ? hote.hub.contexteLive() : null;
      if (live && live.focus) add(0.8, "Lucien est en mode Focus : sois bref et ne propose rien d'autre.");
      if (live && live.fenetre) add(0.3, `Fenêtre survolée ou ouverte : ${live.fenetre}.`);
      // Actualité
      const f = hote.hub.actus();
      if (f && f.actus && f.actus.length) {
        const liés = actualite.pour(question, 3), voulu = T.actu.test(q);
        const ts = liés.length ? liés : voulu ? actualite.recents(3) : [];
        if (ts.length) add(0.5 + 0.45 * (liés.length ? 1 : 0), `Actualité du flux du hub (généré ${depuis(f.genere)}) : ${ts.map(actualite.fmt).join(" ; ")}.`);
      }
      const panne = ((f && f.sites) || []).filter((s) => !s.ok);
      if (panne.length) add(0.2 + 0.7 * rel(T.veille), `Sites en panne : ${panne.map((s) => s.nom).join(", ")}.`);
      if (etat && etat.doux) add(0.85, "Lucien semble fatigué ou contrarié.");
      // Les 5 meilleures lignes utiles, dans un ordre stable
      return L.filter((x) => x.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 5).map((x) => x.texte);     // seulement ce qui sert la question
    }
  };
}
