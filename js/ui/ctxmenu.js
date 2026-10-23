// Menu contextuel du hub (repris de la v8) : titres, notes, séparateurs et actions, navigation au clavier.
// PC : il s'ouvre sous la souris. Mobile : il monte du bas de l'écran (plus facile au pouce).
// Une entrée : "-" (séparateur), { h: "Titre" }, { note: "texte" }, { t: "Action", k: "raccourci", fn, off: true (grisée) }.
import { state } from "../state.js";

export function createMenu(box) {
  let openedAt = 0;
  const isOpen = () => !box.hidden;

  function close() { if (box.hidden) return; box.hidden = true; box.innerHTML = ""; }

  function open(x, y, items) {
    box.innerHTML = "";
    items.forEach((it) => {
      if (it === "-") { box.append(document.createElement("hr")); return; }
      if (it.h || it.note) { const d = document.createElement("div"); d.className = it.h ? "ch" : "note"; d.textContent = it.h || it.note; box.append(d); return; }
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem");
      const s = document.createElement("span"); s.textContent = it.t; b.append(s);
      if (it.k) { const k = document.createElement("kbd"); k.textContent = it.k; b.append(k); }
      if (it.off) b.disabled = true;
      b.addEventListener("click", () => {
        if (performance.now() - openedAt < 350) return;    // le doigt qui vient d'ouvrir le menu ne déclenche rien
        close(); it.fn && it.fn();
      });
      box.append(b);
    });
    box.hidden = false; openedAt = performance.now();
    box.classList.toggle("sheet", state.lite);
    if (!state.lite) {
      const r = box.getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
      box.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
      const first = box.querySelector("button:not(:disabled)"); if (first) first.focus({ preventScroll: true });
    } else { box.style.left = ""; box.style.top = ""; }
  }

  box.addEventListener("keydown", (e) => {
    const bs = [...box.querySelectorAll("button:not(:disabled)")], i = bs.indexOf(document.activeElement);
    if (!bs.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
    if (e.key === "Tab") { e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
  });
  addEventListener("pointerdown", (e) => { if (isOpen() && !box.contains(e.target)) close(); }, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  addEventListener("wheel", close, { passive: true });
  addEventListener("blur", close);
  addEventListener("resize", close);
  return { open, close, isOpen };
}
