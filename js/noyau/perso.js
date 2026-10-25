// Noyau · personnalisation du hub à la demande de Lucien (couleurs, fenêtres, style) : une couche de RÉGLAGES, jamais le code.
//  - Le Noyau ne réécrit aucun fichier du hub, du labo ni de son propre cerveau (principe 6 du contrat) : il pose des réglages
//    déclaratifs (couleurs, visibilité, place, taille, opacité…) vérifiés ici, stockés sur l'appareil, et appliqués par l'adaptateur hote.js.
//  - Chaque changement passe par la confirmation de Lucien (niveau CONFIRMATION) et se défait : « annuler » (20 pas) ou « tout remettre ».
//  - Interdits : sécurité, coffre, synchro, permissions, cerveau, mémoire, labo. Aucune propriété CSS hors liste, aucune URL, aucun script.
import { hote } from "./hote.js";

export const COULEURS = { cyan: "--cyan", violet: "--violet", ambre: "--amber", encre: "--ink", discret: "--dim", fond: "--void", rouge: "--red", ok: "--ok" };
const HEX = /^#[0-9a-f]{6}$/i;
const FENETRE = /^[a-z0-9_-]{1,24}$/;
const INTERDITES = new Set(["coffre", "vault", "lock", "diag", "sync", "noyau", "labo"]);      // jamais touchées par le Noyau
export const VIDE = () => ({ v: 1, theme: {}, fenetres: {} });

const nombre = (v, min, max) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error("Nombre attendu"); return Math.min(max, Math.max(min, n)); };

/** Vérifie une demande et renvoie la liste des changements (sans rien appliquer). Lève une erreur claire sinon. */
export function valider(p) {
  const c = [];
  if (p.couleur !== undefined || p.valeur !== undefined) {
    if (!(p.couleur in COULEURS)) throw new Error("Couleur inconnue. Choix : " + Object.keys(COULEURS).join(", "));
    if (!HEX.test(String(p.valeur || ""))) throw new Error("Valeur de couleur : #rrggbb (ex. #3fe6ff)");
    c.push({ t: "theme", cle: p.couleur, valeur: String(p.valeur).toLowerCase() });
  }
  const id = p.fenetre === undefined ? null : String(p.fenetre);
  const veutFenetre = ["visible", "x", "y", "largeur", "hauteur", "figee", "opacite", "taille_texte", "couleur_texte", "couleur_fond"].some((k) => p[k] !== undefined);
  if (veutFenetre) {
    if (!id || !FENETRE.test(id)) throw new Error("Précise la fenêtre (identifiant, ex. notes, tasks, agenda).");
    if (INTERDITES.has(id)) throw new Error("Cette fenêtre touche à la sécurité ou au Noyau : je ne la modifie pas.");
    const disp = {}, st = {};
    if (p.visible !== undefined) disp.visible = !!p.visible;
    if (p.figee !== undefined) disp.figee = !!p.figee;
    for (const [k, a, b] of [["x", 0, 90], ["y", 0, 90], ["largeur", 8, 100], ["hauteur", 8, 100]]) if (p[k] !== undefined) disp[k] = nombre(p[k], a, b) / 100;
    if (p.opacite !== undefined) st.opacite = nombre(p.opacite, 0.3, 1);
    if (p.taille_texte !== undefined) st.taille_texte = Math.round(nombre(p.taille_texte, 11, 26));
    for (const k of ["couleur_texte", "couleur_fond"]) if (p[k] !== undefined) { if (!HEX.test(String(p[k]))) throw new Error(k + " : #rrggbb"); st[k] = String(p[k]).toLowerCase(); }
    if (Object.keys(disp).length) c.push({ t: "disposition", id, disp });
    if (Object.keys(st).length) c.push({ t: "style", id, st });
  }
  if (!c.length) throw new Error("Rien à changer : donne une couleur, ou une fenêtre avec ce qu'il faut modifier.");
  return c;
}

