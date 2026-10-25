// Bureau du plan 3 (ergo-plan 3, étape p3-bureau) : icônes flottantes, petites, qu'on place où on veut sur le plan 3.
// Chaque icône est un hexagone de verre lumineux (la forme du logo) avec un halo de sa couleur ; un clic l'ouvre, un glisser la déplace.
// Les icônes remplacent l'ancienne barre d'applis. Réglages gardés sur l'appareil (clé hub-bureau-v1, donc aussi dans l'export).
// Les applis ◇ (demandent la petite appli Windows) restent affichées, atténuées. Aucun fond d'écran ajouté : la scène du hub est le fond.
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { registerMenu, extendMenu } from "./menus.js";
import { pulse } from "../state.js";

const KEY = "bureau-v1";
const GRID = 8;
const SIZES = [["s", 44, "petite"], ["m", 56, "moyenne"], ["l", 72, "grande"]];
const COULEURS = [["cyan", "cyan"], ["violet", "violet"], ["ambre", "ambre"], ["vert", "vert"]];
const EXTRA = {
  globe: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"
};
const DEFAUT = [["hub:fichiers", "cyan"], ["hub:pc", "ambre"], ["hub:internet", "violet"], ["hub:mails", "vert"], ["app:Paramètres", "cyan"], ["app:Calculatrice", "vert"], ["app:Capture", "violet"], ["app:Brave", "ambre"]];
const POS = [[0.365, 0.66], [0.455, 0.62], [0.545, 0.62], [0.635, 0.66], [0.365, 0.82], [0.455, 0.78], [0.545, 0.78], [0.635, 0.82]];
const VERSION = 2;   // 2 : les applis du hub (Fichiers, Ce PC, Internet, Mails) s'ajoutent aux icônes déjà posées

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
      DEFAUT.slice(0, 4).forEach(([k, a], n) => { if (find(k) && !icons.some((i) => i.k === k)) icons.push({ id: uid(), k, a, s: "m", x: POS[n][0], y: 0.5 }); });
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
    const b = document.createElement("button"); b.type = "button"; b.className = "dico" + (it.uri || it.act ? "" : " off"); b.dataset.id = i.id; b.dataset.menu = "dico";
    b.style.left = (i.x * 100).toFixed(3) + "%"; b.style.top = (i.y * 100).toFixed(3) + "%";
    b.style.setProperty("--sz", sz); b.dataset.a = i.a || "cyan";
    b.style.setProperty("--dl", (-(Math.abs(i.x * 7 + i.y * 11) % 1) * 7).toFixed(2) + "s");
    b.innerHTML = hexHTML(it, i.a, sz) + `<span class="dlb"></span>`;
    b.querySelector(".dlb").textContent = it.name;
    b.title = it.uri || it.act ? it.name + (it.uri === "ici" ? "" : " · clic pour ouvrir, glisser pour déplacer") : it.name + " : demandera la petite appli Windows (V2)";
    if (!it.uri && !it.act) b.insertAdjacentHTML("beforeend", '<span class="mk" aria-hidden="true">◇</span>');
    return b;
  }
  function render() { layer.innerHTML = ""; icons.forEach((i) => layer.append(make(i))); }
  const byId = (id) => icons.find((i) => i.id === id);

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
    drag = { b, i, x0: e.clientX, y0: e.clientY, moved: false, ox: i.x * r.width - (e.clientX - r.left), oy: i.y * r.height - (e.clientY - r.top) };
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* sans capture : le glisser marche quand même dans la fenêtre */ }
  });
  layer.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.b.classList.add("dragging"); drag.b.classList.remove("settle"); }
    const r = layer.getBoundingClientRect();
    drag.i.x = clamp((e.clientX - r.left + drag.ox) / r.width, 0.03, 0.97); drag.i.y = clamp((e.clientY - r.top + drag.oy) / r.height, 0.05, 0.95);
    drag.b.style.left = (drag.i.x * 100).toFixed(3) + "%"; drag.b.style.top = (drag.i.y * 100).toFixed(3) + "%";
  });
  function end(e, cancel) {
    if (!drag) return; const d = drag; drag = null;
    d.b.classList.remove("dragging");
    if (d.moved) {
      const r = layer.getBoundingClientRect();
      d.i.x = clamp(Math.round(d.i.x * r.width / GRID) * GRID / r.width, 0.03, 0.97); d.i.y = clamp(Math.round(d.i.y * r.height / GRID) * GRID / r.height, 0.05, 0.95);
      d.b.classList.add("settle"); d.b.style.left = (d.i.x * 100).toFixed(3) + "%"; d.b.style.top = (d.i.y * 100).toFixed(3) + "%";
      setTimeout(() => d.b.classList.remove("settle"), 360); save();
    } else if (!cancel) run(d.i);
  }
  layer.addEventListener("pointerup", (e) => end(e, false));
  layer.addEventListener("pointercancel", (e) => end(e, true));
  layer.addEventListener("click", (e) => { const b = e.target.closest(".dico"); if (b && e.detail === 0) { const i = byId(b.dataset.id); if (i) run(i); } });   // clavier : Entrée ou Espace
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
  registerMenu("dico", (el) => {
    const i = byId(el.dataset.id); if (!i) return [];
    const it = info(i), sz = SIZES.find((s) => s[0] === i.s) || SIZES[1];
    return [{ h: it.name },
      { t: "Ouvrir", fn: () => run(i) },
      { t: "Renommer…", fn: () => ask("Renommer l'icône", "Nom", it.name, (v) => { i.n = v.slice(0, 24); save(); render(); }) },
      { t: "Taille", k: sz[2], fn: () => { i.s = cycle(SIZES, i.s)[0]; save(); render(); } },
      { t: "Couleur", k: i.a || "cyan", fn: () => { i.a = cycle(COULEURS, i.a || "cyan")[0]; save(); render(); } },
      "-", { t: "Retirer du bureau", fn: () => { remove(i.id); toast("Icône retirée (rien n'est supprimé sur le PC)"); } }];
  });
  const lignes = () => [{ t: "Ajouter une icône…", fn: picker }, { t: "Ranger les icônes", fn: arrange }, { t: "Icônes d'origine", fn: reset }];
  registerMenu("bureau", lignes);                          // clic droit sur le fond du plan 3 (lu par ui/menus.js)
  extendMenu("desk", () => ["-", ...lignes()]);           // clic droit sur un panneau du bureau

  render();
  return { add, remove, list: () => icons.map((i) => ({ id: i.id, ...info(i) })), open: (id) => { const i = byId(id); if (i) run(i); }, picker, arrange, reset };
}
