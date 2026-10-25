// Noyau · sauvegarde automatique chiffrée vers un dossier du PC (File System Access API).
// Rien ne part sans que Lucien ait CHOISI le dossier. Le fichier est chiffré par le coffre quand le verrouillage est actif.
// Le Noyau n'a aucun outil pour exporter : cette fonction n'est appelée que par la fenêtre (bouton) et par la veille, une fois par jour.
import { hote } from "./hote.js";

const JOUR = 24 * 36e5;
export function creerSauvegarde() {
  const s = () => hote.sauvegarde || null;
  const api = {
    dispo: () => !!(s() && s().dispo()),
    async etat() {
      if (!api.dispo()) return { dispo: false, dossier: null, droit: "aucun", derniere: hote.reglage.lire("derniere-sauvegarde-auto", "") };
      return { dispo: true, dossier: await s().dossier(), droit: await s().droit(), derniere: hote.reglage.lire("derniere-sauvegarde-auto", "") };
    },
    async choisir() { return s().choisir(); },
    async retirer() { return s().retirer(); },
    /** Sauvegarde maintenant. `demander` : autorisé seulement depuis un clic (le navigateur exige un geste). */
    async maintenant({ demander = false } = {}) { return s().ecrire({ demander }); },
    /** Veille : une sauvegarde par jour, seulement si le dossier est déjà autorisé. Renvoie { fait, ... } ou { fait:false, raison, reautoriser }. */
    async auto() {
      if (!api.dispo()) return { fait: false, raison: "indisponible" };
      const e = await api.etat(); if (!e.dossier) return { fait: false, raison: "aucun dossier choisi" };
      const der = Date.parse(e.derniere); if (isFinite(der) && hote.maintenant().getTime() - der < JOUR) return { fait: false, raison: "déjà faite dans les 24 h" };
      if (e.droit !== "granted") return { fait: false, raison: "autorisation du dossier à renouveler", reautoriser: true };
      try { const r = await api.maintenant(); return { fait: true, ...r }; } catch (x) { return { fait: false, raison: x.message || String(x) }; }
    }
  };
  return api;
}
