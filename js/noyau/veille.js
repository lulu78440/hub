// Noyau · veille d'étude : laisser l'appareil allumé et branché, le Noyau étudie seul le programme et prépare un rapport du matin.
//  - Opt-in (coupée par défaut), enclenchée par un geste de Lucien dans Réglages. Écran maintenu allumé (Wake Lock) tant qu'elle est active.
//  - Une étude (une recherche dans les sources autorisées, résumé local, 0 requête de modèle) toutes les 8 minutes, au plus 40 par jour.
//  - Garde-fous : s'arrête si hors ligne, si la batterie passe sous 20 % hors charge, si « À valider » compte déjà 20 propositions.
//  - Rien n'est appris ni validé sans Lucien : les fiches attendent dans « À valider ». Le Noyau ne touche pas au code.
//  - Rapport du matin : un résumé des études faites depuis le dernier rapport (fiches proposées, sujets, ce qui a bloqué).
const jourDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const VEILLE = { intervalleMs: 8 * 60e3, maxJour: 40, maxAValider: 20, batterieMin: 0.2, gardeJours: 14 };

export function creerVeille({ savoir, memoire, lire, ecrire, maintenant = () => new Date(), enLigne = () => true, batterie = async () => null, verrou = null, emettre = () => {} }) {
  let verrouActif = null, derniere = 0;
  const actif = () => lire("veille") === "on";
  const journal = () => { try { return JSON.parse(lire("veille-journal") || "{}") || {}; } catch (e) { return {}; } };
  const noter = (j) => { const ks = Object.keys(j).sort(); while (ks.length > VEILLE.gardeJours) delete j[ks.shift()]; ecrire("veille-journal", JSON.stringify(j)); };
  const entree = (j, jour) => (j[jour] = j[jour] || { etudes: 0, fiches: 0, themes: [], arrets: {} });

  async function prendreVerrou() { if (verrou && !verrouActif) { try { verrouActif = await verrou.prendre(); } catch (e) { verrouActif = null; } } return !!verrouActif; }
  async function lacherVerrou() { if (verrouActif) { try { await verrou.lacher(verrouActif); } catch (e) { /* déjà libéré */ } verrouActif = null; } }

  const api = {
    actif,
    async activer(on) { ecrire("veille", on ? "on" : "off"); if (on) await prendreVerrou(); else await lacherVerrou(); return api.statut(); },
    /** À rappeler quand la page redevient visible : le navigateur libère le verrou d'écran quand l'onglet est masqué. */
    async reprendre() { if (actif()) { verrouActif = null; await prendreVerrou(); } },
    statut() { const jour = jourDe(maintenant()), e = journal()[jour] || { etudes: 0, fiches: 0 }; return { actif: actif(), ecranAllume: !!verrouActif, aujourdhui: { etudes: e.etudes, fiches: e.fiches }, maxJour: VEILLE.maxJour, prochainDans: derniere ? Math.max(0, VEILLE.intervalleMs - (maintenant().getTime() - derniere)) : 0 }; },
    /** Une étude, si tous les garde-fous passent. Appelée toutes les quelques minutes par noyau.js. */
    async cycle() {
      if (!actif()) return { fait: false, raison: "veille coupée" };
      const t = maintenant().getTime(), j = journal(), e = entree(j, jourDe(maintenant()));
      const stop = (raison, cle) => { e.arrets[cle] = (e.arrets[cle] || 0) + 1; noter(j); return { fait: false, raison }; };
      if (t - derniere < VEILLE.intervalleMs) return { fait: false, raison: "pas encore l'heure" };
      if (!enLigne()) return stop("hors ligne", "horsligne");
      const b = await batterie().catch(() => null);
      if (b && !b.charge && b.niveau < VEILLE.batterieMin) return stop("batterie sous 20 % hors charge", "batterie");
      if (e.etudes >= VEILLE.maxJour) return stop(`${VEILLE.maxJour} études atteintes aujourd'hui`, "plafond");
      if (memoire.aValider().length >= VEILLE.maxAValider) return stop("la boîte « À valider » est pleine : valide d'abord", "pleine");
      const exclu = Object.keys(e.themes.reduce((o, x) => ((o[x] = 1), o), {}));
      const p = savoir.prochain(undefined, { exclure: exclu });
      if (!p) return stop("rien de nouveau à étudier aujourd'hui", "rien");
      derniere = t;
      let r; try { r = await savoir.etudier(p.sousTheme, { origine: "autonome" }); } catch (x) { r = { ok: false, erreur: String((x && x.message) || x), propose: 0 }; }
      e.etudes++; e.themes.push(p.sousTheme); e.titres = (e.titres || []).concat(p.titre).slice(-40);
      if (r.ok) e.fiches += r.propose || 0; else e.arrets.erreur = (e.arrets.erreur || 0) + 1;
      noter(j);
      return { fait: true, sujet: p.titre, domaine: p.domaineNom, trouve: r.ok ? r.propose : 0, erreur: r.ok ? null : r.erreur };
    },
    /** Rapport des études non encore rapportées. null s'il n'y en a pas. */
    rapport() {
      const j = journal(), vu = lire("veille-vu") || "", jours = Object.keys(j).sort().filter((k) => k > vu && j[k].etudes > 0);
      if (!jours.length) return null;
      const etudes = jours.reduce((a, k) => a + j[k].etudes, 0), fiches = jours.reduce((a, k) => a + j[k].fiches, 0);
      const titres = [...new Set(jours.flatMap((k) => j[k].titres || []))].slice(0, 5);
      const bloque = {}; for (const k of jours) for (const [c, n] of Object.entries(j[k].arrets)) bloque[c] = (bloque[c] || 0) + n;
      const MOT = { pleine: "boîte « À valider » pleine", batterie: "batterie faible", horsligne: "hors ligne", plafond: "plafond du jour atteint", erreur: "recherches en échec", rien: "plus rien de neuf" };
      const arrets = Object.entries(bloque).filter(([c]) => MOT[c]).map(([c, n]) => `${MOT[c]} (${n})`);
      const att = memoire.aValider().length;
      const texte = `Rapport de veille : ${etudes} étude${etudes > 1 ? "s" : ""}, ${fiches} fiche${fiches > 1 ? "s" : ""} proposée${fiches > 1 ? "s" : ""}${titres.length ? " (" + titres.join(", ") + ")" : ""}.` +
        (arrets.length ? ` Arrêts : ${arrets.join(", ")}.` : "") + (att ? ` ${att} proposition${att > 1 ? "s" : ""} attend${att > 1 ? "ent" : ""} ta validation dans « À valider ».` : "");
      return { texte, etudes, fiches, jours, derniereDate: jours[jours.length - 1] };
    },
    marquerVu(r) { if (r && r.derniereDate) ecrire("veille-vu", r.derniereDate); }
  };
  return api;
}
