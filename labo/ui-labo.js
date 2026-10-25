// Laboratoire · petits outils d'interface partagés. Texte inséré uniquement avec des nœuds texte.
export function h(tag, a = {}, ...k) { const e = document.createElement(tag); for (const [n, v] of Object.entries(a || {})) { if (v == null || v === false) continue; if (n === "class") e.className = v; else if (n.startsWith("on")) e.addEventListener(n.slice(2), v); else e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; }
export function courbe(valeurs, { min = 0, max = 100, largeur = 220, hauteur = 46, couleur = "#3fe6ff", titre = "" } = {}) {
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`); svg.setAttribute("width", largeur); svg.setAttribute("height", hauteur); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", titre || "Courbe");
  const base = document.createElementNS(ns, "line"); base.setAttribute("x1", 0); base.setAttribute("x2", largeur); base.setAttribute("y1", hauteur - 1); base.setAttribute("y2", hauteur - 1); base.setAttribute("stroke", "rgba(63,230,255,.2)"); svg.append(base);
  if (valeurs.length) {
    const pas = valeurs.length > 1 ? (largeur - 8) / (valeurs.length - 1) : 0, y = (v) => hauteur - 4 - ((v - min) / ((max - min) || 1)) * (hauteur - 10), pts = valeurs.map((v, i) => `${4 + i * pas},${y(v).toFixed(1)}`);
    const l = document.createElementNS(ns, "polyline"); l.setAttribute("points", pts.join(" ")); l.setAttribute("fill", "none"); l.setAttribute("stroke", couleur); l.setAttribute("stroke-width", "1.6"); svg.append(l);
    const [cx, cy] = pts[pts.length - 1].split(","), c = document.createElementNS(ns, "circle"); c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", "3"); c.setAttribute("fill", couleur); svg.append(c);
  }
  return svg;
}
export const barre = (frac, couleur = "var(--cyan)") => h("span", { class: "lab-barre", role: "presentation" }, h("i", { style: `width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%;background:${couleur}` }));
export function telecharger(nom, obj) { const u = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" })); const a = h("a", { href: u, download: nom }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
export async function copier(texte, zone) { try { await navigator.clipboard.writeText(texte); return true; } catch (e) { const z = h("textarea", { class: "lab-champ", rows: "6" }); z.value = texte; zone.append(z); z.select(); return false; } }
export const quand = (iso) => { try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
/** append() qui ignore null / false (sinon « null » s'affiche). */
export function garnir(el) { const a = el.append.bind(el); el.append = (...k) => a(...k.flat().filter((x) => x != null && x !== false)); return el; }
