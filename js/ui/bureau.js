// Bureau du plan 3 (ergo-plan 3, étape p3-bureau) : icônes flottantes, petites, qu'on place où on veut sur le plan 3.
// Chaque icône est un hexagone de verre lumineux (la forme du logo) avec un halo de sa couleur ; un clic l'ouvre, un glisser la déplace.
// Les icônes remplacent l'ancienne barre d'applis. Réglages gardés sur l'appareil (clé hub-bureau-v1, donc aussi dans l'export).
// Les applis ◇ (demandent la petite appli Windows) restent affichées, atténuées. Aucun fond d'écran ajouté : la scène du hub est le fond.
import { onBackground } from "./dom.js";
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { registerMenu, extendMenu } from "./menus.js";
import { pulse } from "../state.js";

const KEY = "bureau-v1";
const GRID = 8;
const SIZES = [["s", 44, "petite"], ["m", 56, "moyenne"], ["l", 72, "grande"]];
const COULEURS = [["cyan", "cyan"], ["violet", "violet"], ["ambre", "ambre"], ["vert", "vert"]];
const EXTRA = {
  cast: "M3 5h18v14h-6M3 12a7 7 0 0 1 7 7M3 16a3 3 0 0 1 3 3M3 20h.01",
  globe: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"
};
const DEFAUT = [["hub:fichiers", "cyan"], ["hub:pc", "ambre"], ["hub:internet", "violet"], ["hub:mails", "vert"], ["app:Paramètres", "cyan"], ["app:Calculatrice", "vert"], ["app:Capture", "violet"], ["app:Brave", "ambre"], ["hub:direct", "ambre"]];
const POS = [[0.365, 0.66], [0.455, 0.62], [0.545, 0.62], [0.635, 0.66], [0.365, 0.82], [0.455, 0.78], [0.545, 0.78], [0.635, 0.82], [0.275, 0.72]];
const VERSION = 3;   // 2 : les applis du hub (Fichiers, Ce PC, Internet, Mails) s'ajoutent aux icônes déjà posées ; 3 : + Écran en direct

