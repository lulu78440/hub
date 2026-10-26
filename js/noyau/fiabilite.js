// Noyau · fiabilité des appels (orchestrateur, lot 4) : délai, file d'attente par hôte, reprise sur erreur.
// Fonctions sans dépendance ni accès au hub : l'horloge et la pause sont injectables, donc testables sans attendre.
// Règles (jamais assouplies) :
//  - un appel qui dépasse son délai est COUPÉ (AbortSignal) et son échec est dit, avec sa cause ;
//  - la file par hôte fait ATTENDRE (attente annoncée, bornée), elle ne contourne jamais la limite par minute ;
//  - UN SEUL nouvel essai, et seulement pour une erreur de réseau ou de délai d'un outil idempotent en lecture seule ;
//  - une annulation décidée par Lucien n'est jamais retentée.

export const FENETRE_MS = 60000;
export const ATTENTE_MAX_MS = 20000;       // au-delà, la file refuse au lieu de bloquer le Noyau
export const DELAI_DEFAUT_MS = 60000;      // outil qui ne déclare pas de délai : garde-fou général
export const PAUSE_REPRISE_MS = 500;

export class ErreurFiabilite extends Error {
  constructor(message, code) { super(message); this.name = "ErreurFiabilite"; this.code = code; }
}

/** Pause qui s'interrompt si le signal est annulé. */
export function dormir(ms, signal = null) {
  return new Promise((res, no) => {
    if (signal && signal.aborted) return no(new ErreurFiabilite("Annulé.", "annule"));
    const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", stop); res(); }, Math.max(0, ms));
    const stop = () => { clearTimeout(t); no(new ErreurFiabilite("Annulé.", "annule")); };
    if (signal) signal.addEventListener("abort", stop, { once: true });
  });
}

/**
 * File d'attente par hôte : au plus `max` départs par fenêtre de 60 s, servis dans l'ordre d'arrivée.
 * acquerir() rend { attente_ms } ; si l'attente dépasse `attenteMax`, elle refuse (code « file ») avec le délai à attendre.
 */
export function creerFileHotes({ maintenant = () => Date.now(), pause = dormir, attenteMax = ATTENTE_MAX_MS, surAttente = null, fenetre = FENETRE_MS } = {}) {
  const departs = new Map();      // hôte → horodatages (ms) des départs de la dernière minute
  const chaines = new Map();      // hôte → promesse : l'ordre d'arrivée
  const attentes = new Map();     // hôte → nombre d'appels qui attendent
  const purge = (h) => { const t = maintenant(); const l = (departs.get(h) || []).filter((x) => t - x < fenetre); departs.set(h, l); return l; };
  return {
    async acquerir(hote, maxParMinute, { signal = null } = {}) {
      if (typeof hote !== "string" || !hote) throw new ErreurFiabilite("Hôte invalide pour la file d'attente.", "hote");
      const max = Number.isInteger(maxParMinute) && maxParMinute > 0 ? maxParMinute : 60;
      const avant = chaines.get(hote) || Promise.resolve();
      let lacher; const moi = new Promise((r) => { lacher = r; });
      chaines.set(hote, avant.then(() => moi));
      attentes.set(hote, (attentes.get(hote) || 0) + 1);
      let attente = 0;
      try {
        await avant;
        for (let tour = 0; tour < 5; tour++) {
          if (signal && signal.aborted) throw new ErreurFiabilite("Annulé.", "annule");
          const l = purge(hote);
          if (l.length < max) { l.push(maintenant()); return { attente_ms: attente }; }
          const ms = fenetre - (maintenant() - l[0]) + 5;
          if (attente + ms > attenteMax) throw new ErreurFiabilite(`Limite de ${max} appels par minute atteinte pour ${hote} : il faudrait attendre ${Math.ceil(ms / 1000)} s, je n'attends pas plus de ${Math.round(attenteMax / 1000)} s. Réessaie plus tard.`, "file");
          if (surAttente) { try { surAttente({ hote, ms, derriere: (attentes.get(hote) || 1) - 1 }); } catch (e) { /* l'annonce ne doit jamais casser l'appel */ } }
          await pause(ms, signal); attente += ms;
        }
        throw new ErreurFiabilite(`File d'attente de ${hote} saturée.`, "file");
      } finally { attentes.set(hote, Math.max(0, (attentes.get(hote) || 1) - 1)); lacher(); }
    },
    /** État lisible pour le laboratoire : départs de la dernière minute et attentes en cours. */
    etat: (hote) => ({ departs: purge(hote).length, en_attente: attentes.get(hote) || 0 })
  };
}

/** Une erreur qui vaut un nouvel essai : réseau ou délai, jamais un refus, un format, une limite ou une annulation. */
export function estRepetable(e) {
  if (!e) return false;
  if (e.code === "reseau" || e.code === "delai") return true;
  if (e.code) return false;
  return e.name === "AbortError" || e.name === "TimeoutError";
}
export function causeDe(e) {
  if (!e) return "erreur";
  if (e.code === "delai" || e.name === "TimeoutError") return "delai";
  if (e.code === "annule") return "annule";
  if (e.code === "reseau" || e.name === "AbortError") return "reseau";
  if (e.code === "debit" || e.code === "file") return "limite";
  return e.code || "erreur";
}

/** Une tentative, coupée au délai. `fn(signal)` doit lire le signal (fetch). Le signal externe (Lucien) coupe aussi. */
export async function avecDelai(fn, delaiMs, signalExterne = null) {
  if (signalExterne && signalExterne.aborted) throw new ErreurFiabilite("Annulé.", "annule");
  const ctl = new AbortController(); let t, ecoute;
  const stop = new Promise((_, no) => {
    t = setTimeout(() => { ctl.abort(); no(new ErreurFiabilite(`Délai dépassé (${Math.round(delaiMs / 100) / 10} s) : l'appel a été coupé.`, "delai")); }, delaiMs);
    if (signalExterne) { ecoute = () => { ctl.abort(); no(new ErreurFiabilite("Annulé.", "annule")); }; signalExterne.addEventListener("abort", ecoute, { once: true }); }
  });
  try { return await Promise.race([Promise.resolve().then(() => fn(ctl.signal)), stop]); }
  finally { clearTimeout(t); if (signalExterne && ecoute) signalExterne.removeEventListener("abort", ecoute); }
}

/**
 * Exécute `fn` avec délai et, si `repetable`, UN nouvel essai après une erreur de réseau ou de délai.
 * Rend { valeur, essais } ; en cas d'échec lève l'erreur d'origine avec .essais (1 ou 2) et .cause.
 */
export async function executerAvecReprise(fn, { delaiMs = DELAI_DEFAUT_MS, repetable = false, signal = null, pauseReprise = PAUSE_REPRISE_MS, pause = dormir, avantEssai = null } = {}) {
  let essais = 0, derniere = null;
  for (let k = 0; k < (repetable ? 2 : 1); k++) {
    essais++;
    try {
      if (avantEssai) await avantEssai(essais);
      const valeur = await avecDelai(fn, delaiMs, signal);
      return { valeur, essais };
    } catch (e) {
      derniere = e;
      if (!repetable || k === 1 || !estRepetable(e) || (signal && signal.aborted)) break;
      try { await pause(pauseReprise, signal); } catch (x) { derniere = x; break; }
    }
  }
  const err = derniere instanceof Error ? derniere : new Error(String(derniere));
  err.essais = essais; err.cause_fiabilite = causeDe(err);
  throw err;
}
