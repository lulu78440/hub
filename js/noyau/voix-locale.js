// Noyau · dictée vocale locale (lab-voix) : Whisper dans le worker, à la place de la reconnaissance du navigateur (bloquée par Brave).
// Ici, la partie SANS micro ni modèle, entièrement testable : rééchantillonnage à 16 kHz, découpe aux silences, fusion des morceaux.
// Le micro ne démarre que sur un geste de Lucien (règle du navigateur) ; l'audio ne quitte jamais l'appareil ; le modèle (≈ 40 Mo) se télécharge
// seulement avec son accord (modeles.js, « whisper-tiny »). Sans modèle ou sans worker : la dictée reste indisponible et le clavier marche.
export const FREQ_WHISPER = 16000;

/** Rééchantillonne par interpolation linéaire (suffisant pour la parole). */
export function reechantillonner(donnees, freqSource, freqCible = FREQ_WHISPER) {
  if (!donnees || !donnees.length) return new Float32Array(0);
  if (freqSource === freqCible) return Float32Array.from(donnees);
  const n = Math.max(1, Math.floor(donnees.length * freqCible / freqSource)), out = new Float32Array(n), pas = (donnees.length - 1) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) { const x = i * pas, a = Math.floor(x), b = Math.min(a + 1, donnees.length - 1), f = x - a; out[i] = donnees[a] * (1 - f) + donnees[b] * f; }
  return out;
}

/** Énergie moyenne (RMS) d'un morceau. */
export const rms = (d, a = 0, b = d.length) => { let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, b - a)); };

/**
 * Coupe l'audio aux silences pour que chaque morceau reste court (Whisper traite ≈ 30 s au plus). Morceaux de `maxSec` secondes au plus ;
 * une coupe tombe sur le moment le plus calme de la dernière seconde du morceau. Renvoie des tableaux Float32Array sans perdre un échantillon.
 */
export function decouperAudio(donnees, freq = FREQ_WHISPER, { maxSec = 25, fenetreMs = 50 } = {}) {
  const max = Math.floor(maxSec * freq), fen = Math.max(1, Math.floor(freq * fenetreMs / 1000)), morceaux = [];
  let debut = 0;
  while (donnees.length - debut > max) {
    const finMax = debut + max, zone = Math.max(debut + fen, finMax - freq);          // dernière seconde permise
    let meilleur = finMax, mini = Infinity;
    for (let i = zone; i + fen <= finMax; i += fen) { const e = rms(donnees, i, i + fen); if (e < mini) { mini = e; meilleur = i + Math.floor(fen / 2); } }
    morceaux.push(donnees.slice(debut, meilleur)); debut = meilleur;
  }
  if (donnees.length - debut > 0) morceaux.push(donnees.slice(debut));
  return morceaux;
}

/** Vrai si l'enregistrement est presque muet (inutile de lancer le modèle : il inventerait du texte). */
export const estSilence = (donnees, seuil = 0.005) => !donnees || !donnees.length || rms(donnees) < seuil;

/** Recolle les morceaux transcrits, sans doublon de mots aux jonctions ni espace en trop. */
export function fusionnerTextes(textes) {
  let out = "";
  for (const t of textes.map((x) => String(x || "").trim()).filter(Boolean)) {
    const mots = t.split(/\s+/), fin = out.split(/\s+/).slice(-3);
    let k = 0; for (let n = Math.min(3, mots.length, fin.length); n > 0; n--) if (fin.slice(-n).join(" ").toLowerCase() === mots.slice(0, n).join(" ").toLowerCase()) { k = n; break; }
    out += (out ? " " : "") + mots.slice(k).join(" ");
  }
  return out;
}

/** Dicte un enregistrement : `transcrire(Float32Array 16 kHz)` est fourni par le worker (backend « whisper »). Renvoie { texte, silence }. */
export async function dicter({ donnees, freq, transcrire, signal = null, surPartiel = () => {} }) {
  const audio = reechantillonner(donnees, freq);
  if (estSilence(audio)) return { texte: "", silence: true };
  const morceaux = []; const parts = decouperAudio(audio);
  for (const p of parts) {
    if (signal && signal.aborted) break;
    morceaux.push(await transcrire(p)); surPartiel(fusionnerTextes(morceaux));
  }
  return { texte: fusionnerTextes(morceaux), silence: false };
}
