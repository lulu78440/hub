// Menus du hub (2.2).
// PC : clic droit propre à chaque endroit (fond, fenêtre, entité, bureau du plan 3). Maj + clic droit : menu de Brave.
// Mobile : appui long sur le titre d'une fenêtre pour la masquer ou la déplacer dans la pile ; ordre mémorisé.
// Les widgets ajoutent leurs propres lignes en haut du menu de leur fenêtre avec registerMenu(id, fn).
// Une zone hors fenêtre marquée data-menu="nom" (ex. la bande d'agenda) a son propre menu : registerMenu("nom", fn).
import { state } from "../state.js";
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { createMenu } from "./ctxmenu.js";
import { buzz } from "../device/vibrate.js";
import { sound } from "../device/sound.js";

const hooks = {};
/** fn(el, cible) renvoie les lignes propres à la fenêtre `id` (voir ctxmenu.js pour le format). */
export function registerMenu(id, fn) { hooks[id] = fn; }
/** Ajoute des lignes à un menu déjà enregistré (ex. « fond », « fenetre ») au lieu de le remplacer. */
export function extendMenu(id, fn) { const prev = hooks[id]; hooks[id] = (...a) => (prev ? prev(...a) || [] : []).concat(fn(...a) || []); }

const MOB_STORE = "disposition-mobile-v1";

