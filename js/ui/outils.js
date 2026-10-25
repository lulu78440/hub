// Fenêtre « Outils » (refonte, 25/10) : les fonctions rares, rangées en groupes de tuiles dans un panneau à droite (PC).
// Bouton Outils de la barre du haut, touche O, ligne « Outils… » du menu du fond. Les tuiles reprennent les lignes de menu des widgets
// (Focus, briefing, image, crépuscule…) au lieu de les réécrire, donc rien ne se perd : ce qu'aucune tuile ne reprend va dans « Autres actions ».
// Réglages et diagnostic (l'ancien Diag) reste à une tuile ; la touche D l'ouvre toujours directement.
// Mobile (ergo-mobile) : même panneau, en feuille collée en bas de l'écran ; les fenêtres rares se masquent avec le réglage mobile existant.
import { state } from "../state.js";
import { prefs } from "../store/prefs.js";
import { sound } from "../device/sound.js";
import { toast } from "./toast.js";
import { PAR_DEFAUT } from "./reserve.js";

const $ = (id) => document.getElementById(id);

export function initOutils({ wins, entity, cursor, resetLayout, data, menus, test }) {
  const lite = state.lite, mob = menus && menus.mob;
  if (lite && !mob) return { open() {}, close() {} };
  const btn = $("b-outils");
  const box = document.createElement("aside"); box.className = "outils"; box.id = "outils"; box.hidden = true; box.setAttribute("aria-label", "Outils");
  document.body.append(box);
  let showHidden = false;

  let cache = [];
  const lines = () => (menus && menus.fondLines ? menus.fondLines() : []);
  const find = (re) => cache.find((i) => re.test(i.t));
  const used = new Set();
  const ago = (iso) => { if (!iso) return "jamais"; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); return d <= 0 ? "aujourd'hui" : "il y a " + d + " j"; };
  const fsOn = () => !!document.fullscreenElement;

  /** Une tuile : { t: titre, s: état en petit, fn, keep: ne pas fermer après, off }. Les lignes de menu reprises sont marquées « utilisées ». */
  const fromLine = (re, label, st) => { const l = find(re); if (!l) return null; used.add(l); return { t: label || l.t, s: st ? st() : "", fn: l.fn }; };

  function groupsMobile() {
    const L = mob.list(), by = (id) => L.find((w) => w.id === id), nHid = L.filter((w) => w.hid).length, nRed = L.filter((w) => w.red).length;
    const G = [];
    G.push({ h: "Gestes", tiles: [
      fromLine(/^Focus 25|^Arrêter le Focus/), fromLine(/^Focus 50/), fromLine(/^Revoir le briefing/, "Revoir le briefing"),
      fromLine(/^Capture rapide/), fromLine(/image ici/i, "Ajouter une image"),
      { t: "Plein écran", s: "", fn: () => $("fs").click() },
      fromLine(/^Verrouiller maintenant/, "Verrouiller", () => "actif") ] });
    G.push({ h: "Fenêtres rangées", tiles: [
      { t: "Tout réduire", s: "à leur nom", keep: true, off: nRed >= L.length - nHid, fn: () => mob.setAllRed(true) },
      { t: "Tout rouvrir", s: nRed ? nRed + " réduite(s)" : "aucune réduite", keep: true, off: !nRed, fn: () => mob.setAllRed(false) },
      { t: "Fenêtres masquées", s: nHid ? nHid + " masquée(s)" : "aucune", keep: true, off: !nHid, fn: () => { showHidden = !showHidden; render(); } },
      { t: "Ordre d'origine", s: "remet tout", fn: () => $("mlayout-reset").click() } ] });
    G.push({ h: "Fonctions rarement utilisées", note: "Masque ou remet la fenêtre dans la page. Ton choix est gardé.", tiles: PAR_DEFAUT.map((id) => {
      const w = by(id); if (!w) return null;
      return { t: w.title, s: w.hid ? "masquée" : "dans la page", keep: true, on: !w.hid, fn: () => mob.setHidden(id, !w.hid) };
    }) });
    G.push({ h: "Ambiance", tiles: [
      fromLine(/crépuscule/i, "Crépuscule", () => (document.body.classList.contains("dusk-on") ? "actif" : "auto")),
      entity && typeof entity.setOn === "function" ? { t: "Entité", s: entity.on ? "visible" : "masquée", keep: true, fn: () => entity.setOn(!entity.on) } : null,
      { t: "Son des rappels", s: sound.on ? "actif" : "coupé", keep: true, fn: () => sound.set(!sound.on) },
      { t: "Tester un rappel", s: "", fn: test } ] });
    G.push({ h: "Données", tiles: [
      { t: "Exporter", s: ago(prefs.get("dernier-export", "")), fn: data.exportFile },
      { t: "Importer un export", s: "", fn: data.importFile },
      { t: "Coffre du Hub", s: "ajoute sans effacer", fn: data.importCoffre },
      { t: "Synchro PC / téléphone", s: "réglages", fn: () => $("b-diag").click() } ] });
    G.push({ h: "Réglages et diagnostic", tiles: [{ t: "Réglages et diagnostic…", s: "", fn: () => $("b-diag").click() }] });
    const rest = cache.filter((l) => !used.has(l));
    if (rest.length) G.push({ h: "Autres actions", list: true, tiles: rest.map((l) => ({ t: l.t, s: l.k || "", fn: l.fn })) });
    return G;
  }

  function groups() {
    used.clear(); cache = lines();
    if (lite) return groupsMobile();
    const hidden = wins.hiddenEls(), prog = wins.elById("progress"), mails = wins.elById("mails");
    const G = [];
    G.push({ h: "Gestes", tiles: [
      fromLine(/^Focus 25|^Arrêter le Focus/), fromLine(/^Focus 50/), fromLine(/^Revoir le briefing/, "Revoir le briefing"),
      fromLine(/^Capture rapide/), fromLine(/image ici/i, "Ajouter une image"),
      { t: fsOn() ? "Quitter le plein écran" : "Plein écran", s: "F11", fn: () => $("fs").click() },
      fromLine(/^Verrouiller maintenant/, "Verrouiller", () => "actif") ] });
    G.push({ h: "Fenêtres rangées", tiles: [
      prog ? { t: "Progression", s: "détail", fn: () => wins.focus(prog) } : null,
      mails ? { t: "Mails", s: wins.S.mails && wins.S.mails.res ? "à remettre dans le hub" : "à configurer", fn: () => { if (wins.S.mails.res) wins.setReserve(mails, false); wins.focus(mails); } } : null,
      { t: "Fenêtres masquées", s: hidden.length ? hidden.length + " masquée(s)" : "aucune", keep: true, off: !hidden.length, fn: () => { showHidden = !showHidden; render(); } },
      { t: "Disposition d'origine", s: "plan 1 et plan 2", fn: resetLayout } ] });
    G.push({ h: "Ambiance", tiles: [
      fromLine(/crépuscule/i, "Crépuscule", () => (document.body.classList.contains("dusk-on") ? "actif" : "auto")),
      { t: "Entité", s: entity.on ? "visible" : "masquée", keep: true, fn: () => entity.setOn(!entity.on) },
      { t: "Curseur HUD", s: cursor.forced ? "forcé" : cursor.on ? "actif" : "normal", keep: true, fn: () => cursor.toggle() },
      { t: "Son des rappels", s: sound.on ? "actif" : "coupé", keep: true, fn: () => sound.set(!sound.on) },
      { t: "Tester un rappel", s: "", fn: test } ] });
    G.push({ h: "Données", tiles: [
      { t: "Exporter", s: ago(prefs.get("dernier-export", "")), fn: data.exportFile },
      { t: "Importer un export", s: "", fn: data.importFile },
      { t: "Coffre du Hub", s: "ajoute sans effacer", fn: data.importCoffre },
      { t: "Synchro PC / téléphone", s: "réglages", fn: () => $("b-diag").click() } ] });
    G.push({ h: "Fonctions en réserve", note: "Hors de la vue, code gardé : un clic les range ou les remet.", tiles: PAR_DEFAUT.map((id) => {
      const el = wins.elById(id), s = wins.S[id]; if (!el || !s) return null;
      return { t: wins.title(el), s: s.res ? "en réserve" : "dans le hub", keep: true, on: !s.res, fn: () => wins.setReserve(el, !s.res) };
    }) });
    G.push({ h: "Affichage", tiles: [
      { t: "Compteur img/s", s: document.body.classList.contains("show-fps") ? "affiché" : "caché", keep: true, fn: () => { const on = !document.body.classList.contains("show-fps"); document.body.classList.toggle("show-fps", on); prefs.setOn("compteur-fps", on); } },
      { t: "Salle allégée", s: document.body.classList.contains("salle-light") ? "sans reflets" : "avec reflets", keep: true, fn: () => { const on = !document.body.classList.contains("salle-light"); document.body.classList.toggle("salle-light", on); prefs.setOn("salle-allegee", on); } } ] });
    G.push({ h: "Palette", tiles: [{ t: "Raccourci Ctrl+K", s: prefs.get("palette-ctrlk", "1") !== "0" ? "actif" : "coupé", keep: true, on: prefs.get("palette-ctrlk", "1") !== "0", fn: () => { prefs.set("palette-ctrlk", prefs.get("palette-ctrlk", "1") !== "0" ? "0" : "1"); } }] });
    G.push({ h: "Réglages et diagnostic", tiles: [{ t: "Réglages et diagnostic…", s: "touche D", fn: () => $("b-diag").click() }] });
    const rest = cache.filter((l) => !used.has(l));
    if (rest.length) G.push({ h: "Autres actions", list: true, tiles: rest.map((l) => ({ t: l.t, s: l.k || "", fn: l.fn })) });
    return G;
  }

  // Palette tapée : un champ en haut filtre les tuiles (titre, état, groupe) ; Entrée lance la première tuile visible, flèches haut/bas
  // passent de l'une à l'autre. Ctrl+K ouvre Outils sur ce champ (réglage « palette-ctrlk », actif par défaut, coupable depuis la tuile).
  const head = document.createElement("div"); head.className = "o-head";
  const h = document.createElement("h2"); h.textContent = "Outils";
  const x = document.createElement("button"); x.type = "button"; x.className = "o-x"; x.textContent = "×"; x.setAttribute("aria-label", "Fermer les outils"); x.addEventListener("click", close);
  head.append(h, x);
  const inp = document.createElement("input"); inp.type = "search"; inp.className = "o-q"; inp.placeholder = "Taper une action…"; inp.setAttribute("aria-label", "Chercher une action"); inp.autocomplete = "off"; inp.spellcheck = false;
  const body = document.createElement("div"); body.className = "o-body";
  box.append(head, inp, body);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tilesOk = () => [...body.querySelectorAll(".o-tile:not(:disabled)")];
  inp.addEventListener("input", render);
  inp.addEventListener("keydown", (e) => {
    const L = tilesOk();
    if (e.key === "Enter") { e.preventDefault(); if (L[0]) L[0].click(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (L[0]) L[0].focus(); }
  });
  body.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const L = tilesOk(), i = L.indexOf(document.activeElement); if (i < 0) return; e.preventDefault();
    if (e.key === "ArrowUp" && i === 0) { inp.focus(); return; }
    const n = L[i + (e.key === "ArrowDown" ? 1 : -1)]; if (n) n.focus();
  });

  function render() {
    body.innerHTML = "";
    const q = norm(inp.value).trim().split(/\s+/).filter(Boolean);
    groups().forEach((g) => {
      const tiles = g.tiles.filter(Boolean).filter((tl) => !q.length || q.every((w) => norm(tl.t + " " + (tl.s || "") + " " + g.h).includes(w))); if (!tiles.length) return;
      const sec = document.createElement("section"); const t = document.createElement("div"); t.className = "o-grp"; t.textContent = g.h; sec.append(t);
      if (g.note && !q.length) { const n = document.createElement("div"); n.className = "o-note"; n.textContent = g.note; sec.append(n); }
      const grid = document.createElement("div"); grid.className = "o-grid" + (g.list ? " list" : "");
      tiles.forEach((tl) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "o-tile" + (tl.on ? " on" : ""); b.disabled = !!tl.off;
        const a = document.createElement("span"); a.textContent = tl.t; b.append(a);
        if (tl.s) { const s = document.createElement("em"); s.textContent = tl.s; b.append(s); }
        b.addEventListener("click", () => { const keep = tl.keep; if (!keep) close(); try { tl.fn && tl.fn(); } catch (e) { console.error(e); toast("Action impossible : " + e.message); } if (keep) render(); });
        grid.append(b);
      });
      sec.append(grid);
      if (g.h === "Fenêtres rangées" && showHidden && !q.length) {
        const list = document.createElement("div"); list.className = "o-grid list";
        const hl = lite ? mob.list().filter((w) => w.hid).map((w) => ({ title: w.title, show: () => mob.setHidden(w.id, false) })) : wins.hiddenEls().map((el) => ({ title: wins.title(el), show: () => wins.setHidden(el, false) }));
        hl.forEach((h) => { const b = document.createElement("button"); b.type = "button"; b.className = "o-tile"; b.textContent = "Afficher « " + h.title + " »"; b.addEventListener("click", () => { h.show(); render(); }); list.append(b); });
        sec.append(list);
      }
      body.append(sec);
    });
    if (q.length && !body.children.length) { const n = document.createElement("div"); n.className = "o-note"; n.textContent = "Aucune action ne correspond."; body.append(n); }
  }
  function open(typed) { inp.value = ""; render(); box.hidden = false; if (btn) btn.setAttribute("aria-pressed", "true"); if (typed) { inp.focus({ preventScroll: true }); return; } const f = box.querySelector(".o-tile:not(:disabled)"); if (f) f.focus({ preventScroll: true }); }
  function close() { box.hidden = true; if (btn) btn.setAttribute("aria-pressed", "false"); }
  const toggle = () => (box.hidden ? open() : close());

  if (btn) btn.addEventListener("click", toggle);
  document.addEventListener("hub:outils", () => open());
  addEventListener("pointerdown", (e) => { if (!box.hidden && !box.contains(e.target) && !(e.target.closest && e.target.closest("#b-outils, #ctx, .perso, .cat-ask"))) close(); }, true);
  addEventListener("keydown", (e) => {
    // Ctrl+K : palette. On ne prend la touche que si le focus n'est pas dans un champ et que le réglage est actif ; Maj ou Alt la laissent au navigateur.
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && prefs.get("palette-ctrlk", "1") !== "0") {
      if (e.target.closest && e.target.closest("input, textarea, [contenteditable='true']") && !box.contains(e.target) && e.target.id !== "q") return;
      e.preventDefault(); e.stopPropagation(); if (box.hidden) open(true); else { inp.focus(); inp.select(); } return;
    }
    if (e.key === "Escape" && !box.hidden && box.contains(e.target)) { e.stopPropagation(); close(); return; }
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable='true']")) return;
    if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); close(); return; }
    if ((e.key === "o" || e.key === "O") && !e.ctrlKey && !e.metaKey && !e.altKey && $("diag").hidden) toggle();
  }, true);
  return { open, close };
}
