// Atelier · fenêtre « Achats » : fins de garantie, délais de retour, rappels à venir, et reconnaissance d'un numéro de colis.
// Moteurs : moteurs/at-garantie.js (échéances) et moteurs/at-colis.js (transporteur d'après le format du numéro ; aucun appel réseau).
// Données (collection kv, chiffrées si le verrouillage est actif) : un enregistrement par achat « achat-<id> » =
//   { id, nom, dateAchat, mode: "distance"|"magasin", etat: "neuf"|"occasion", dateReception?, garantieMois?, extensionMois?, retourJours? }.
// Le suivi d'un colis s'ouvre dans un nouvel onglet seulement si Lucien clique, et uniquement vers un lien https connu du moteur.
import { store, newId } from "../store/storage.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { dayKey } from "./when.js";
import { radar, rappels } from "./moteurs/at-garantie.js";
import { analyser, extraire } from "./moteurs/at-colis.js";
import { h, boutonDeuxTemps, garderFocus, poserStyle } from "./atelier-outils.js";

const P = "achat-", AVANT = [7, 1];
const fr = (d) => d.split("-").reverse().join("/");
const ETIQ = { retour: ["Retour possible", "warn"], bientot: ["Garantie bientôt finie", "warn"], garantie: ["Sous garantie", "good"], expiree: ["Garantie terminée", "dim"], invalide: ["À corriger", "bad"] };
const CONF = { sure: "numéro vérifié", probable: "probable", possible: "possible" };

