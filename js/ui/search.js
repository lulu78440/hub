// Recherche : Brave par défaut, !g Google, !d DuckDuckGo, !y YouTube. Ouvre dans un nouvel onglet.
import { pulse } from "../state.js";

const ENGINES = {
  "": { name: "Brave", url: "https://search.brave.com/search?q=", color: "var(--cyan)" },
  g: { name: "Google", url: "https://www.google.com/search?q=", color: "var(--violet)" },
  d: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", color: "var(--amber)" },
  y: { name: "YouTube", url: "https://www.youtube.com/results?search_query=", color: "#ff5d6c" }
};

/** « !y chat » → YouTube / « chat ». Le raccourci doit être suivi d'un espace (ou rien) : « !yoga » reste une recherche Brave. */
export function parseQuery(v) {
  const m = v.trim().match(/^!([a-z])(?:\s+(.*))?$/i);
  if (m && ENGINES[m[1].toLowerCase()]) return { e: ENGINES[m[1].toLowerCase()], q: (m[2] || "").trim() };
  return { e: ENGINES[""], q: v.trim() };
}

export function initSearch({ focusOnStart = false } = {}) {
  const form = document.getElementById("search"), input = document.getElementById("q");
  const engine = document.getElementById("engine"), go = document.getElementById("go");

  input.addEventListener("input", () => {
    const { e } = parseQuery(input.value);
    engine.textContent = e.name; engine.style.background = e.color; pulse(0.5); go.textContent = "";
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const { e, q } = parseQuery(input.value);
    if (!q) return;
    const a = document.createElement("a");
    a.href = e.url + encodeURIComponent(q); a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = "Ouvrir « " + q + " » sur " + e.name + " ↗";
    go.textContent = ""; go.append(a); pulse(1);
    a.click();   // nouvel onglet ; le lien reste affiché si le navigateur bloque l'ouverture
  });
  // Échap quitte la barre : les touches 1 2 3 (plans) fonctionnent alors
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") input.blur(); });
  // « / » ramène dans la barre de recherche
  addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); input.focus(); input.select(); }
  });
  if (focusOnStart) input.focus({ preventScroll: true });
}
