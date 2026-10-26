// Widget Favoris (2.7) : import du fichier exporté par Brave ou Chrome, groupes, ajout et retrait, icônes hexagonales.
// Un favori : { id, title, url, group, created }. Import : les doublons (même adresse) sont ignorés, rien n'est effacé.
import { store, newId } from "../store/storage.js";
import { parseBookmarks, groupOf } from "../store/bookmarks.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { state, pulse } from "../state.js";
const webUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");   // seuls les liens web (jamais javascript: ni data:)

const C = "favs", ALL = "Tous", MAX_SHOWN = 240;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
const norm = (u) => u.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
const initials = (f) => { const w = (f.title || host(f.url)).replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/); return ((w[0] || "?").charAt(0).toUpperCase() + (w[1] ? w[1].charAt(0) : (w[0] || "").charAt(1) || "")).slice(0, 2); };
const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ["var(--cyan)", "var(--violet)", "var(--amber)", "var(--ok)", "#5fb8ff", "#ff7a9c"][h % 6]; };

export function initFavs() {
  const win = document.querySelector('.win[data-id="favs"]'); if (!win) return;
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag");
  let pf = win.querySelector(".pf");
  if (!pf) { pf = document.createElement("div"); pf.className = "pf"; win.querySelector(".in").append(pf); }
  pb.className = "pb pb-favs";
  pb.innerHTML = '<div class="fbar"><input class="inl" type="search" placeholder="Chercher un favori…" aria-label="Chercher dans les favoris"><button type="button" class="btn fadd" title="Ajouter un favori">+</button><button type="button" class="btn fmng" aria-pressed="false" title="Modifier, retirer">Gérer</button></div><div class="fgroups" role="tablist" aria-label="Groupes"></div><div class="fslot"></div><nav class="favs" aria-label="Favoris"></nav>';
  pf.innerHTML = '<span class="cnt">—</span><button type="button" class="lnk fimp">Importer depuis Brave / Chrome</button>';
  const q = pb.querySelector(".fbar input"), groupsEl = pb.querySelector(".fgroups"), grid = pb.querySelector(".favs"), slot = pb.querySelector(".fslot"), mng = pb.querySelector(".fmng");
  const file = document.createElement("input"); file.type = "file"; file.accept = ".html,.htm,text/html"; file.hidden = true; document.body.append(file);
  let favs = [], group = ALL, manage = false, formOpen = false;

  const groups = () => { const m = new Map(); favs.forEach((f) => m.set(f.group, (m.get(f.group) || 0) + 1)); return [...m.entries()].sort((a, b) => a[0] === "Barre de favoris" ? -1 : b[0] === "Barre de favoris" ? 1 : a[0].localeCompare(b[0], "fr")); };
  async function load() { favs = await store.all(C); if (!formOpen) render(); }

  function render() {
    const gs = groups();
    if (group !== ALL && !gs.some(([g]) => g === group)) group = ALL;
    groupsEl.innerHTML = "";
    if (gs.length > 1) [[ALL, favs.length], ...gs].forEach(([g, n]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "gchip"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(g === group));
      b.textContent = g + " · " + n; b.addEventListener("click", () => { group = g; render(); });
      groupsEl.append(b);
    });
    const term = q.value.trim().toLowerCase();
    const rank = new Map(gs.map(([g], i) => [g, i]));
    // Une recherche fouille tous les groupes ; sinon on montre le groupe choisi
    const list = favs.filter((f) => term ? (f.title.toLowerCase().includes(term) || f.url.toLowerCase().includes(term)) : (group === ALL || f.group === group))
      .sort((a, b) => (rank.get(a.group) - rank.get(b.group)) || a.created - b.created);
    grid.innerHTML = "";
    list.slice(0, MAX_SHOWN).forEach((f) => {
      const a = document.createElement("a"); if (webUrl(f.url)) a.href = webUrl(f.url); a.target = "_blank"; a.rel = "noopener"; a.dataset.id = f.id; a.title = f.title + "\n" + f.url;
      const hx = document.createElement("span"); hx.className = "hx"; hx.textContent = initials(f); hx.style.setProperty("--c", hue(host(f.url)));
      const t = document.createElement("span"); t.className = "ft"; t.textContent = f.title;
      a.append(hx, t);
      a.addEventListener("click", (e) => { if (manage) { e.preventDefault(); openForm(f); } else pulse(0.6); });
      grid.append(a);
    });
    if (!favs.length) {
      const p = document.createElement("div"); p.className = "fempty";
      p.innerHTML = "<b>Aucun favori pour l'instant.</b><span>Dans Brave : menu ☰ → Favoris → Gestionnaire de favoris → ⋮ → Exporter les favoris. Dans Chrome : même chemin. Puis :</span>";
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "Importer le fichier"; b.addEventListener("click", () => file.click());
      p.append(b); grid.append(p);
    } else if (!list.length) { const p = document.createElement("p"); p.className = "fnone"; p.textContent = "Aucun favori ne correspond."; grid.append(p); }
    else if (list.length > MAX_SHOWN) { const p = document.createElement("p"); p.className = "fnone"; p.textContent = `${list.length - MAX_SHOWN} autres : précise la recherche.`; grid.append(p); }
    win.classList.toggle("fmanage", manage);
    pf.querySelector(".cnt").textContent = favs.length ? favs.length + " favori" + (favs.length > 1 ? "s" : "") + (gs.length > 1 ? " · " + gs.length + " groupes" : "") : "Stockés sur l'appareil";
    tag.textContent = favs.length ? favs.length + " FAVORIS" : "FAVORIS";
  }

  // ---------- Ajouter / modifier ----------
  function openForm(f) {
    closeForm();
    formOpen = true;
    const fm = document.createElement("form"); fm.className = "fform"; fm.autocomplete = "off";
    const t = document.createElement("input"); t.className = "inl"; t.placeholder = "Nom (facultatif)"; t.value = f ? f.title : ""; t.maxLength = 120; t.setAttribute("aria-label", "Nom");
    const u = document.createElement("input"); u.className = "inl"; u.type = "text"; u.placeholder = "Adresse, ex. lemonde.fr"; u.value = f ? f.url : ""; u.required = true; u.setAttribute("aria-label", "Adresse");
    const g = document.createElement("input"); g.className = "inl"; g.placeholder = "Groupe"; g.value = f ? f.group : (group !== ALL ? group : "Favoris"); g.maxLength = 60; g.setAttribute("aria-label", "Groupe");
    const dl = document.createElement("datalist"); dl.id = "fav-groups"; groups().forEach(([n]) => { const o = document.createElement("option"); o.value = n; dl.append(o); }); g.setAttribute("list", dl.id);
    const row = document.createElement("div"); row.className = "erow";
    const mk = (l, cls, fn, type = "button") => { const b = document.createElement("button"); b.type = type; b.className = "btn " + cls; b.textContent = l; if (fn) b.addEventListener("click", fn); return b; };
    if (f) row.append(mk("Retirer", "danger", () => { closeForm(); remove(f.id); }));
    row.append(mk("Annuler", "", () => closeForm()), mk(f ? "Enregistrer" : "Ajouter", "ok", null, "submit"));
    fm.append(u, t, g, dl, row);
    fm.addEventListener("submit", async (e) => {
      e.preventDefault();
      let url = u.value.trim(); if (!url) { u.focus(); return; }
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try { new URL(url); } catch (err) { toast("Adresse invalide"); u.focus(); return; }
      const obj = Object.assign(f ? { ...f } : { id: newId("f"), created: Date.now() }, { url, title: t.value.trim() || host(url), group: g.value.trim() || "Favoris" });
      if (!f && favs.some((x) => norm(x.url) === norm(url))) { toast("Ce favori existe déjà"); return; }
      closeForm(); favs = favs.filter((x) => x.id !== obj.id).concat(obj); render(); await store.put(C, obj); pulse(0.6);
      toast(f ? "Favori modifié" : "Favori ajouté · " + obj.group);
    });
    fm.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); closeForm(); } });
    slot.append(fm); u.focus();
  }
  function closeForm() { slot.innerHTML = ""; if (formOpen) { formOpen = false; render(); } }

  async function remove(id) {
    const f = favs.find((x) => x.id === id); if (!f) return;
    favs = favs.filter((x) => x.id !== id); render(); await store.del(C, id);
    toast("Favori retiré", { action: { label: "Annuler", fn: async () => { favs.push(f); render(); await store.put(C, f); } } });
  }
  async function removeGroup(g) {
    const gone = favs.filter((f) => f.group === g); if (!gone.length) return;
    if (!confirm(`Retirer les ${gone.length} favori(s) du groupe « ${g} » ?`)) return;
    favs = favs.filter((f) => f.group !== g); render(); await store.delMany(C, gone.map((f) => f.id));
    toast(`Groupe « ${g} » retiré`, { action: { label: "Annuler", fn: async () => { favs = favs.concat(gone); render(); await store.putMany(C, gone); } } });
  }
  function copy(text) { try { navigator.clipboard.writeText(text).then(() => toast("Adresse copiée"), () => toast("Copie refusée par le navigateur")); } catch (e) { toast("Copie refusée par le navigateur"); } }

  // ---------- Import ----------
  file.addEventListener("change", async () => {
    const f = file.files && file.files[0]; file.value = ""; if (!f) return;
    let items;
    try { items = parseBookmarks(await f.text()); } catch (e) { toast(e.message, { ms: 5000 }); return; }
    const seen = new Set(favs.map((x) => norm(x.url))), now = Date.now();
    const fresh = [];
    items.forEach((it, i) => { const k = norm(it.url); if (seen.has(k)) return; seen.add(k); fresh.push({ id: newId("f"), title: it.title.slice(0, 120), url: it.url, group: groupOf(it.path), created: now + i }); });
    if (!fresh.length) { toast(items.length ? "Tous ces favoris sont déjà dans le hub" : "Aucun lien trouvé dans ce fichier", { ms: 4000 }); return; }
    favs = favs.concat(fresh);
    await store.putMany(C, fresh); group = ALL; render(); pulse(1);
    const ng = new Set(fresh.map((x) => x.group)).size;
    toast(`${fresh.length} favori(s) importé(s) dans ${ng} groupe(s)` + (items.length > fresh.length ? ` · ${items.length - fresh.length} déjà présent(s)` : ""), { ms: 5000 });
  });
  const importFile = () => file.click();

  q.addEventListener("input", render);
  q.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { q.value = ""; render(); q.blur(); } if (e.key === "Enter") { const a = grid.querySelector("a"); if (a) a.click(); } });
  pb.querySelector(".fadd").addEventListener("click", () => openForm(null));
  mng.addEventListener("click", () => { manage = !manage; mng.setAttribute("aria-pressed", String(manage)); render(); if (manage) toast("Mode gestion : touche un favori pour le modifier ou le retirer"); });
  pf.querySelector(".fimp").addEventListener("click", importFile);

  registerMenu("favs", (el, t) => {
    const a = t.closest(".favs a"), it = [];
    if (a) {
      const f = favs.find((x) => x.id === a.dataset.id);
      if (f) it.push({ h: "Favori · " + f.title.slice(0, 28) },
        { t: "Ouvrir dans un nouvel onglet", fn: () => a.click() },
        { t: "Ouvrir ici", fn: () => { if (webUrl(f.url)) location.href = webUrl(f.url); } },
        { t: "Copier l'adresse", fn: () => copy(f.url) },
        { t: "Modifier (nom, adresse, groupe)", fn: () => openForm(f) },
        { t: "Retirer", fn: () => remove(f.id) }, "-");
    }
    it.push({ h: "Favoris" }, { t: "Ajouter un favori", fn: () => openForm(null) },
      { t: "Importer depuis Brave / Chrome…", fn: importFile });
    if (group !== ALL) it.push({ t: "Retirer le groupe « " + group + " »", fn: () => removeGroup(group) });
    return it;
  });

  store.on(C, load);
  load();
  return { importFile };
}
