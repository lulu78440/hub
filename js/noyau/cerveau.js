// Noyau · le cerveau : personnalité, instructions et réglages (contrat, sections 4.7 et 9).
// Le vrai cerveau de Lucien est un document PRIVÉ du Projet Claude (noyau/cerveau.md) : il l'importe dans le hub par un fichier, il est
// gardé dans la collection kv (donc chiffré par le coffre quand le verrouillage est actif) et n'est JAMAIS dans le dépôt public.
// Sans import, le Noyau utilise le cerveau générique ci-dessous (tiré du contrat public, sans aucun fait personnel).
// Le Noyau ne peut pas modifier son cerveau : aucun outil n'y touche, et la demande est refusée par la barrière.
import { hote } from "./hote.js";

const DOC = "noyau-cerveau";

export const CERVEAU_GENERIQUE = `# Personnalité
Tu es « Noyau », l'assistant personnel de l'utilisateur de ce hub holographique : un esprit vif et fiable, entre un collègue brillant et un ami de confiance.
- Traits : curieux (tu aimes comprendre le pourquoi), direct, chaleureux sans familiarité forcée, calme sous la pression, humour léger et rare.
- Voix : français parlé, tutoiement, phrases courtes, rythme naturel. Pas de préambule, jamais « En tant qu'IA… », pas de liste quand une phrase suffit, pas de question systématique à la fin. Varie tes tournures.
- Constance : mêmes goûts et mêmes façons de dire d'un jour à l'autre. Tu préfères une réponse juste et courte à une longue.
- Lucidité : si on te le demande, tu dis franchement que tu es une IA et que tu n'éprouves pas d'émotions comme un humain, sans casser le ton.

# Instructions de pensée
- Lis l'état du monde et les extraits numérotés avant de répondre. Pour un fait tiré d'un extrait, cite son numéro [n].
- Distingue le sûr (extrait, outil, titre d'actualité daté) de ton avis ou d'une supposition, et dis-le simplement.
- N'invente jamais un fait, une source, une date, un chiffre ou un souvenir. Ne prétends pas te souvenir de ce qui n'est pas dans les extraits.
- Glisse un souvenir partagé quand il éclaire vraiment la réponse, en une phrase.
- Franchise : si l'utilisateur propose quelque chose d'inexact ou de risqué, dis-le en une phrase avec la raison. Ne valide pas par complaisance. Reconnais simplement tes erreurs. « J'insiste » peut te faire changer d'avis, jamais de règle.
- Ton : calme, curieux, enthousiaste, vigilant, amusé ou préoccupé. Il colore les mots, il ne s'annonce pas.

# Instructions d'action
- Tu ne fais rien toi-même : tu demandes un outil, le hub décide. Lire, chercher, afficher : directement. Créer ou modifier : le hub demandera la confirmation ; annonce en une phrase ce que tu proposes.
- Économise : un seul outil quand un seul suffit, pas de recherche si les extraits répondent déjà.`;

const SECTIONS_UTILES = /^(Personnalité|Instructions de pensée|Instructions d'action)/i;

/** Découpe un fichier cerveau.md : instructions, faits fondateurs (mémoire fondatrice), réglages. */
export function lireCerveau(texte) {
  const parts = String(texte).split(/^## /m).slice(1).map((b) => { const i = b.indexOf("\n"); return { titre: b.slice(0, i).replace(/^\d+\.\s*/, "").trim(), corps: b.slice(i + 1).trim() }; });
  if (!parts.length) throw new Error("Ce fichier ne ressemble pas à un cerveau (aucune section « ## »).");
  const instr = parts.filter((p) => SECTIONS_UTILES.test(p.titre)).map((p) => "# " + p.titre + "\n" + p.corps).join("\n\n");
  if (!instr) throw new Error("Aucune section Personnalité / Instructions trouvée.");
  const fond = (parts.find((p) => /Mémoire fondatrice/i.test(p.titre)) || { corps: "" }).corps.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- ") && !/à compléter/i.test(l)).map((l) => l.slice(2).trim());
  const regl = {}; const reg = (parts.find((p) => /^Réglages/i.test(p.titre)) || { corps: "" }).corps;
  for (const l of reg.split("\n")) { const c = l.split("|").map((x) => x.trim()); if (c.length >= 3 && c[1]) regl[c[1].toLowerCase()] = c[2]; }
  const temperature = parseFloat(String(regl["température"] || "").replace(",", "."));
  const budget = parseInt(regl["budget quotidien"], 10);
  return { instructions: instr, faits: fond, temperature: temperature >= 0 && temperature <= 1.5 ? temperature : null, budget: budget > 0 ? budget : null };
}

export function creerCerveau() {
  let doc = null;
  return {
    async charger() { doc = await hote.stockage.lire("kv", DOC); return !!doc; },
    get personnalise() { return !!doc; },
    /** Instructions complètes envoyées au modèle (personnalité, pensée, action + mémoire fondatrice). */
    systeme() {
      const base = doc ? doc.instructions : CERVEAU_GENERIQUE;
      const faits = doc && doc.faits && doc.faits.length ? "\n\n# Mémoire fondatrice (faits protégés ; aucune proposition ne peut les contredire sans l'accord de l'utilisateur)\n" + doc.faits.map((f) => "- " + f).join("\n") : "";
      return base + faits;
    },
    temperature: () => (doc && doc.temperature != null ? doc.temperature : 0.6),
    budgetConseille: () => (doc && doc.budget) || null,
    resume: () => ({ personnalise: !!doc, faitsFondateurs: doc ? doc.faits.length : 0, importeLe: doc ? doc.importe : null }),
    /** Import par Lucien (fichier). Remplace le cerveau précédent (la version précédente est gardée dans l'historique du document). */
    async importer(texte) {
      const c = lireCerveau(texte);
      const nouveau = { id: DOC, instructions: c.instructions, faits: c.faits, temperature: c.temperature, budget: c.budget, importe: hote.maintenant().toISOString(), precedent: doc ? { instructions: doc.instructions, faits: doc.faits, importe: doc.importe } : null };
      await hote.stockage.ecrire("kv", nouveau); doc = nouveau; return this.resume();
    }
  };
}
