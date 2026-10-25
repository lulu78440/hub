// Noyau · voix naturelle Piper (facultative, désactivée par défaut) : synthèse vocale neuronale dans le navigateur, plus naturelle que la voix du système.
// Téléchargement unique de la voix française (environ 60 Mo) sur accord de Lucien ; ensuite tout tourne sur l'appareil. En cas d'échec, la voix du système prend le relais.
// Non testé dans l'espace de travail de Claude (pas de téléchargement possible) : à essayer sur ton appareil ; le chargeur est injectable pour les essais.
export const LIB = "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm";
export const VOIX = "fr_FR-siwis-medium";

const lecteurDefaut = (wav) => new Promise((ok, ko) => {
  const url = URL.createObjectURL(wav), a = new Audio(url); piper_audio = a;
  a.onended = () => { URL.revokeObjectURL(url); ok(); }; a.onerror = () => { URL.revokeObjectURL(url); ko(new Error("lecture audio impossible")); };
  a.play().catch(ko);
});
let piper_audio = null;

export function creerPiper({ charger = () => import(/* @vite-ignore */ LIB), voix = VOIX, lecteur = lecteurDefaut } = {}) {
  let etat = "off", lib = null, erreur = "", annule = 0;
  const api = {
    statut: () => ({ etat, erreur, voix }),
    pret: () => etat === "pret",
    /** Télécharge la bibliothèque et la voix (premier usage). */
    async preparer() {
      if (etat === "pret" || etat === "telechargement") return api.statut();
      etat = "telechargement"; erreur = "";
      try { lib = await charger(); await lib.predict({ text: "Bonjour.", voiceId: voix }); etat = "pret"; }     // un mot d'essai force le téléchargement de la voix
      catch (e) { etat = "erreur"; erreur = String(e && e.message || e).slice(0, 120); lib = null; }
      return api.statut();
    },
    /** Dit un texte ; la promesse échoue si la voix n'a pas pu parler (l'appelant se rabat alors sur la voix du système). */
    async dire(texte) {
      if (etat !== "pret") throw new Error("voix non prête");
      const mon = ++annule, wav = await lib.predict({ text: texte, voiceId: voix });
      if (mon !== annule) return;                                  // interrompu pendant la synthèse
      await lecteur(wav);
    },
    arreter() { annule++; try { if (piper_audio) { piper_audio.pause(); piper_audio = null; } } catch (e) { /* rien */ } },
    desactiver() { api.arreter(); }
  };
  return api;
}
