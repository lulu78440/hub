// Noyau · réponses qui citent leurs sources, phrase par phrase (lab-khoj-sources). Contrôle LOCAL, sans requête de plus, sans IA.
// Idée reprise de Khoj (sans copier de code) : chaque phrase d'une réponse renvoie à son passage précis, et une phrase sans appui est dite telle quelle.
// Le contrôle ne mesure que le recouvrement de mots entre la phrase et l'extrait cité : il repère les défauts grossiers, il ne prouve pas qu'une phrase est vraie.
import { jetons } from "./recherche.js";

export const SEUILS = { appuyee: 0.34, douteuse: 0.15, minMots: 2 };
/** Coupe en phrases en gardant les marqueurs [n] attachés à leur phrase. */
export function decouperPhrases(texte) {
  const t = String(texte == null ? "" : texte).replace(/\r/g, "").trim(); if (!t) return [];
  return t.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"\[])|\n+/).map((s) => s.trim()).filter(Boolean);
}
const marqueurs = (s) => [...s.matchAll(/\[(\d{1,3})\]/g)].map((m) => +m[1]);
const sansMarq = (s) => s.replace(/\[\d{1,3}\]/g, "").trim();
const recouvre = (motsPhrase, motsExtrait) => { if (!motsPhrase.length) return { part: 0, communs: 0 }; const e = new Set(motsExtrait); const c = motsPhrase.filter((m) => e.has(m)).length; return { part: c / motsPhrase.length, communs: c }; };
/** Une phrase « neutre » n'affirme rien de vérifiable : question, politesse, avis, aveu d'ignorance. */
const neutre = (s, mots) => /\?\s*$/.test(s) || mots.length < 3 || /^(bonjour|salut|merci|voici|d'accord|oui|non|je ne sais pas|je n'ai pas|je ne trouve|je pense|à mon avis|selon moi)/i.test(s.trim());

/**
 * Analyse une réponse. `extraits` = [{ n, titre?, texte }] (les [n] donnés au modèle). Statuts par phrase :
 *  - « appuyée » : cite [n] et recouvre assez l'extrait ;  - « douteuse » : cite [n] mais l'extrait parle d'autre chose ;
 *  - « source-possible » : ne cite rien mais un extrait la recouvre ;  - « sans-source » : affirme sans appui ;  - « neutre » : n'affirme rien.
 */
export function analyserCitations(texte, extraits = []) {
  const par = new Map(extraits.map((e) => [e.n, { ...e, mots: jetons(e.texte) }]));
  const phrases = decouperPhrases(texte).map((brut) => {
    const cites = marqueurs(brut), propre = sansMarq(brut), mots = jetons(propre);
    if (neutre(propre, mots) && !cites.length) return { texte: brut, statut: "neutre", sources: [] };
    if (cites.length) {
      const connues = cites.filter((n) => par.has(n)); if (!connues.length) return { texte: brut, statut: "douteuse", sources: cites, raison: "cite un extrait qui n'existe pas" };
      const meilleur = connues.map((n) => ({ n, ...recouvre(mots, par.get(n).mots) })).sort((a, b) => b.part - a.part)[0];
      if (meilleur.part >= SEUILS.appuyee && meilleur.communs >= SEUILS.minMots) return { texte: brut, statut: "appuyee", sources: [meilleur.n] };
      return { texte: brut, statut: "douteuse", sources: connues, raison: "l'extrait cité ne parle pas vraiment de cela" };
    }
    const autre = [...par.values()].map((e) => ({ n: e.n, ...recouvre(mots, e.mots) })).sort((a, b) => b.part - a.part)[0];
    if (autre && autre.part >= SEUILS.appuyee && autre.communs >= SEUILS.minMots) return { texte: brut, statut: "source-possible", sources: [autre.n] };
    return { texte: brut, statut: "sans-source", sources: [] };
  });
  const c = (s) => phrases.filter((p) => p.statut === s).length;
  const resume = { appuyees: c("appuyee"), douteuses: c("douteuse"), sources_possibles: c("source-possible"), sans_source: c("sans-source"), neutres: c("neutre") };
  return { phrases, resume, aVerifier: resume.douteuses + resume.sans_source > 0 };
}
