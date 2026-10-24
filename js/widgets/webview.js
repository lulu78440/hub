// Page en direct (3.4) : affiche une page web dans la fenêtre, actualisée à intervalle choisi.
// Limite honnête : beaucoup de sites interdisent d'être affichés dans une autre page (Google, YouTube, réseaux sociaux…) :
// la fenêtre reste alors vide, et le lien « Ouvrir » ouvre la page dans un onglet.
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";

const EVERY = [[0, "Jamais"], [1, "1 min"], [5, "5 min"], [15, "15 min"], [60, "1 h"]];

export function initWebview() {
  const w = document.querySelector('.win[data-id="web"]'); if (!w) return;
  const pb = w.querySelector(".pb"), tag = w.querySelector(".tag"), pf = w.querySelector(".pf");
  pb.className = "pb pb-web";
  pb.innerHTML = '<div class="web"><form class="url" autocomplete="off"><i></i><input type="text" aria-label="Adresse de la page" placeholder="Adresse d\'une page, ex. fr.wikipedia.org"><a class="wopen" target="_blank" rel="noopener" title="Ouvrir dans un onglet">↗</a></form><div class="vp"><p class="wempty">Entre une adresse ci-dessus. Certains sites refusent d\'être affichés ici : utilise alors ↗.</p></div></div>';
  const form = pb.querySelector(".url"), inp = form.querySelector("input"), vp = pb.querySelector(".vp"), open = form.querySelector(".wopen");
  let url = prefs.get("web-url", ""), every = +prefs.get("web-auto", "0"), timer = 0, loadedAt = 0;
  const norm = (s) => { s = s.trim(); if (!s) return ""; if (!/^https?:\/\//i.test(s)) s = "https://" + s; try { return new URL(s).href; } catch (e) { return ""; } };
  function load() {
    vp.innerHTML = "";
    if (!url) { vp.innerHTML = '<p class="wempty">Entre une adresse ci-dessus. Certains sites refusent d\'être affichés ici : utilise alors ↗.</p>'; open.removeAttribute("href"); tag.textContent = "PAGE EN DIRECT"; return; }
    const f = document.createElement("iframe"); f.src = url; f.title = "Page en direct"; f.loading = "lazy"; f.referrerPolicy = "no-referrer";
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox");
    vp.append(f); open.href = url; inp.value = url.replace(/^https:\/\//, "").replace(/\/$/, "");
    const hint = document.createElement("p"); hint.className = "whint"; hint.textContent = "Page vide ? Ce site refuse l'affichage ici : ↗ pour l'ouvrir."; vp.append(hint);
    loadedAt = Date.now(); tag.textContent = new URL(url).hostname.replace(/^www\./, "").toUpperCase(); stamp();
  }
  function stamp() { if (!pf) return; const m = Math.round((Date.now() - loadedAt) / 60e3); pf.firstElementChild.textContent = url ? "Aperçu actualisé " + (m < 1 ? "à l'instant" : "il y a " + m + " min") : "Aperçu"; pf.lastElementChild.textContent = every ? "auto " + EVERY.find((e) => e[0] === every)[1] : "—"; }
  function arm() { clearInterval(timer); if (every) timer = setInterval(() => { if (!document.hidden) load(); }, every * 60e3); stamp(); }
  form.addEventListener("submit", (e) => { e.preventDefault(); const u = norm(inp.value); if (!u) { toast("Adresse invalide"); return; } url = u; prefs.set("web-url", url); load(); });
  inp.addEventListener("keydown", (e) => e.stopPropagation());
  registerMenu("web", () => [{ h: "Page en direct" },
    { t: "Actualiser l'aperçu", fn: load, off: !url },
    { t: "Ouvrir la page ↗", fn: () => open.click(), off: !url },
    { t: "Changer d'adresse", fn: () => { inp.select(); inp.focus(); } },
    ...EVERY.map(([v, l]) => ({ t: "Actualisation auto : " + l + (v === every ? " ✓" : ""), fn: () => { every = v; prefs.set("web-auto", String(v)); arm(); } }))]);
  setInterval(stamp, 60e3);
  load(); arm();
}
