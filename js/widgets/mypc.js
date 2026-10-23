// Mon PC (fenêtre du plan 1) et bureau du PC (plan 3), sous-étape 2.8.
// ✓ = marche depuis le navigateur ; ◇ = demandera la petite appli Windows (V2), affiché mais inactif.
// Dossiers : accès mémorisé si Brave l'autorise (brave://flags/#file-system-access-api), sinon dossier choisi pour la session.
import { battery, network, screenInfo, openWindows } from "../device/system.js";
import { persistentSupported, savedFolders, forgetFolder, pickFolder, permission, rootOf, fromFileList, recentFiles, openFile } from "../device/folders.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { pulse } from "../state.js";
import { prefs } from "../store/prefs.js";

const ICO = {
  folder: "M3 7h6l2 2h10v10H3z", download: "M12 4v11M7 10l5 5 5-5M4 20h16", capture: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  calc: "M5 3h14v18H5zM8 7h8M8 12h1M12 12h1M16 12h1M8 16h1M12 16h1M16 16h1", gear: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  sound: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12", wifi: "M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01",
  bt: "M7 7l10 10-5 4V3l5 4L7 17", desk: "M3 4h18v12H3zM8 20h8M12 16v4", doc: "M6 2h9l5 5v15H6zM14 2v6h6", brave: "M12 3l7 3-1 10-6 5-6-5-1-10z",
  term: "M3 4h18v16H3zM7 9l3 3-3 3M12 15h5", task: "M3 12h4l3-7 4 14 3-7h4", trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13", plus: "M12 5v14M5 12h14",
  moon: "M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z", bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0", batt: "M3 8h15v8H3zM20 11v2", clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2",
  photo: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6", update: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7", lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3", up: "M12 19V5M6 11l6-6 6 6"
};
const svg = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICO[k] || ICO.plus}"/></svg>`;
const EXT = { pdf: "var(--cyan)", md: "var(--cyan)", txt: "var(--cyan)", doc: "#5fb8ff", docx: "#5fb8ff", xls: "var(--ok)", xlsx: "var(--ok)", csv: "var(--ok)", zip: "var(--ok)", png: "var(--violet)", jpg: "var(--violet)", jpeg: "var(--violet)", webp: "var(--violet)", gif: "var(--violet)", mp3: "var(--amber)", mp4: "var(--amber)", mkv: "var(--amber)", html: "var(--amber)", exe: "var(--red)" };
const extOf = (n) => { const m = n.match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toLowerCase() : ""; };
const pad = (n) => String(n).padStart(2, "0");
function when(ms) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date(), days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (days === 0) return pad(d.getHours()) + ":" + pad(d.getMinutes());
  if (days === 1) return "hier";
  if (days < 7) return ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][d.getDay()];
  return pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
}
const size = (b) => b < 1024 ? b + " o" : b < 1048576 ? Math.round(b / 1024) + " Ko" : (b / 1048576).toFixed(1).replace(".", ",") + " Mo";

// Raccourcis Windows : ✓ ouvre la page des Paramètres ou l'appli Windows par son adresse ; ◇ = appli Windows (V2)
const QUICK = [
  ["Wi-Fi", "wifi", "ms-settings:network-wifi"], ["Bluetooth", "bt", "ms-settings:bluetooth"], ["Son", "sound", "ms-settings:sound"], ["Affichage", "desk", "ms-settings:display"],
  ["Ne pas déranger", "bell", "ms-settings:notifications"], ["Mode nuit", "moon", "ms-settings:nightlight"], ["Batterie", "batt", "ms-settings:batterysaver"], ["Mises à jour", "update", "ms-settings:windowsupdate"]
];
const APPS = [
  ["Explorateur", "folder", null], ["Brave", "brave", "ici"], ["Paramètres", "gear", "ms-settings:"], ["Calculatrice", "calc", "calculator:"], ["Capture", "capture", "ms-screenclip:"],
  ["Horloge", "clock", "ms-clock:"], ["Photos", "photo", "ms-photos:"], ["Bloc-notes", "doc", null], ["Terminal", "term", null], ["Tâches Win", "task", null], ["Corbeille", "trash", null]
];

