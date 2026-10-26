// Noyau · tableau de performance de l'IA locale (lab-perf) : vitesse, mémoire, batterie si le navigateur la donne.
// Honnête : une mesure absente est « non disponible », jamais inventée. Aucune donnée n'est envoyée. Les sources (navigator, performance) sont injectables.
export function creerMesures({ maintenant = () => performance.now(), max = 50 } = {}) {
  const lignes = [];
  return {
    /** Démarre la mesure d'une réponse ; appeler `.mot()` à chaque mot reçu puis `.fin()`. */
    debut({ mode, modele = null }) {
      const t0 = maintenant(); let premier = null, mots = 0;
      return {
        mot() { if (premier === null) premier = maintenant(); mots++; },
        fin({ erreur = null } = {}) {
          const t1 = maintenant(), duree = t1 - t0, gen = premier === null ? null : t1 - premier;
          const l = { mode, modele, mots, ms_total: Math.round(duree), ms_premier_mot: premier === null ? null : Math.round(premier - t0), mots_par_s: gen && gen > 0 && mots > 1 ? Math.round(((mots - 1) / (gen / 1000)) * 10) / 10 : null, erreur };
          lignes.push(l); if (lignes.length > max) lignes.shift(); return l;
        }
      };
    },
    lignes: () => [...lignes],
    /** Résumé par mode : médiane des délais et des vitesses. */
    resume() {
      const med = (a) => { const v = a.filter((x) => x != null).sort((x, y) => x - y); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
      const parMode = {}; for (const l of lignes) (parMode[l.mode] = parMode[l.mode] || []).push(l);
      return Object.fromEntries(Object.entries(parMode).map(([m, ls]) => [m, { reponses: ls.length, erreurs: ls.filter((l) => l.erreur).length, premier_mot_ms: med(ls.map((l) => l.ms_premier_mot)), mots_par_s: med(ls.map((l) => l.mots_par_s)) }]));
    }
  };
}

/** Mémoire et batterie, selon ce que le navigateur donne. */
export async function lireMateriel({ nav = typeof navigator !== "undefined" ? navigator : {}, perf = typeof performance !== "undefined" ? performance : {} } = {}) {
  const r = { memoire_page_mo: null, memoire_appareil_go: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null, batterie_pct: null, en_charge: null, stockage_utilise_mo: null, stockage_quota_mo: null };
  try { if (perf.memory && perf.memory.usedJSHeapSize) r.memoire_page_mo = Math.round(perf.memory.usedJSHeapSize / 1048576); } catch { /* non disponible */ }
  try { if (typeof nav.getBattery === "function") { const b = await nav.getBattery(); r.batterie_pct = Math.round(b.level * 100); r.en_charge = !!b.charging; } } catch { /* Brave et Firefox masquent la batterie */ }
  try { if (nav.storage && nav.storage.estimate) { const e = await nav.storage.estimate(); r.stockage_utilise_mo = Math.round((e.usage || 0) / 1048576); r.stockage_quota_mo = Math.round((e.quota || 0) / 1048576); } } catch { /* non disponible */ }
  return r;
}

/** Conseil en clair d'après les mesures (jamais d'action automatique). */
export function conseil(resume, materiel) {
  const c = [];
  for (const [mode, s] of Object.entries(resume)) {
    if (s.mots_par_s !== null && s.mots_par_s < 2) c.push(`Mode ${mode} lent (${s.mots_par_s} mots/s) : un modèle plus petit ou le mode « sans IA » seraient plus confortables.`);
    if (s.erreurs > 0 && s.erreurs >= s.reponses / 2) c.push(`Mode ${mode} : au moins la moitié des réponses ont échoué.`);
  }
  if (materiel.batterie_pct !== null && materiel.batterie_pct < 20 && materiel.en_charge === false) c.push("Batterie sous 20 % hors charge : l'IA locale devrait attendre.");
  if (materiel.batterie_pct === null) c.push("Batterie : le navigateur ne la donne pas (non mesurée).");
  return c;
}
