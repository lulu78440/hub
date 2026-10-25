// Noyau · vue vocale : parler à l'orbe en plein écran (pensée pour le téléphone, utilisable partout).
// Boucle : j'écoute → le Noyau réfléchit (mémoire, outils, barrière, vérification) → il répond à voix haute → j'écoute de nouveau.
// Le micro ne démarre que sur un geste de Lucien (bouton). Brave bloque la reconnaissance vocale : ouvrir le hub dans Chrome.
import { lire, arreter, dicter, lectureDispo, dicteeDispo } from "./voix.js";

function h(tag, a = {}, ...k) { const e = document.createElement(tag); for (const [n, v] of Object.entries(a || {})) { if (v == null || v === false) continue; if (n === "class") e.className = v; else if (n.startsWith("on")) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? "" : v); } e.append(...k.flat().filter((x) => x != null && x !== false)); return e; }
const ETATS = { repos: "Touche l'orbe pour parler", ecoute: "Je t'écoute…", reflechit: "Je réfléchis…", parle: "Je réponds (touche pour m'interrompre)" };

export function monterVueVocale(noyau) {
  let ouverte = false, etat = "repos", dict = null, continu = true, texteFinal = "", vides = 0;
  const orbe = h("button", { class: "nx-vo-orbe", type: "button", "aria-label": "Orbe : toucher pour parler ou interrompre" }, h("i"), h("i"), h("i"), h("b"));
  const lib = h("p", { class: "nx-vo-etat", role: "status", "aria-live": "polite" }, ETATS.repos);
  const entendu = h("p", { class: "nx-vo-entendu" }), reponse = h("p", { class: "nx-vo-reponse", "aria-live": "polite" });
  const cont = h("input", { type: "checkbox", checked: "" }); cont.addEventListener("change", () => { continu = cont.checked; vides = 0; });
  const fermer = h("button", { class: "nx-vo-x", type: "button", "aria-label": "Fermer la conversation vocale", onclick: () => ferme() }, "✕");
  const racine = h("div", { class: "nx-vocal", role: "dialog", "aria-label": "Conversation vocale avec l'orbe", hidden: true, "data-etat": "repos" },
    fermer, h("div", { class: "nx-vo-centre" }, orbe, lib, entendu, reponse),
    h("label", { class: "nx-vo-cont" }, cont, " Conversation continue (j'écoute de nouveau après chaque réponse)"));
  document.body.append(racine);

  const regler = (e) => { etat = e; racine.dataset.etat = e; lib.textContent = ETATS[e]; };
  function ecouter() {
    if (!ouverte) return;
    if (!dicteeDispo()) { regler("repos"); reponse.textContent = "La reconnaissance vocale n'est pas disponible dans ce navigateur (Brave la bloque). Ouvre le hub dans Chrome pour parler à l'orbe."; return; }
    texteFinal = ""; entendu.textContent = ""; regler("ecoute");
    dict = dicter({
      surTexte: (t, final) => { entendu.textContent = t; if (final) texteFinal = t; },
      surFin: () => {
        dict = null; if (!ouverte || etat !== "ecoute") return;
        if (texteFinal.trim()) { vides = 0; envoyer(texteFinal.trim()); }
        else { vides++; if (continu && vides < 3) ecouter(); else { regler("repos"); vides = 0; } }          // silence : on réessaie deux fois puis on attend ton geste
      },
      surErreur: (msg) => { dict = null; regler("repos"); reponse.textContent = msg; continu = false; cont.checked = false; }
    });
  }
  async function envoyer(texte) {
    regler("reflechit"); reponse.textContent = "";
    let r; try { r = await noyau.poser(texte, "voix"); } catch (e) { reponse.textContent = "Erreur : " + (e.message || e); regler("repos"); return; }
    if (!ouverte) return;
    const t = (r && r.texte) || "Je n'ai pas de réponse.";
    reponse.textContent = t;
    if (lectureDispo()) { regler("parle"); lire(t, { ton: r && r.ton, fin: () => { if (!ouverte || etat !== "parle") return; if (continu) ecouter(); else regler("repos"); } }); }
    else regler("repos");
  }
  orbe.addEventListener("click", (e) => {
    if (!e.isTrusted) return;                                    // le micro ne démarre que sur un vrai geste de Lucien
    if (etat === "parle") { arreter(); ecouter(); }
    else if (etat === "ecoute") { if (dict) dict.arreter(); }    // fin de phrase manuelle
    else if (etat === "repos") ecouter();
  });
  function ferme() { ouverte = false; arreter(); if (dict) dict.arreter(); dict = null; racine.hidden = true; document.body.classList.remove("nx-vocal-ouvert"); regler("repos"); }
  document.addEventListener("keydown", (e) => { if (ouverte && e.key === "Escape") ferme(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && ouverte) { arreter(); if (dict) dict.arreter(); regler("repos"); } });

  // La page du hub peut déborder sur téléphone : la vue se cale sur la zone réellement visible.
  const caler = () => { const v = window.visualViewport; if (!v) return; racine.style.left = v.offsetLeft + "px"; racine.style.top = v.offsetTop + "px"; racine.style.width = v.width + "px"; racine.style.height = v.height + "px"; racine.style.right = "auto"; racine.style.bottom = "auto"; };
  if (window.visualViewport) { visualViewport.addEventListener("resize", caler); visualViewport.addEventListener("scroll", caler); }
  function ouvrir() { caler(); ouverte = true; racine.hidden = false; document.body.classList.add("nx-vocal-ouvert"); reponse.textContent = ""; entendu.textContent = ""; vides = 0; regler("repos"); orbe.focus(); }
  // Bouton « Parler » dans la barre du haut (téléphone et PC) : toujours à portée, sans flottant qui dépendrait de la taille de l'écran.
  const actions = document.querySelector(".top .actions");
  const btn = h("button", { class: "btn", type: "button", id: "b-parler", title: "Parler à l'orbe (conversation vocale)", onclick: (e) => { if (e.isTrusted) ouvrir(); } }, "🎙 Parler");
  if (actions) actions.insertBefore(btn, document.getElementById("b-labo") || actions.lastElementChild);
  document.addEventListener("noyau:parler", () => ouvrir());
  return { ouvrir, fermer: ferme, get ouverte() { return ouverte; } };
}