function makePanel(title, accent, tag) {
  const sec = document.createElement("section"); sec.className = "panel dp"; sec.dataset.accent = accent; sec.style.setProperty("--a", `var(--${accent})`);
  sec.innerHTML = `<div class="in"><div class="ph"><h2></h2><span class="hatch"></span><span class="tag"></span></div><div class="pb"></div><div class="pf"><span></span><span></span></div></div>`;
  sec.querySelector("h2").textContent = title; sec.querySelector(".tag").textContent = tag || "";
  return { sec, pb: sec.querySelector(".pb"), pf: sec.querySelector(".pf"), tag: sec.querySelector(".tag") };
}

export function initMyPC({ plans }) {
  const desk = document.getElementById("desk"), win = document.querySelector('.win[data-id="pc"]');
  if (!desk || !win) return;
  let folders = [], session = [], recent = [];   // folders : mémorisés ; session : choisis pour cette visite

  // ---------- Bureau (plan 3) ----------
  const L = desk.querySelector(".dcol.l"), R = desk.querySelector(".dcol.r");
  L.innerHTML = ""; R.innerHTML = "";
  const P = { dirs: makePanel("Dossiers", "cyan", persistentSupported ? "ACCÈS MÉMORISÉ" : "SESSION"), rec: makePanel("Fichiers récents", "violet", "LECTURE SEULE"), sys: makePanel("Système", "amber", "EN DIRECT"), set: makePanel("Réglages rapides", "cyan", "WINDOWS") };
  L.append(P.dirs.sec, P.rec.sec); R.append(P.sys.sec, P.set.sec);
  const bar = document.createElement("nav"); bar.className = "taskbar"; bar.setAttribute("aria-label", "Applications");
  bar.innerHTML = '<span class="tl2">APPLIS</span>';
  APPS.forEach(([name, ic, uri]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "app" + (uri ? "" : " off");
    b.innerHTML = `<span class="hex">${svg(ic)}</span>${name}<span class="mk ${uri ? "ok" : "app2"}">${uri ? "✓" : "◇"}</span>`;
    b.title = uri === "ici" ? "Brave : c'est ici" : uri ? "Ouvrir " + name + " (Brave demande confirmation la première fois)" : name + " : demandera la petite appli Windows (V2)";
    b.addEventListener("click", () => {
      if (uri === "ici") { toast("Brave : tu y es déjà"); return; }
      if (!uri) { toast(name + " : prévu avec la petite appli Windows (V2)"); return; }
      openWindows(uri); pulse(0.7);
    });
    bar.append(b);
  });
  bar.insertAdjacentHTML("beforeend", '<div class="legend"><span class="ok">✓ marche depuis le navigateur</span><span class="app2">◇ demande la petite appli PC (V2)</span></div>');
  desk.append(bar);

  // Système
  P.sys.pb.innerHTML = '<div class="chips"><span>Batterie <b class="s-batt">…</b></span><span>Réseau <b class="s-net">…</b></span><span>Écran <b class="s-scr">…</b></span></div><p class="dnote">◇ Processeur, mémoire et disques s\'afficheront avec la petite appli Windows (V2) : un navigateur n\'y a pas accès.</p>';
  P.sys.pf.firstElementChild.textContent = "✓ batterie, réseau, écran"; P.sys.pf.lastElementChild.textContent = "◇ le reste";
  // Réglages rapides
  const qs = document.createElement("div"); qs.className = "qs";
  QUICK.forEach(([name, ic, uri]) => { const b = document.createElement("button"); b.type = "button"; b.className = "tg"; b.innerHTML = `${svg(ic, 16)}<span>${name}</span>`; b.title = "Ouvre le réglage Windows « " + name + " »"; b.addEventListener("click", () => { openWindows(uri); pulse(0.6); }); qs.append(b); });
  P.set.pb.append(qs);
  P.set.pf.firstElementChild.textContent = "✓ ouvre le réglage Windows"; P.set.pf.lastElementChild.textContent = "◇ réglage direct";

  // ---------- Fenêtre Mon PC (plan 1) ----------
  const pb = win.querySelector(".pb"), wtag = win.querySelector(".tag");
  pb.className = "pb pb-pc";
  wtag.textContent = "EN DIRECT";
  pb.innerHTML = '<div class="chips"><span>Batterie <b class="s-batt">…</b></span><span>Réseau <b class="s-net">…</b></span></div><div class="qa"></div><span class="sub">Fichiers récents</span><ul class="rec"></ul>';
  const qa = pb.querySelector(".qa");
  [["Fichiers", "folder", () => plans.goPlan(3)], ["Récents", "download", () => plans.goPlan(3)], ["Capture", "capture", "ms-screenclip:"], ["Calcul", "calc", "calculator:"],
    ["Réglages", "gear", "ms-settings:"], ["Son", "sound", "ms-settings:sound"], ["Wi-Fi", "wifi", "ms-settings:network-wifi"], ["Bluetooth", "bt", "ms-settings:bluetooth"]].forEach(([name, ic, act]) => {
    const b = document.createElement("button"); b.type = "button"; b.innerHTML = `<span class="hex">${svg(ic)}</span>${name}`;
    b.title = typeof act === "string" ? "Ouvrir " + name + " (Windows)" : "Bureau du PC (plan 3)";
    b.addEventListener("click", () => { if (typeof act === "string") openWindows(act); else act(); pulse(0.6); });
    qa.append(b);
  });

  // ---------- Infos en direct ----------
  const setAll = (cls, text, ok) => document.querySelectorAll("." + cls).forEach((el) => { el.textContent = text; el.classList.toggle("warn", ok === false); });
  function showNet() { const n = network(); setAll("s-net", n.text, n.ok); }
  addEventListener("online", showNet); addEventListener("offline", showNet); showNet();
  setAll("s-scr", screenInfo());
  battery().then((b) => {
    if (!b) { setAll("s-batt", "masquée par Brave"); return; }
    const upd = () => setAll("s-batt", Math.round(b.level * 100) + " %" + (b.charging ? " ⚡" : ""), b.level > 0.15 || b.charging);
    upd(); b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd);
  });

  // ---------- Dossiers ----------
  const dirInput = document.createElement("input"); dirInput.type = "file"; dirInput.hidden = true; dirInput.webkitdirectory = true; dirInput.multiple = true; document.body.append(dirInput);
  let browsing = null;            // { name, stack: [dossiers] } pendant la navigation dans un dossier

  async function addFolder() {
    if (persistentSupported) {
      try { const f = await pickFolder(); await reload(true); toast("Dossier « " + f.name + " » autorisé (lecture seule)"); }
      catch (e) { if (e && e.name !== "AbortError") toast("Dossier non autorisé"); }
    } else dirInput.click();
  }
  dirInput.addEventListener("change", () => {
    const files = [...(dirInput.files || [])]; dirInput.value = ""; if (!files.length) return;
    const root = fromFileList(files);
    session.push({ id: "s" + Date.now(), name: root.name, root, session: true });
    toast(`« ${root.name} » ouvert pour cette visite (${files.length} fichiers)`); renderDirs(); refreshRecent();
  });

  // Garde-fou : si une lecture des dossiers mémorisés a fait planter l'onglet, on ne la relance pas toute seule au démarrage.
  let paused = false;
  async function reload(manual) {
    if (!manual && prefs.get("dossiers-lecture", "") === "en-cours") { paused = true; renderDirs(); return; }
    paused = false;
    prefs.set("dossiers-lecture", "en-cours");
    folders = [];
    try { for (const f of await savedFolders()) folders.push({ ...f, state: await permission(f) }); }
    finally { prefs.set("dossiers-lecture", "ok"); }
    renderDirs(); refreshRecent();
  }
  async function unlock(f) { f.state = await permission(f, true); if (f.state === "granted") { renderDirs(); refreshRecent(); } else toast("Accès refusé : Brave n'a pas donné la permission"); }
  const rootFor = (f) => f.session ? f.root : rootOf(f);

  function renderDirs() {
    const box = P.dirs.pb; box.innerHTML = "";
    if (browsing) { renderBrowse(); return; }
    const all = folders.concat(session);
    if (paused) {
      const n = document.createElement("p"); n.className = "dnote";
      n.textContent = "La lecture des dossiers mémorisés s'est mal passée la dernière fois : elle est en pause. ";
      const r = document.createElement("button"); r.type = "button"; r.className = "lnk"; r.textContent = "Réessayer"; r.addEventListener("click", () => reload(true));
      n.append(r); box.append(n);
    }
    const grid = document.createElement("div"); grid.className = "folders";
    all.forEach((f) => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.fid = f.id;
      const locked = !f.session && f.state !== "granted";
      b.innerHTML = `<span class="hex">${svg(locked ? "lock" : "folder")}</span><span class="fn"></span><small>${f.session ? "cette visite" : locked ? "clic : réautoriser" : "mémorisé"}</small>`;
      b.querySelector(".fn").textContent = f.name;
      b.addEventListener("click", async () => { if (locked) { await unlock(f); return; } browsing = { f, stack: [rootFor(f)] }; renderDirs(); });
      grid.append(b);
    });
    const add = document.createElement("button"); add.type = "button"; add.className = "addf";
    add.innerHTML = `<span class="hex">${svg("plus")}</span><span class="fn">Ajouter</span><small>un dossier</small>`;
    add.addEventListener("click", addFolder); grid.append(add);
    box.append(grid);
    if (!persistentSupported) {
      const n = document.createElement("p"); n.className = "dnote";
      n.innerHTML = "Pour que Brave <b>se souvienne</b> de tes dossiers : ouvre <code>brave://flags/#file-system-access-api</code>, mets « Enabled », relance Brave. Sinon, choisis un dossier à chaque visite.";
      const c = document.createElement("button"); c.type = "button"; c.className = "lnk"; c.textContent = "Copier l'adresse du réglage";
      c.addEventListener("click", () => { try { navigator.clipboard.writeText("brave://flags/#file-system-access-api").then(() => toast("Adresse copiée : colle-la dans la barre d'adresse de Brave"), () => toast("Copie refusée")); } catch (e) { toast("Copie refusée"); } });
      n.append(" ", c); box.append(n);
    }
    P.dirs.pf.firstElementChild.textContent = persistentSupported ? "✓ Dossiers autorisés dans Brave · lecture seule" : "Dossiers de cette visite · lecture seule";
    P.dirs.pf.lastElementChild.textContent = String(all.length);
  }

  async function renderBrowse() {
    const box = P.dirs.pb, { f, stack } = browsing, cur = stack[stack.length - 1];
    const head = document.createElement("div"); head.className = "crumbs";
    const back = document.createElement("button"); back.type = "button"; back.className = "btn"; back.innerHTML = svg("up", 14); back.title = "Remonter"; back.setAttribute("aria-label", "Remonter");
    back.addEventListener("click", () => { if (stack.length > 1) stack.pop(); else browsing = null; renderDirs(); });
    const path = document.createElement("span"); path.textContent = [f.name].concat(stack.slice(1).map((d) => d.name)).join(" › ");
    head.append(back, path); box.append(head);
    const ul = document.createElement("ul"); ul.className = "rec ls"; ul.textContent = "Lecture…"; box.append(ul);
    let kids = [];
    try { kids = await cur.children(); } catch (e) { ul.textContent = "Ce dossier n'est plus lisible."; return; }
    if (browsing === null || browsing.stack[browsing.stack.length - 1] !== cur) return;     // on a changé de dossier entre-temps
    kids = kids.filter((k) => !k.name.startsWith(".") && !/^(desktop\.ini|thumbs\.db)$/i.test(k.name)).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "fr", { numeric: true }) : a.kind === "dir" ? -1 : 1));
    ul.textContent = "";
    if (!kids.length) ul.textContent = "Dossier vide.";
    for (const k of kids.slice(0, 300)) {
      const li = document.createElement("li"); li.tabIndex = 0;
      const e = extOf(k.name);
      li.innerHTML = `<span class="ext" style="--c:${k.kind === "dir" ? "var(--cyan)" : EXT[e] || "var(--dim)"}">${k.kind === "dir" ? "DOS" : (e || "—").toUpperCase().slice(0, 4)}</span><span class="nm"></span><em></em>`;
      li.querySelector(".nm").textContent = k.name;
      if (k.kind === "file") k.info().then((m) => { li.querySelector("em").textContent = when(m.modified) + " · " + size(m.size); });
      const go = () => { if (k.kind === "dir") { stack.push(k); renderDirs(); } else openFile(k); };
      li.addEventListener("click", go); li.addEventListener("keydown", (ev) => { if (ev.key === "Enter") go(); });
      ul.append(li);
    }
    if (kids.length > 300) ul.insertAdjacentHTML("beforeend", `<li class="more">… et ${kids.length - 300} autres</li>`);
  }

  // ---------- Fichiers récents (tous les dossiers lisibles) ----------
  let recBusy = 0;
  async function refreshRecent() {
    const my = ++recBusy, roots = folders.filter((f) => f.state === "granted").map(rootOf).concat(session.map((s) => s.root));
    let all = [];
    for (const r of roots) { try { all = all.concat(await recentFiles(r, 8)); } catch (e) { /* dossier devenu illisible */ } }
    if (my !== recBusy) return;
    recent = all.sort((a, b) => b.modified - a.modified).slice(0, 8);
    renderRecent();
  }
  function recItem(r) {
    const li = document.createElement("li"); li.tabIndex = 0; const e = extOf(r.name);
    li.innerHTML = `<span class="ext" style="--c:${EXT[e] || "var(--dim)"}">${(e || "—").toUpperCase().slice(0, 4)}</span><span class="nm"></span><em>${when(r.modified)}</em>`;
    li.querySelector(".nm").textContent = r.name; li.title = r.path.join(" › ") + " › " + r.name;
    li.addEventListener("click", () => openFile(r)); li.addEventListener("keydown", (ev) => { if (ev.key === "Enter") openFile(r); });
    return li;
  }
  function renderRecent() {
    const ul = document.createElement("ul"); ul.className = "rec";
    if (!recent.length) ul.innerHTML = `<li class="none">${folders.length + session.length ? "Aucun fichier récent dans ces dossiers." : "Ajoute un dossier (plan 3) pour voir tes fichiers récents."}</li>`;
    recent.forEach((r) => ul.append(recItem(r)));
    P.rec.pb.innerHTML = ""; P.rec.pb.append(ul);
    P.rec.pf.firstElementChild.textContent = "✓ Dans les dossiers autorisés"; P.rec.pf.lastElementChild.textContent = recent.length ? recent.length + " derniers" : "—";
    const small = pb.querySelector(".rec"); small.innerHTML = "";
    if (!recent.length) small.innerHTML = '<li class="none">Touche 3 : ajoute un dossier sur le bureau du PC.</li>';
    recent.slice(0, 3).forEach((r) => small.append(recItem(r)));
  }

  // ---------- Menus ----------
  registerMenu("pc", (el, t) => [{ h: "Mon PC" },
    { t: "Ouvrir le bureau du PC", k: "3", fn: () => plans.goPlan(3) },
    { t: "Ajouter un dossier", fn: addFolder },
    { t: "Actualiser", fn: () => { showNet(); reload(true); toast("Mon PC actualisé"); } }]);
  registerMenu("desk", (el, t) => {
    const fb = t.closest(".folders button[data-fid]"), it = [];
    if (fb) {
      const f = folders.concat(session).find((x) => x.id === fb.dataset.fid);
      if (f) it.push({ h: "Dossier · " + f.name }, { t: "Ouvrir", fn: () => fb.click() },
        { t: f.session ? "Fermer (cette visite)" : "Ne plus autoriser ce dossier", fn: async () => {
          if (f.session) session = session.filter((s) => s !== f); else { await forgetFolder(f.id); folders = folders.filter((x) => x.id !== f.id); }
          browsing = null; renderDirs(); refreshRecent(); toast("« " + f.name + " » retiré du hub (rien n'est supprimé sur le PC)");
        } }, "-");
    }
    it.push({ h: "Plan 3 · bureau du PC" }, { t: "Ajouter un dossier", fn: addFolder }, { t: "Actualiser les fichiers récents", fn: refreshRecent },
      { t: "Revenir au hub", k: "1", fn: () => plans.goPlan(1) }, { t: "Aller au plan 2", k: "2", fn: () => plans.goPlan(2) }, { t: "Écran en direct · bientôt", off: true });
    return it;
  });
  desk.dataset.menu = "desk";

  renderDirs(); renderRecent(); reload();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshRecent(); });
}