export function initMenus({ wins, plans, entity, cursor, resetLayout, data, test }) {
  const menu = createMenu(document.getElementById("ctx"));
  const $ = (id) => document.getElementById(id);

  // ---------- PC ----------
  function entMenu() {
    return [{ h: "Entité · en sommeil" }, { note: "Son IA sera branchée en phase 6" },
      { t: entity.docked ? "La reprendre (elle te suit)" : "La poser sur le logo", fn: () => entity.setDock(!entity.docked) },
      { t: "La réveiller", fn: () => toast("Pas encore : elle se réveillera quand l'IA sera branchée (phase 6)") },
      { t: "Masquer l'entité", fn: () => entity.setOn(false) }];
  }
  // Menus allégés (refonte, 25/10) : peu de lignes en tête, le reste derrière « Plus… » ; plus aucune navigation
  // (changer de plan, ramener vers soi ou devant se fait à la molette). Rien ne disparaît : les lignes rares restent à un clic.
  let at = { x: 0, y: 0 };
  const level = (items) => menu.open(at.x, at.y, items);
  const lines = (arr) => (arr || []).filter((i) => i && i !== "-" && !i.h && !i.note);
  const FOND_TETE = [/^Focus 25/, /^Arrêter le Focus/, /^Revoir le briefing/, /image ici/i, /^Verrouiller maintenant/];
  function bgMenu(t, x, y, back) {
    const all = lines(hooks.fond ? hooks.fond(t, x, y) : []);
    const head = all.filter((i) => FOND_TETE.some((r) => r.test(i.t))), rest = all.filter((i) => !head.includes(i));
    const hidden = wins.hiddenEls();
    const plus = [...rest,
      { t: entity.on ? "Masquer l'entité" : "Afficher l'entité", fn: () => entity.setOn(!entity.on) },
      "-", { t: document.fullscreenElement ? "Quitter le plein écran" : "Plein écran", k: "F11", fn: () => $("fs").click() },
      { t: cursor.forced ? "Curseur normal" : "Curseur HUD", fn: () => toast(cursor.toggle() ? "Curseur HUD activé" : (cursor.on ? "Curseur HUD : reste actif en plein écran" : "Curseur normal")) },
      { t: "Réinitialiser la disposition", fn: resetLayout },
      "-", { h: "Rappels" },
      { t: sound.on ? "Couper le son des rappels" : "Activer le son des rappels", fn: () => { sound.set(!sound.on); toast(sound.on ? "Son des rappels activé" : "Son des rappels coupé"); } },
      { t: "Tester un rappel", fn: test },
      "-", { h: "Mes données" },
      { t: "Exporter (fichier de sauvegarde)", fn: data.exportFile },
      { t: "Importer un export…", fn: data.importFile },
      { t: "Importer le Coffre du Hub (ajoute sans effacer)…", fn: data.importCoffre },
      "-", { t: "‹ Retour", fn: () => level(bgMenu(t, x, y)) }];
    if (back) return plus;
    const it = [{ h: "Hub" }, ...head];
    if (hidden.length) it.push({ t: "Fenêtres masquées (" + hidden.length + ")…", fn: () => level([{ h: "Fenêtres masquées" },
      ...hidden.map((el) => ({ t: "Afficher « " + wins.title(el) + " »", fn: () => wins.setHidden(el, false) })), "-", { t: "‹ Retour", fn: () => level(bgMenu(t, x, y)) }]) });
    it.push("-", { t: "Plus…", fn: () => level([{ h: "Hub · plus" }, ...bgMenu(t, x, y, true)]) });
    return it;
  }
  function winMenu(el, t, back) {
    const id = el.dataset.id, s = wins.S[id];
    const own = lines(hooks[id] ? hooks[id](el, t) || [] : []), extra = lines(hooks.fenetre ? hooks.fenetre(el, t) || [] : []);
    const plus = [...own.slice(3), ...extra,
      { t: s.max ? "Restaurer la taille" : "Agrandir", k: "double-clic", fn: () => wins.toggleMax(el), off: s.pin },
      "-", { t: "‹ Retour", fn: () => level(winMenu(el, t)) }];
    if (back) return plus;
    return [{ h: wins.title(el) }, ...own.slice(0, 3), ...(own.length ? ["-"] : []),
      { t: s.red ? "Rouvrir" : "Réduire", fn: () => wins.toggleReduced(el) },
      { t: "Personnaliser…", fn: () => wins.personnaliser(el) },
      { t: s.pin ? "Libérer la fenêtre" : "Figer la fenêtre", fn: () => wins.togglePin(el) },
      { t: "Masquer la fenêtre", fn: () => wins.setHidden(el, true) },
      "-", { t: "Plus…", fn: () => level([{ h: wins.title(el) + " · plus" }, ...winMenu(el, t, true)]) }];
  }
  function deskMenu() {
    return [{ h: "Plan 3 · bureau du PC" }, { note: "Dossiers, fichiers et applis : sous-étape 2.8" },
      { t: "Revenir au hub", k: "1", fn: () => plans.goPlan(1) },
      { t: "Aller au plan 2", k: "2", fn: () => plans.goPlan(2) },
      { t: "Écran en direct · bientôt", off: true }];
  }
  addEventListener("contextmenu", (e) => {
    if (state.lite || e.shiftKey) return;
    const t = e.target && e.target.closest ? e.target : document.body;
    if (t.closest("input, textarea, [contenteditable='true'], .diag, .ctx")) return;
    e.preventDefault(); at = { x: e.clientX, y: e.clientY };
    const winEl = t.closest(".win:not(.mob-only)"), zone = t.closest("[data-menu]");
    const items = t.closest("#logo") || (entity.near(e.clientX, e.clientY) && !zone && !winEl && !t.closest(".top")) ? entMenu()
      : zone && hooks[zone.dataset.menu] ? hooks[zone.dataset.menu](zone, t) || []
      : winEl ? winMenu(winEl, t)
      : plans.plan === 3 ? deskMenu()
      : bgMenu(t, e.clientX, e.clientY);
    menu.open(e.clientX, e.clientY, items);
  });

  // ---------- Mobile ----------
  if (!state.lite) return { menu };
  const mwins = [...document.querySelectorAll("#world .win:not(.pc-only)")];
  const byId = (id) => mwins.find((w) => w.dataset.id === id);
  const original = mwins.map((w) => w.dataset.id).sort((a, b) => (+getComputedStyle(byId(a)).order || 0) - (+getComputedStyle(byId(b)).order || 0));
  let order = original.slice(), hid = [];
  try {
    const d = JSON.parse(prefs.get(MOB_STORE, "null"));
    if (d && Array.isArray(d.order)) {
      order = d.order.filter((id) => byId(id));
      original.forEach((id) => { if (!order.includes(id)) order.push(id); });   // fenêtre ajoutée par une nouvelle version
      hid = (Array.isArray(d.hid) ? d.hid : []).filter((id) => byId(id));
    }
  } catch (e) { /* disposition illisible : ordre d'origine */ }

  const bar = $("mlayout"), chips = $("mlayout-hidden");
  const titleOf = (id) => byId(id).querySelector("h2").textContent;
  function apply() {
    order.forEach((id, i) => { const w = byId(id); w.style.order = String(3 + i); w.classList.toggle("mhid", hid.includes(id)); });
    chips.innerHTML = "";
    hid.forEach((id) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "+ " + titleOf(id);
      b.addEventListener("click", () => { hid = hid.filter((x) => x !== id); save(); toast("« " + titleOf(id) + " » réaffichée"); });
      chips.append(b);
    });
    bar.classList.toggle("has-hidden", hid.length > 0);
  }
  function save() { prefs.set(MOB_STORE, JSON.stringify({ order, hid })); apply(); }
  function moveTo(id, to) { const from = order.indexOf(id); order.splice(from, 1); order.splice(Math.max(0, Math.min(to, order.length)), 0, id); save(); }
  function visibleIndex(id) { return order.filter((x) => !hid.includes(x)).indexOf(id); }
  function stepTo(id, dir) {       // monter / descendre d'une fenêtre visible, en sautant les masquées
    const vis = order.filter((x) => !hid.includes(x)), i = vis.indexOf(id), j = i + dir;
    if (j < 0 || j >= vis.length) return;
    moveTo(id, order.indexOf(vis[j]));
    byId(id).scrollIntoView({ block: "center", behavior: state.reduce ? "auto" : "smooth" });
  }
  // « Ramener vers moi » sur téléphone : la fenêtre reste en place, les autres s'estompent (pas de flou), un bouton la renvoie en arrière.
  let mfoc = null, mexit = null;
  function mUnfocus() {
    if (!mfoc) return; mfoc.classList.remove("mfoc"); mfoc = null; document.getElementById("world").classList.remove("mfocus");
    if (mexit) { mexit.remove(); mexit = null; }
  }
  function mFocus(id) {
    mUnfocus(); const w = byId(id); if (!w) return;
    mfoc = w; w.classList.add("mfoc"); document.getElementById("world").classList.add("mfocus");
    w.scrollIntoView({ block: "center", behavior: state.reduce ? "auto" : "smooth" });
    mexit = document.createElement("button"); mexit.type = "button"; mexit.className = "btn mfocus-exit"; mexit.textContent = "Renvoyer en arrière";
    mexit.addEventListener("click", mUnfocus); document.body.append(mexit);
  }
  addEventListener("pointerdown", (e) => { if (mfoc && !e.target.closest(".mfoc, .mfocus-exit, .ctx")) mUnfocus(); }, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape") mUnfocus(); });
  function mobMenu(id) {
    const vis = order.filter((x) => !hid.includes(x)).length, i = visibleIndex(id);
    return [{ h: "Fenêtre · " + titleOf(id) },
      { t: "Ramener vers moi", fn: () => mFocus(id) },
      { t: "Monter", fn: () => stepTo(id, -1), off: i <= 0 },
      { t: "Descendre", fn: () => stepTo(id, 1), off: i >= vis - 1 },
      { t: "Tout en haut", fn: () => { moveTo(id, 0); byId(id).scrollIntoView({ block: "center" }); }, off: i <= 0 },
      { t: "Masquer la fenêtre", fn: () => { hid.push(id); save(); toast("« " + titleOf(id) + " » masquée · réaffiche-la en bas de la page"); } },
      "-", { t: "Fermer", fn: () => {} }];
  }
  $("mlayout-reset").addEventListener("click", () => { order = original.slice(); hid = []; save(); toast("Ordre d'origine restauré"); });

  // Appui long sur la barre de titre
  let timer = 0, start = null;
  const cancel = () => { clearTimeout(timer); timer = 0; start = null; };
  mwins.forEach((w) => {
    const ph = w.querySelector(".ph");
    ph.addEventListener("contextmenu", (e) => e.preventDefault());
    ph.addEventListener("pointerdown", (e) => {
      cancel(); start = { x: e.clientX, y: e.clientY };
      ph.classList.add("pressing");
      timer = setTimeout(() => { ph.classList.remove("pressing"); timer = 0; buzz(); menu.open(0, 0, mobMenu(w.dataset.id)); }, 550);
    });
    const stop = () => { ph.classList.remove("pressing"); cancel(); };
    ph.addEventListener("pointermove", (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) stop(); });
    ph.addEventListener("pointerup", stop); ph.addEventListener("pointercancel", stop); ph.addEventListener("pointerleave", stop);
  });
  addEventListener("scroll", () => menu.close(), { passive: true });
  apply();
  return { menu };
}
