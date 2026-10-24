// Bandeau d'actualité défilant (3.2, v8, PC) et fenêtre Veille (sites surveillés, nouveaux articles, alerte de panne).
import { flux, ago, SOURCES_EDIT } from "./flux.js";
import { registerMenu } from "../ui/menus.js";
import { toast } from "../ui/toast.js";
import { prefs } from "../store/prefs.js";
import { sound } from "../device/sound.js";
import { notify } from "../device/notify.js";
import { state, pulse } from "../state.js";

const webUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");   // seuls les liens web (jamais javascript: ni data:)
const openUrl = (u) => { u = webUrl(u); if (!u) return; const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; document.body.append(a); a.click(); a.remove(); };

export function initNews() {
  // ---------- Bandeau (PC) ----------
  const tk = document.createElement("div"); tk.className = "ticker pc-only"; tk.dataset.menu = "actu";
  tk.innerHTML = '<div class="lbl">ACTU <small>—</small></div><div class="track" aria-label="Actualité"><div class="run"></div></div>';
  document.body.append(tk);
  const run = tk.querySelector(".run"), lblSmall = tk.querySelector(".lbl small");
  let paused = prefs.get("actu-pause", "0") === "1";
  function renderTicker(d) {
    const items = (d.actus || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 40);
    run.innerHTML = "";
    if (!items.length) { run.innerHTML = '<span class="it">En attente des premiers titres (tâche programmée GitHub)…</span>'; return; }
    const make = () => items.map((it) => {
      const a = document.createElement("a"); a.className = "it"; if (webUrl(it.lien)) a.href = webUrl(it.lien); a.target = "_blank"; a.rel = "noopener"; a.style.setProperty("--c", it.couleur || "var(--cyan)");
      a.title = it.source + (it.date ? " · " + ago(it.date) : "");
      const b = document.createElement("b"); b.textContent = it.cat; a.append(b, document.createTextNode(it.titre)); return a;
    });
    run.append(...make(), ...make());          // deux fois, pour boucler sans saut
    run.style.animationDuration = Math.max(60, items.length * 9) + "s";
    lblSmall.textContent = ago(d.genere);
  }
  const applyPause = () => { tk.classList.toggle("paused", paused); };
  applyPause();
  registerMenu("actu", () => [{ h: "Actualité" + (flux.data ? " · mise à jour " + ago(flux.data.genere) : "") },
    { t: paused ? "Relancer le défilement" : "Arrêter le défilement", fn: () => { paused = !paused; prefs.set("actu-pause", paused ? "1" : "0"); applyPause(); } },
    { t: "Actualiser", fn: async () => { await flux.refresh(true); toast("Actualité actualisée"); } },
    { t: "Modifier les sources (GitHub) ↗", fn: () => openUrl(SOURCES_EDIT) }]);

  // ---------- Fenêtre Veille ----------
  const win = document.querySelector('.win[data-id="watch"]');
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag"), pf = win.querySelector(".pf");
  pb.className = "pb pb-watch";
  pb.innerHTML = '<ul class="watch"></ul><div class="warts"></div>';
  tag.textContent = "VEILLE";
  const ul = pb.querySelector(".watch"), arts = pb.querySelector(".warts");
  function renderWatch(d) {
    const sites = d.sites || [];
    ul.innerHTML = "";
    if (!sites.length) ul.innerHTML = '<li class="none">Aucun site surveillé : « Modifier les sources » (clic droit).</li>';
    sites.forEach((s) => {
      const li = document.createElement("li"); li.className = s.ok ? "" : "down"; li.title = s.url + (s.code ? " · code " + s.code : "") + " · " + (s.ok ? "en ligne " : "en panne ") + ago(s.depuis);
      li.innerHTML = '<i></i><span></span><em></em>';
      li.children[1].textContent = s.nom; li.children[2].textContent = s.ok ? s.ms + " ms" : "EN PANNE";
      li.addEventListener("click", () => openUrl(s.url));
      ul.append(li);
    });
    const news = sites.flatMap((s) => (s.articles || []).map((a) => ({ ...a, site: s.nom }))).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
    arts.innerHTML = "";
    news.forEach((a) => { const l = document.createElement("a"); if (webUrl(a.lien)) l.href = webUrl(a.lien); l.target = "_blank"; l.rel = "noopener"; l.innerHTML = "<b></b><span></span>"; l.children[0].textContent = a.site; l.children[1].textContent = a.titre; arts.append(l); });
    const down = sites.filter((s) => !s.ok).length;
    tag.textContent = down ? down + " EN PANNE" : sites.length ? "TOUT EST EN LIGNE" : "VEILLE";
    win.classList.toggle("alarm", !!down);
    if (pf) { pf.firstElementChild.textContent = "Vérifié " + ago(d.genere) + " · toutes les 20 min"; pf.lastElementChild.textContent = down ? down + " alerte" + (down > 1 ? "s" : "") : "—"; }
    alertDown(sites);
  }
  // Alerte quand un site passe en panne (une seule fois par panne)
  function alertDown(sites) {
    let seen = {}; try { seen = JSON.parse(prefs.get("veille-pannes", "{}")) || {}; } catch (e) { seen = {}; }
    const next = {};
    sites.filter((s) => !s.ok).forEach((s) => {
      next[s.url] = s.depuis;
      if (seen[s.url] === s.depuis) return;
      const box = document.getElementById("alerts"), c = document.createElement("div");
      c.className = "alert down"; c.setAttribute("role", "alertdialog");
      c.innerHTML = '<span class="ring" aria-hidden="true"></span><div class="atx"><small>VEILLE · SITE EN PANNE</small><b></b><span class="sub"></span></div><div class="aacts"><button type="button" class="btn ok">OK</button><button type="button" class="btn">Ouvrir</button></div>';
      c.querySelector("b").textContent = s.nom; c.querySelector(".sub").textContent = s.url + " · " + (s.code ? "code " + s.code : "ne répond pas") + " · " + ago(s.depuis);
      const close = () => { c.remove(); if (!box.children.length) box.hidden = true; };
      c.querySelector(".ok").addEventListener("click", close);
      c.querySelector(".aacts .btn:not(.ok)").addEventListener("click", () => { openUrl(s.url); close(); });
      box.append(c); box.hidden = false; pulse(1.2);
      if (document.visibilityState === "visible") sound.play("rappel"); else notify.show("Hub · site en panne", s.nom + " ne répond plus", "veille-" + s.url);
    });
    prefs.set("veille-pannes", JSON.stringify(next));
  }
  registerMenu("watch", (el, t) => {
    const it = [{ h: "Veille" + (flux.data ? " · vérifiée " + ago(flux.data.genere) : "") },
      { t: "Actualiser", fn: async () => { await flux.refresh(true); toast("Veille actualisée"); } },
      { t: "Modifier les sites surveillés (GitHub) ↗", fn: () => openUrl(SOURCES_EDIT) }];
    return it;
  });

  flux.on((d) => { if (!state.lite) renderTicker(d); renderWatch(d); });
  if (!flux.data) { renderWatch({ sites: [], genere: null }); if (!state.lite) renderTicker({ actus: [] }); }
  flux.refresh(true);
}