/** CSS d'un état : uniquement des variables du thème et quelques propriétés par fenêtre. */
export function css(etat) {
  const l = [];
  const th = Object.entries(etat.theme || {}).filter(([k, v]) => k in COULEURS && HEX.test(v));
  if (th.length) l.push(":root{" + th.map(([k, v]) => `${COULEURS[k]}:${v}`).join(";") + "}");
  for (const [id, s] of Object.entries(etat.fenetres || {})) {
    if (!FENETRE.test(id) || INTERDITES.has(id)) continue;
    const d = [];
    if (s.opacite != null) d.push(`opacity:${nombre(s.opacite, 0.3, 1)}`);
    if (s.taille_texte != null) d.push(`font-size:${Math.round(nombre(s.taille_texte, 11, 26))}px`);
    if (s.couleur_texte && HEX.test(s.couleur_texte)) d.push(`color:${s.couleur_texte}`);
    if (s.couleur_fond && HEX.test(s.couleur_fond)) d.push(`background-color:${s.couleur_fond}`);
    if (d.length) l.push(`.win[data-id="${id}"]{${d.join(";")}}`);
  }
  return l.join("\n");
}

export function creerPerso() {
  const lire = () => { try { const e = JSON.parse(hote.reglage.lire("noyau-perso", "")); return e && e.v === 1 ? e : VIDE(); } catch (x) { return VIDE(); } };
  const ecrire = (e) => hote.reglage.ecrire("noyau-perso", JSON.stringify(e));
  const histo = () => { try { return JSON.parse(hote.reglage.lire("noyau-perso-histo", "[]")); } catch (x) { return []; } };
  const empiler = (h, x) => { h.push(x); while (h.length > 20) h.shift(); hote.reglage.ecrire("noyau-perso-histo", JSON.stringify(h)); };
  const appliquer = () => hote.hub.styleNoyau(css(lire()));

  const api = {
    css, valider, lire, appliquer,
    /** Texte de confirmation montré à Lucien. */
    resume(p) {
      if (p.action === "annuler") return "Annuler le dernier changement d'apparence";
      if (p.action === "tout_remettre") return "Remettre l'apparence d'origine (couleurs, styles et disposition des fenêtres)";
      const c = valider(p);
      return c.map((x) => x.t === "theme" ? `Couleur « ${x.cle} » → ${x.valeur}` : x.t === "style" ? `Fenêtre « ${x.id} » : ${Object.entries(x.st).map(([k, v]) => k.replace("_", " ") + " " + v).join(", ")}` : `Fenêtre « ${x.id} » : ${Object.entries(x.disp).map(([k, v]) => k === "visible" ? (v ? "afficher" : "masquer") : k === "figee" ? (v ? "figer" : "libérer") : k + " " + Math.round(v * 100) + " %").join(", ")}`).join(" ; ");
    },
    async executer(p) {
      const h = histo();
      if (p.action === "annuler") {
        const d = h.pop(); if (!d) return { annule: false, note: "Rien à annuler." };
        hote.reglage.ecrire("noyau-perso-histo", JSON.stringify(h));
        if (d.k === "etat") { ecrire(d.etat); appliquer(); } else if (d.k === "disp") await hote.hub.disposer(d.id, d.avant, { brut: true });
        return { annule: true, restant: h.length };
      }
      if (p.action === "tout_remettre") {
        empiler(h, { k: "etat", etat: lire() }); ecrire(VIDE()); appliquer(); await hote.hub.remettreDisposition();
        return { remis: true, note: "Apparence d'origine rétablie. La disposition des fenêtres revient à celle d'origine (non annulable)." };
      }
      const e = lire(), cs = valider(p), faits = [];
      for (const c of cs) {
        if (c.t === "theme") { empiler(histo(), { k: "etat", etat: structuredClone(e) }); e.theme[c.cle] = c.valeur; faits.push(`couleur ${c.cle} ${c.valeur}`); }
        else if (c.t === "style") { empiler(histo(), { k: "etat", etat: structuredClone(e) }); e.fenetres[c.id] = { ...(e.fenetres[c.id] || {}), ...c.st }; faits.push(`style de ${c.id}`); }
        else { const r = await hote.hub.disposer(c.id, c.disp); if (!r.ok) throw new Error(r.erreur || "Disposition impossible"); empiler(histo(), { k: "disp", id: c.id, avant: r.avant }); faits.push(`disposition de ${c.id}`); }
      }
      ecrire(e); appliquer();
      return { applique: faits, annulable: true };
    }
  };
  return api;
}
