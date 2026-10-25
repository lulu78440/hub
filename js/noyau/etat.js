// Noyau · humeur de fond et ton (contrat, section 4.8). Un état interne qui colore les réponses, sans prétendre ressentir.
// Valeur lente entre « calme » (0) et « vif » (1), nourrie par l'heure, l'humeur du jour notée par Lucien, les tâches accomplies et
// l'activité récente. Elle règle la longueur et l'énergie des réponses ; l'orbe prend sa couleur. Aucun pourcentage d'émotion n'est affiché.
import { hote } from "./hote.js";

const DOUX = /\b(fatigue|epuise|crevé|creve|contrarie|enerve|stresse|anxieux|angoisse|triste|decourage|deprime|pas bien|ca va pas|ras-le-bol|nul aujourd)\w*/;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const jourDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function creerEtat() {
  let activite = 0, derniere = 0, doux = 0, humeurJour = null, faitesAuj = 0, enRetard = 0, tot = 0;
  const heure = () => hote.maintenant().getHours() + hote.maintenant().getMinutes() / 60;
  const e = {
    /** Relit les données du hub qui nourrissent l'humeur (rituels, tâches). */
    async rafraichir() {
      try {
        const j = jourDe(hote.maintenant());
        const rit = await hote.stockage.lire("kv", "rit-" + j); humeurJour = rit && rit.mood ? rit.mood : null;
        const t = await hote.stockage.tout("tasks"); tot = t.length;
        faitesAuj = t.filter((x) => x.done && x.doneAt && jourDe(new Date(x.doneAt)) === j).length;
        enRetard = t.filter((x) => !x.done && x.due && x.due < j).length;
      } catch (err) { /* humeur neutre */ }
    },
    noter(ev) {
      const t = hote.maintenant().getTime();
      if (ev.type === "echange") { activite = Math.min(activite * Math.pow(0.5, (t - derniere) / 36e5) + 1, 8); derniere = t; if (ev.texte && DOUX.test(norm(ev.texte))) doux = t; }
    },
    /** Lucien semble fatigué ou contrarié (mot dans un message, ou humeur du jour basse) : on ralentit et on ne pousse rien. */
    get doux() { return (humeurJour != null && humeurJour <= 2) || (doux && hote.maintenant().getTime() - doux < 4 * 36e5); },
    humeur() {
      const h = heure(), t = hote.maintenant().getTime();
      let v = 0.5;
      v += h >= 21 || h < 7 ? -0.25 : h >= 18 ? -0.1 : h >= 9 && h < 12 ? 0.1 : 0;                // plus posé le soir
      if (humeurJour != null) v += (humeurJour - 3) * 0.08;
      v += Math.min(faitesAuj, 5) * 0.04;
      v += Math.min(activite * Math.pow(0.5, (t - derniere) / 36e5), 4) * 0.03;
      v = Math.min(Math.max(v, 0), 1);
      let libelle = v < 0.35 ? "calme" : v < 0.65 ? "curieux" : "enthousiaste";
      if (enRetard >= 3 && v < 0.6) libelle = "vigilant";
      if (e.doux) libelle = "preoccupe";
      return { valeur: Math.round(v * 100) / 100, libelle };
    },
    /** Consigne ajoutée aux instructions du modèle. */
    consigne() {
      const h = e.humeur(), x = heure(), l = [];
      if (e.doux) l.push("Lucien semble fatigué ou contrarié : réponses courtes et douces, propose peu, ne pousse aucune tâche.");
      else if (h.valeur < 0.35) l.push("Humeur de fond posée : réponses calmes et brèves.");
      else if (h.valeur > 0.65) l.push("Humeur de fond vive : un peu plus d'énergie est bienvenue, sans en faire trop.");
      if (x >= 22 || x < 7) l.push("Il est tard dans la nuit : sois bref et paisible.");
      return l.join(" ") || "Humeur de fond neutre.";
    }
  };
  return e;
}
