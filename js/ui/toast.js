// Message bref en haut de l'écran. Option : un bouton d'action (ex. « Annuler ») et une durée plus longue.
let timer = 0;
export function toast(msg, opts = {}) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg;
  t.classList.toggle("act", !!opts.action);
  if (opts.action) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = opts.action.label;
    b.addEventListener("click", () => { t.classList.remove("show"); opts.action.fn(); }, { once: true });
    t.append(" ", b);
  }
  t.classList.add("show");
  clearTimeout(timer); timer = setTimeout(() => t.classList.remove("show"), opts.ms || (opts.action ? 5000 : 1900));
}