export function initAchats() {
  const win = document.querySelector('.win[data-id="achats"]'); if (!win) return {};
  poserStyle();
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag");
  let pf = win.querySelector(".pf");
  if (!pf) { pf = h("div", { class: "pf" }); win.querySelector(".in").append(pf); }
  pb.textContent = "";
  const racine = h("div", { class: "atl", role: "region", "aria-label": "Achats et garanties" });
  pb.append(racine);

  let ecriture = 0, saisie = false, achats = [], edition = null, statut = "", colis = null, pret = false, formOuvert = false;

  /** Nos propres écritures préviennent déjà l'écran : on n'écoute que les changements venus d'ailleurs (autre onglet, synchro). */
  const ecrire = async (fn) => { ecriture++; try { await fn(); } finally { setTimeout(() => { ecriture--; }, 0); } };
  async function charger() {
    achats = (await store.all("kv")).filter((x) => typeof x.id === "string" && x.id.startsWith(P) && typeof x.nom === "string");
    pret = true; if (!saisie) dessiner();
  }
  const aujourdhui = () => dayKey();

  async function enregistrer(champs) {
    const e = edition ? achats.find((a) => a.id === edition) : null;
    const a = { ...champs, id: e ? e.id : newId(P) };   // l'enregistrement est refait en entier : un champ vidé disparaît
    await ecrire(() => store.put("kv", a));
    achats = e ? achats.map((x) => (x.id === a.id ? a : x)) : achats.concat(a);
    statut = e ? "« " + a.nom + " » modifié." : "« " + a.nom + " » ajouté."; edition = null; formOuvert = false; dessiner();
  }
  async function retirer(id) {
    const a = achats.find((x) => x.id === id); if (!a) return;
    await ecrire(() => store.del("kv", id)); achats = achats.filter((x) => x.id !== id); statut = "« " + a.nom + " » retiré."; dessiner();
  }

  function formulaire() {
    const e = edition ? achats.find((a) => a.id === edition) : null;
    const nom = h("input", { class: "inl", type: "text", maxlength: "80", required: true, autocomplete: "off", "data-k": "f-nom", value: e ? e.nom : "" });
    const date = h("input", { class: "inl", type: "date", required: true, "data-k": "f-date", value: e ? e.dateAchat : aujourdhui(), max: "2099-12-31" });
    const mode = h("select", { class: "inl", "data-k": "f-mode" }, h("option", { value: "distance" }, "En ligne / à distance"), h("option", { value: "magasin" }, "En magasin"));
    mode.value = e ? e.mode || "distance" : "distance";
    const recu = h("input", { class: "inl", type: "date", "data-k": "f-recu", value: e && e.dateReception ? e.dateReception : "" });
    const etatBien = h("select", { class: "inl", "data-k": "f-etat" }, h("option", { value: "neuf" }, "Neuf"), h("option", { value: "occasion" }, "Occasion"));
    etatBien.value = e && e.etat === "occasion" ? "occasion" : "neuf";
    const gar = h("input", { class: "inl", type: "text", inputmode: "numeric", autocomplete: "off", "data-k": "f-gar", value: e && e.garantieMois ? String(e.garantieMois) : "24" });
    const ext = h("input", { class: "inl", type: "text", inputmode: "numeric", autocomplete: "off", "data-k": "f-ext", value: e && e.extensionMois ? String(e.extensionMois) : "0" });
    const ret = h("input", { class: "inl", type: "text", inputmode: "numeric", autocomplete: "off", "data-k": "f-ret", placeholder: "14 en ligne, 0 en magasin", value: e && e.retourJours != null ? String(e.retourJours) : "" });
    [nom, gar, ext, ret].forEach((i) => i.addEventListener("keydown", (ev) => ev.stopPropagation()));
    const entier = (v, defaut) => { const t = String(v).trim(); if (t === "") return defaut; return /^\d{1,3}$/.test(t) ? +t : NaN; };
    const f = h("form", { class: "rg", onsubmit: (ev) => {
      ev.preventDefault();
      const g = entier(gar.value, 24), x = entier(ext.value, 0), r = entier(ret.value, null);
      if (!nom.value.trim()) { statut = "Donne un nom à l'achat."; dessiner(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { statut = "Date d'achat à choisir."; dessiner(); return; }
      if (Number.isNaN(g) || g < 1 || Number.isNaN(x) || Number.isNaN(r)) { statut = "Garantie, extension et retour : des nombres entiers (garantie d'au moins 1 mois)."; dessiner(); return; }
      const out = { nom: nom.value.trim(), dateAchat: date.value, mode: mode.value, etat: etatBien.value, garantieMois: g, extensionMois: x };
      if (mode.value === "distance" && recu.value) out.dateReception = recu.value;
      if (r != null) out.retourJours = r;          // vide : délai du moteur (14 jours en ligne, aucun en magasin)
      enregistrer(out);
    } },
      h("label", { style: "flex-basis:100%" }, "Nom de l'achat", nom),
      h("label", {}, "Acheté le", date), h("label", {}, "Achat", mode),
      h("label", {}, "Reçu le (en ligne)", recu), h("label", {}, "État", etatBien),
      h("label", {}, "Garantie (mois)", gar), h("label", {}, "Extension (mois)", ext),
      h("label", {}, "Retour accordé (jours)", ret),
      h("div", { class: "rg", style: "flex-basis:100%" }, h("button", { type: "submit", class: "btn ok", "data-k": "f-ok" }, e ? "Enregistrer" : "Ajouter l'achat"),
        e ? h("button", { type: "button", class: "btn", onclick: () => { edition = null; formOuvert = false; dessiner(); } }, "Annuler") : null));
    return f;
  }

  function dessiner() {
    if (!pret) return;
    saisie = false;   // un nouveau dessin repart des données ; les rechargements venus d'ailleurs ne l'emportent jamais sur une saisie en cours (écouteur « input »)
    garderFocus(racine, () => { racine.textContent = ""; racine.append(...vue()); });
  }
  function vue() {
    const V = [], jour = aujourdhui(), R = radar(achats, jour);
    const urgents = R.filter((e) => e.statut === "retour" || e.statut === "bientot").length;
    tag.textContent = urgents ? urgents + " À SURVEILLER" : "ACHATS";
    pf.textContent = ""; pf.append(h("span", {}, `${achats.length} achat${achats.length > 1 ? "s" : ""} sur l'appareil`), h("span", {}, "Vérifie les durées sur ta facture"));

    V.push(h("p", { class: "etat", role: "status", "aria-live": "polite" }, statut));
    V.push(h("details", { open: formOuvert || edition || !achats.length ? true : null, ontoggle: (ev) => { formOuvert = ev.target.open; } }, h("summary", {}, edition ? "Modifier l'achat" : "Nouvel achat"), formulaire()));

    V.push(h("h3", {}, "Garanties et retours"));
    if (!R.length) V.push(h("p", { class: "vide" }, "Aucun achat. Ajoute-en un pour voir sa fin de garantie et son délai de retour."));
    const ul = h("ul", {});
    for (const e of R) {
      const [lib, cls] = ETIQ[e.statut] || ETIQ.invalide;
      ul.append(h("li", { class: "card" + (e.statut === "retour" || e.statut === "bientot" ? " alerte" : "") },
        h("div", { class: "tete" }, h("span", { class: "nom" }, e.nom), h("span", { class: "dim " + cls, style: "font-weight:600" }, lib)),
        h("p", { class: "txt" }, e.texte),
        e.finGarantie ? h("p", { class: "dim" }, `Garantie jusqu'au ${fr(e.finGarantie)}` + (e.finRetour ? ` · retour jusqu'au ${fr(e.finRetour)}` : "")) : null,
        ...(e.problemes || []).map((p) => h("p", { class: "dim warn" }, "⚠ " + p)),
        h("div", { class: "rg" },
          h("button", { type: "button", class: "btn", "data-k": "mod-" + e.id, "aria-label": "Modifier " + e.nom, onclick: () => { edition = e.id; formOuvert = true; dessiner(); } }, "Modifier"),
          boutonDeuxTemps("Retirer", "Confirmer le retrait", () => retirer(e.id), { nom: e.nom }))));
    }
    V.push(ul);

    const proch = rappels(achats, jour, { avantJours: AVANT }).slice(0, 5);
    if (proch.length) V.push(h("details", {}, h("summary", {}, "Prochains rappels"), h("ul", { style: "margin-top:6px" }, proch.map((r) => h("li", { class: "txt" }, `${fr(r.date)} · ${r.texte}`)))));

    // Colis
    const num = h("input", { class: "inl", type: "text", maxlength: "400", autocomplete: "off", spellcheck: "false", "data-k": "colis", placeholder: "Numéro de suivi, ou message du vendeur", "aria-label": "Numéro de suivi ou message du vendeur" });
    num.addEventListener("keydown", (ev) => ev.stopPropagation());
    const resultat = h("div", { "aria-live": "polite" });
    const lancer = () => {
      const t = num.value.trim(); colis = null;
      if (t.length > 30 || /\s.*\s/.test(t)) { const l = extraire(t); colis = l.length ? l : [analyser(t)]; } else colis = [analyser(t)];
      dessinerColis(resultat);
    };
    if (colis) dessinerColis(resultat);
    V.push(h("details", { open: colis ? true : null }, h("summary", {}, "Suivre un colis"),
      h("form", { class: "rg", style: "margin-top:6px", onsubmit: (ev) => { ev.preventDefault(); lancer(); } }, h("div", { class: "grow" }, num), h("button", { type: "submit", class: "btn" }, "Reconnaître")),
      h("p", { class: "vide", style: "margin:6px 0" }, "Rien n'est envoyé : je reconnais le transporteur d'après le format. Le lien s'ouvre seulement si tu cliques."), resultat));
    return V;
  }
  function dessinerColis(zone) {
    zone.textContent = "";
    for (const a of colis || []) {
      zone.append(h("p", { class: "txt", style: "margin-top:6px" }, a.message));
      for (const c of a.candidats.slice(0, 4)) {
        zone.append(h("div", { class: "rg" },
          h("span", { class: "txt grow" }, `${c.transporteur} · ${CONF[c.confiance]}`),
          c.lien && c.lien.startsWith("https://") ? h("button", { type: "button", class: "btn", "aria-label": "Ouvrir le suivi " + c.transporteur + " dans un nouvel onglet", onclick: () => { window.open(c.lien, "_blank", "noopener,noreferrer"); } }, "Ouvrir le suivi") : h("span", { class: "dim" }, "pas de lien connu")));
      }
    }
  }

  racine.addEventListener("input", () => { saisie = true; });
  registerMenu("achats", () => [{ t: "Nouvel achat…", fn: () => { edition = null; formOuvert = true; dessiner(); const e = racine.querySelector('[data-k="f-nom"]'); if (e) e.focus(); } }]);
  store.on("kv", () => { if (!ecriture && !saisie) charger(); });
  charger();
  return { charger, liste: () => achats.slice(), enregistrer };
}