/** `apps` et `quick` : listes [nom, glyphe, adresse] de widgets/mypc.js ; `ico` : tracés des glyphes ; `openWindows` : ouvre une adresse Windows. */
export function initBureau({ desk, plans, apps, quick, ico, openWindows, hubApps = [], openApp = () => {} }) {
  const G = { ...ico, ...EXTRA };
  const cat = [];
  hubApps.forEach((a) => cat.push({ k: "hub:" + a.k, name: a.name, g: a.g, act: a.k, a: a.a }));
  apps.forEach(([name, g, uri]) => cat.push({ k: "app:" + name, name, g, uri }));
  quick.forEach(([name, g, uri]) => cat.push({ k: "q:" + name, name, g, uri }));
  const find = (k) => cat.find((c) => c.k === k);

  const svg = (g, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${G[g] || G.star}"/></svg>`;
  const uid = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- État ----------
  let icons = [];
  function defaults() { return DEFAUT.map(([k, a], i) => ({ id: uid(), k, a, s: "m", x: POS[i][0], y: POS[i][1] })).filter((i) => find(i.k)); }
  try {
    const d = JSON.parse(prefs.get(KEY, "null"));
    if (d && Array.isArray(d.icons)) icons = d.icons.filter((i) => i && typeof i.id === "string" && Number.isFinite(i.x) && Number.isFinite(i.y) && (i.k === "url" ? /^https:\/\//.test(i.u || "") : find(i.k)));
    else icons = defaults();
  } catch (e) { icons = defaults(); }
  const save = () => prefs.set(KEY, JSON.stringify({ v: VERSION, icons }));
  try {   // migration v1 -> v2 : on garde les icônes posées et on ajoute les applis du hub sur une rangée libre
    const d = JSON.parse(prefs.get(KEY, "null"));
    if (d && d.v !== VERSION) {
      DEFAUT.forEach(([k, a], n) => { if (k.startsWith("hub:") && find(k) && !icons.some((i) => i.k === k)) icons.push({ id: uid(), k, a, s: "m", x: POS[n][0], y: n < 4 ? 0.5 : POS[n][1] }); });
      save();
    }
  } catch (e) { /* rien à migrer */ }
  const info = (i) => (i.k === "url" ? { name: i.n || "Lien", g: i.g || "globe", uri: i.u } : { ...find(i.k), name: i.n || find(i.k).name });

  // ---------- Calque ----------
  const layer = document.createElement("div"); layer.className = "dicos"; layer.setAttribute("role", "group"); layer.setAttribute("aria-label", "Icônes du bureau");
  desk.append(layer);

  function hexHTML(it, a, sz) {
    return `<span class="hx"><span class="fl"></span><span class="bd"></span><span class="pu"></span><span class="gl">${svg(it.g, Math.round(sz * 0.46))}</span></span>`;
  }
  function make(i) {
    const it = info(i), sz = (SIZES.find((s) => s[0] === i.s) || SIZES[1])[1];
    const b = document.createElement("button"); b.type = "button"; b.className = "dico" + (it.uri || it.act ? "" : " off"); b.dataset.id = i.id; b.dataset.menu = "dico"; if (it.act) b.dataset.act = it.act;
    b.style.left = (i.x * 100).toFixed(3) + "%"; b.style.top = (i.y * 100).toFixed(3) + "%";
    b.style.setProperty("--sz", sz); b.dataset.a = i.a || "cyan";
    b.style.setProperty("--dl", (-(Math.abs(i.x * 7 + i.y * 11) % 1) * 7).toFixed(2) + "s");
    b.innerHTML = hexHTML(it, i.a, sz) + `<span class="dlb"></span>`;
    b.querySelector(".dlb").textContent = it.name;
    b.title = it.uri || it.act ? it.name + (it.uri === "ici" ? "" : " · clic pour ouvrir, glisser pour déplacer") : it.name + " : demandera la petite appli Windows (V2)";
    if (!it.uri && !it.act) b.insertAdjacentHTML("beforeend", '<span class="mk" aria-hidden="true">◇</span>');
    return b;
  }
  function render() { layer.innerHTML = ""; icons.forEach((i) => { const b = make(i); if (sel.has(i.id)) b.classList.add("sel"); layer.append(b); }); }
  const byId = (id) => icons.find((i) => i.id === id);

  // ---------- Sélection (p3-lasso) : lasso sur le fond du bureau, Maj ou Ctrl + clic, Ctrl + A ; glisser une icône choisie déplace tout le groupe ----------
  const sel = new Set();
  const paintSel = () => { [...layer.querySelectorAll(".dico")].forEach((b) => b.classList.toggle("sel", sel.has(b.dataset.id))); };
  const setSel = (ids) => { sel.clear(); ids.forEach((id) => sel.add(id)); paintSel(); };
  const clearSel = () => { if (sel.size) { sel.clear(); paintSel(); } };
  const toggleSel = (id) => { if (sel.has(id)) sel.delete(id); else sel.add(id); paintSel(); };
  const selIcons = () => icons.filter((i) => sel.has(i.id));
  let lasso = null;
  addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || plans.plan !== 3 || !desk.classList.contains("on") || !onBackground(e.target) || e.target.closest(".desk, .bur-pop, .dico")) return;
    const r = layer.getBoundingClientRect(), add = e.shiftKey || e.ctrlKey || e.metaKey;
    lasso = { x0: e.clientX - r.left, y0: e.clientY - r.top, base: add ? [...sel] : [], moved: false, el: null, r };
  });
  addEventListener("pointermove", (e) => {
    if (!lasso) return;
    const x = e.clientX - lasso.r.left, y = e.clientY - lasso.r.top;
    if (!lasso.moved && Math.hypot(x - lasso.x0, y - lasso.y0) < 6) return;
    if (!lasso.moved) { lasso.moved = true; lasso.el = document.createElement("div"); lasso.el.className = "lasso"; lasso.el.setAttribute("aria-hidden", "true"); layer.append(lasso.el); }
    const l = Math.min(x, lasso.x0), t = Math.min(y, lasso.y0), w = Math.abs(x - lasso.x0), h = Math.abs(y - lasso.y0);
    Object.assign(lasso.el.style, { left: l + "px", top: t + "px", width: w + "px", height: h + "px" });
    const hit = icons.filter((i) => { const cx = i.x * lasso.r.width, cy = i.y * lasso.r.height, m = 28; return cx + m > l && cx - m < l + w && cy + m > t && cy - m < t + h; }).map((i) => i.id);
    setSel([...lasso.base, ...hit]);
  });
  const endLasso = () => {
    if (!lasso) return; const d = lasso; lasso = null; if (d.el) d.el.remove();
    if (!d.moved) { if (!d.base.length) clearSel(); return; }
    if (sel.size) toast(sel.size + (sel.size > 1 ? " icônes sélectionnées" : " icône sélectionnée") + " · clic droit pour les actions");
  };
  addEventListener("pointerup", endLasso); addEventListener("pointercancel", endLasso);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && sel.size && !pop && !e.defaultPrevented && !(e.target.closest && e.target.closest(".dwin"))) clearSel(); });

  function run(i) {
    const it = info(i);
    pulse(0.7);
    if (it.act) { openApp(it.act); return; }
    if (it.uri === "ici") { toast("Brave : tu y es déjà"); return; }
    if (!it.uri) { toast(it.name + " : prévu avec la petite appli Windows (V2)"); return; }
    if (i.k === "url") { window.open(it.uri, "_blank", "noopener,noreferrer"); return; }
    openWindows(it.uri);
  }

  // ---------- Glisser / cliquer ----------
  let drag = null;
  layer.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".dico"); if (!b || e.button !== 0) return;
    const r = layer.getBoundingClientRect(), i = byId(b.dataset.id); if (!i) return;
    if ((e.shiftKey || e.ctrlKey || e.metaKey)) { drag = { b, i, x0: e.clientX, y0: e.clientY, moved: false, toggle: true, ox: 0, oy: 0 }; return; }
    drag = { b, i, grp: sel.has(i.id) && sel.size > 1 ? selIcons().map((j) => ({ j, x: j.x, y: j.y, b: layer.querySelector('.dico[data-id="' + j.id + '"]') })) : null, ix: i.x, iy: i.y, x0: e.clientX, y0: e.clientY, moved: false, ox: i.x * r.width - (e.clientX - r.left), oy: i.y * r.height - (e.clientY - r.top) };
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* sans capture : le glisser marche quand même dans la fenêtre */ }
  });
  layer.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    if (drag.toggle) return;
    if (!drag.moved) { drag.moved = true; drag.b.classList.add("dragging"); drag.b.classList.remove("settle"); if (!drag.grp) clearSel(); }
    const r = layer.getBoundingClientRect();
    drag.i.x = clamp((e.clientX - r.left + drag.ox) / r.width, 0.03, 0.97); drag.i.y = clamp((e.clientY - r.top + drag.oy) / r.height, 0.05, 0.95);
    drag.b.style.left = (drag.i.x * 100).toFixed(3) + "%"; drag.b.style.top = (drag.i.y * 100).toFixed(3) + "%";
    if (drag.grp) {   // le groupe suit : même décalage, en gardant chaque icône dans le bureau
      let dx = drag.i.x - drag.ix, dy = drag.i.y - drag.iy;
      drag.grp.forEach((g) => { dx = clamp(dx, 0.03 - g.x, 0.97 - g.x); dy = clamp(dy, 0.05 - g.y, 0.95 - g.y); });
      drag.grp.forEach((g) => { g.j.x = g.x + dx; g.j.y = g.y + dy; g.b.style.left = (g.j.x * 100).toFixed(3) + "%"; g.b.style.top = (g.j.y * 100).toFixed(3) + "%"; });
    }
  });
  function end(e, cancel) {
    if (!drag) return; const d = drag; drag = null;
    d.b.classList.remove("dragging");
    if (d.moved) {
      const r = layer.getBoundingClientRect();
      (d.grp ? d.grp.map((g) => ({ j: g.j, b: g.b })) : [{ j: d.i, b: d.b }]).forEach(({ j, b }) => {
        j.x = clamp(Math.round(j.x * r.width / GRID) * GRID / r.width, 0.03, 0.97); j.y = clamp(Math.round(j.y * r.height / GRID) * GRID / r.height, 0.05, 0.95);
        b.classList.add("settle"); b.style.left = (j.x * 100).toFixed(3) + "%"; b.style.top = (j.y * 100).toFixed(3) + "%";
        setTimeout(() => b.classList.remove("settle"), 360);
      });
      save();
    } else if (d.toggle) { if (!cancel) toggleSel(d.i.id); }
    else if (!cancel) { clearSel(); run(d.i); }
  }
  layer.addEventListener("pointerup", (e) => end(e, false));
  layer.addEventListener("pointercancel", (e) => end(e, true));
  layer.addEventListener("click", (e) => { const b = e.target.closest(".dico"); if (b && e.detail === 0) { const i = byId(b.dataset.id); if (!i) return; if (e.ctrlKey || e.shiftKey || e.metaKey) toggleSel(i.id); else run(i); } });
  layer.addEventListener("contextmenu", (e) => { const b = e.target.closest(".dico"); if (b && !sel.has(b.dataset.id)) clearSel(); }, true);   // clavier : Entrée ou Espace
  layer.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); setSel(icons.map((i) => i.id)); } });
  layer.addEventListener("keydown", (e) => {   // Maj + flèches : décale d'un cran (sans souris)
    const b = e.target.closest(".dico"); if (!b || !e.shiftKey || !e.key.startsWith("Arrow")) return;
    const i = byId(b.dataset.id), r = layer.getBoundingClientRect(); e.preventDefault();
    const dx = { ArrowLeft: -2, ArrowRight: 2 }[e.key] || 0, dy = { ArrowUp: -2, ArrowDown: 2 }[e.key] || 0;
    i.x = clamp(i.x + dx * GRID / r.width, 0.03, 0.97); i.y = clamp(i.y + dy * GRID / r.height, 0.05, 0.95);
    b.style.left = (i.x * 100).toFixed(3) + "%"; b.style.top = (i.y * 100).toFixed(3) + "%"; save();
  });

  // ---------- Actions ----------
  function add(k, extra = {}) {
    if (k !== "url" && icons.some((i) => i.k === k)) { toast("Cette icône est déjà sur le bureau"); return null; }
    const n = icons.length, i = { id: uid(), k, a: extra.a || "cyan", s: "m", x: clamp(0.3 + (n % 6) * 0.08, 0.05, 0.95), y: clamp(0.3 + Math.floor(n / 6) * 0.1, 0.1, 0.9), ...extra };
    icons.push(i); save(); render(); return i;
  }
  const remove = (id) => { icons = icons.filter((i) => i.id !== id); save(); render(); };
  function arrange() {
    const sorted = icons.slice().sort((a, b) => (Math.round(a.y * 6) - Math.round(b.y * 6)) || a.x - b.x);
    sorted.forEach((i, n) => { i.x = 0.22 + (n % 8) * 0.08; i.y = 0.6 + Math.floor(n / 8) * 0.12; });
    save(); render(); toast("Icônes rangées");
  }
  const reset = () => { icons = defaults(); save(); render(); toast("Icônes d'origine remises"); };
  const cycle = (arr, cur) => arr[(arr.findIndex((x) => x[0] === cur) + 1) % arr.length];

  // ---------- Petites fenêtres : sélecteur et saisie ----------
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  addEventListener("pointerdown", (e) => { if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest("#ctx"))) closePop(); }, true);
  addEventListener("keydown", (e) => { if (pop && e.key === "Escape") { e.stopPropagation(); closePop(); } }, true);
  const shell = (title) => {
    closePop(); const d = document.createElement("div"); d.className = "bur-pop"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", title);
    d.innerHTML = '<div class="bp-h"><h3></h3><button type="button" class="o-x" aria-label="Fermer">×</button></div>';
    d.querySelector("h3").textContent = title; d.querySelector(".o-x").addEventListener("click", closePop); document.body.append(d); pop = d; return d;
  };
  function ask(title, label, value, ok, ph) {
    const d = shell(title), f = document.createElement("form"); f.className = "bp-form";
    f.innerHTML = '<label><span></span><input type="text" maxlength="40" autocomplete="off"></label><div class="bp-act"><button type="submit" class="btn">Valider</button></div>';
    f.querySelector("span").textContent = label; const inp = f.querySelector("input"); inp.value = value || ""; if (ph) inp.placeholder = ph;
    f.addEventListener("submit", (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; closePop(); ok(v); });
    d.append(f); inp.focus(); inp.select();
  }
  function picker() {
    const d = shell("Ajouter une icône"), grid = document.createElement("div"); grid.className = "bp-grid";
    const used = new Set(icons.map((i) => i.k));
    cat.forEach((c) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "dico mini" + (c.uri || c.act ? "" : " off") + (used.has(c.k) ? " used" : ""); b.style.setProperty("--sz", 44); b.dataset.a = c.a || (c.k.startsWith("q:") ? "violet" : c.uri ? "cyan" : "ambre");
      b.innerHTML = hexHTML(c, "cyan", 44) + '<span class="dlb"></span>'; b.querySelector(".dlb").textContent = c.name;
      b.title = used.has(c.k) ? "Déjà sur le bureau" : "Poser « " + c.name + " » sur le bureau";
      b.addEventListener("click", () => { if (used.has(c.k)) { toast("Cette icône est déjà sur le bureau"); return; } add(c.k, { a: b.dataset.a }); closePop(); toast("« " + c.name + " » posée sur le bureau · glisse-la où tu veux"); });
      grid.append(b);
    });
    d.append(grid);
    const f = document.createElement("form"); f.className = "bp-form link";
    f.innerHTML = '<div class="bp-t">Un lien internet</div><label><span>Nom</span><input type="text" name="n" maxlength="24" autocomplete="off" placeholder="Mon site"></label><label><span>Adresse</span><input type="text" name="u" maxlength="300" autocomplete="off" placeholder="https://…"></label><p class="bp-err" hidden></p><div class="bp-act"><button type="submit" class="btn">Ajouter le lien</button></div>';
    f.addEventListener("submit", (e) => {
      e.preventDefault(); const err = f.querySelector(".bp-err"), n = f.n.value.trim(); let u = f.u.value.trim();
      if (u && !/^[a-z]+:/i.test(u)) u = "https://" + u;
      let ok = false; try { const x = new URL(u); ok = x.protocol === "https:" && x.hostname.includes("."); u = x.href; } catch (e2) { ok = false; }
      if (!n || !ok) { err.hidden = false; err.textContent = !n ? "Donne un nom à l'icône." : "Adresse invalide : seuls les liens https:// sont acceptés."; return; }
      add("url", { n, u, g: "globe", a: "ambre" }); closePop(); toast("« " + n + " » posé sur le bureau");
    });
    d.append(f);
  }

  // ---------- Menus ----------
  function groupe() {
    const g = selIcons(), n = g.length, moy = (k) => g.reduce((a, i) => a + i[k], 0) / n;
    const maj = (fn) => { g.forEach(fn); save(); render(); };
    return [{ h: n + " icônes sélectionnées" },
      { t: "Aligner en ligne", fn: () => { const y = moy("y"); maj((i) => { i.y = y; }); } },
      { t: "Aligner en colonne", fn: () => { const x = moy("x"); maj((i) => { i.x = x; }); } },
      { t: "Taille", k: (SIZES.find((s) => s[0] === g[0].s) || SIZES[1])[2], fn: () => { const t = cycle(SIZES, g[0].s)[0]; maj((i) => { i.s = t; }); } },
      { t: "Couleur", k: g[0].a || "cyan", fn: () => { const c = cycle(COULEURS, g[0].a || "cyan")[0]; maj((i) => { i.a = c; }); } },
      "-", { t: "Retirer du bureau (" + n + ")", fn: () => { const ids = new Set(g.map((i) => i.id)); icons = icons.filter((i) => !ids.has(i.id)); sel.clear(); save(); render(); toast(n + " icônes retirées (rien n'est supprimé sur le PC)"); } },
      { t: "Désélectionner", fn: clearSel }];
  }
  registerMenu("dico", (el) => {
    const i = byId(el.dataset.id); if (!i) return [];
    if (sel.size > 1 && sel.has(i.id)) return groupe();
    const it = info(i), sz = SIZES.find((s) => s[0] === i.s) || SIZES[1];
    return [{ h: it.name },
      { t: "Ouvrir", fn: () => run(i) },
      { t: "Renommer…", fn: () => ask("Renommer l'icône", "Nom", it.name, (v) => { i.n = v.slice(0, 24); save(); render(); }) },
      { t: "Taille", k: sz[2], fn: () => { i.s = cycle(SIZES, i.s)[0]; save(); render(); } },
      { t: "Couleur", k: i.a || "cyan", fn: () => { i.a = cycle(COULEURS, i.a || "cyan")[0]; save(); render(); } },
      "-", { t: "Retirer du bureau", fn: () => { remove(i.id); toast("Icône retirée (rien n'est supprimé sur le PC)"); } }];
  });
  const lignes = () => [...(sel.size ? [{ t: "Désélectionner (" + sel.size + ")", fn: clearSel }] : []), { t: "Tout sélectionner", k: "Ctrl A", fn: () => setSel(icons.map((i) => i.id)) }, { t: "Ajouter une icône…", fn: picker }, { t: "Ranger les icônes", fn: arrange }, { t: "Icônes d'origine", fn: reset }];
  registerMenu("bureau", lignes);                          // clic droit sur le fond du plan 3 (lu par ui/menus.js)
  extendMenu("desk", () => ["-", ...lignes()]);           // clic droit sur un panneau du bureau

  render();
  return { add, remove, catalogue: () => cat.map((c) => ({ k: c.k, name: c.name })), list: () => icons.map((i) => ({ id: i.id, k: i.k, ...info(i) })), open: (id) => { const i = byId(id); if (i) run(i); }, picker, arrange, reset };
}
