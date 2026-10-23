// Widget Notes (2.3) : notes rapides, épinglables, modifiables, stockées sur l'appareil.
// Une note : { id, text, pinned, created, updated }. Les épinglées en haut, puis les plus récentes.
// Cliquer une note (ou Entrée) l'ouvre en écriture : Ctrl+Entrée ou « OK » pour valider, Échap pour annuler.
import { store, newId } from "../store/storage.js";
import { stampLabel } from "./when.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { pulse } from "../state.js";

const C = "notes";

export function initNotes() {
  const win = document.querySelector('.win[data-id="notes"]'); if (!win) return;
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag");
  let pf = win.querySelector(".pf");
  if (!pf) { pf = document.createElement("div"); pf.className = "pf"; win.querySelector(".in").append(pf); }
  pb.className = "pb pb-notes";
  pb.innerHTML = '<form class="addrow" autocomplete="off"><input class="inl" type="text" maxlength="2000" placeholder="Nouvelle note… (Entrée)" aria-label="Nouvelle note"></form><div class="notes" role="list"></div>';
  pf.innerHTML = '<span>Stockées sur l\'appareil</span><span class="cnt">—</span>';
  const form = pb.querySelector("form"), input = form.querySelector("input"), list = pb.querySelector(".notes");
  let notes = [], editing = null;

  const sorted = () => notes.slice().sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
  async function load() { notes = await store.all(C); if (!editing) render(); }

  function render() {
    list.innerHTML = "";
    const s = sorted();
    if (!s.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "Aucune note. Écris-en une ci-dessus."; list.append(p); }
    s.forEach((n) => {
      const d = document.createElement("div"); d.className = "note" + (n.pinned ? " pinned" : ""); d.tabIndex = 0; d.dataset.id = n.id; d.setAttribute("role", "listitem");
      const sm = document.createElement("small"); sm.textContent = (n.pinned ? "Épinglée · " : "") + stampLabel(n.updated);
      const tx = document.createElement("div"); tx.className = "nt"; tx.textContent = n.text;
      d.append(sm, tx);
      d.addEventListener("click", () => edit(n.id));
      d.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); edit(n.id); } });
      list.append(d);
    });
    const c = notes.length;
    pf.querySelector(".cnt").textContent = c + " note" + (c > 1 ? "s" : "");
    tag.textContent = c ? c + " NOTE" + (c > 1 ? "S" : "") : "NOTES";
  }

  async function add(text) {
    const now = Date.now(), n = { id: newId("n"), text, pinned: false, created: now, updated: now };
    notes.push(n); render(); await store.put(C, n); pulse(0.6);
  }
  async function update(id, patch) {
    const n = notes.find((x) => x.id === id); if (!n) return;
    if (patch.text !== undefined && patch.text !== n.text) n.updated = Date.now();   // épingler ne change pas la date
    Object.assign(n, patch);
    render(); await store.put(C, n);
  }
  async function remove(id) {
    const n = notes.find((x) => x.id === id); if (!n) return;
    notes = notes.filter((x) => x.id !== id); render(); await store.del(C, id);
    toast("Note supprimée", { action: { label: "Annuler", fn: async () => { notes.push(n); render(); await store.put(C, n); } } });
  }
  const togglePin = (id) => { const n = notes.find((x) => x.id === id); if (n) { update(id, { pinned: !n.pinned }); toast(n.pinned ? "Note épinglée en haut" : "Note détachée"); } };
  function copy(id) {
    const n = notes.find((x) => x.id === id); if (!n) return;
    try { navigator.clipboard.writeText(n.text).then(() => toast("Texte copié"), () => toast("Copie refusée par le navigateur")); } catch (e) { toast("Copie refusée par le navigateur"); }
  }

  // Écriture d'une note, sur place
  function edit(id) {
    if (editing) return;
    const n = notes.find((x) => x.id === id), el = list.querySelector(`.note[data-id="${id}"]`); if (!n || !el) return;
    editing = id;
    el.classList.add("editing"); el.innerHTML = "";
    const ta = document.createElement("textarea"); ta.value = n.text; ta.rows = Math.min(8, Math.max(3, n.text.split("\n").length + 1)); ta.setAttribute("aria-label", "Texte de la note");
    const row = document.createElement("div"); row.className = "erow";
    const mk = (label, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label; b.addEventListener("pointerdown", (e) => e.preventDefault()); b.addEventListener("click", fn); return b; };
    let over = false;
    const finish = async (ok) => {
      if (over) return; over = true; editing = null;
      const v = ta.value.trim();
      if (ok && !v) { await remove(id); return; }
      if (ok && v !== n.text) await update(id, { text: v }); else render();
    };
    row.append(
      mk(n.pinned ? "Détacher" : "Épingler", () => { n.pinned = !n.pinned; row.firstChild.textContent = n.pinned ? "Détacher" : "Épingler"; store.put(C, n); }),
      mk("Supprimer", () => { over = true; editing = null; remove(id); }, "danger"),
      mk("OK", () => finish(true), "ok"));
    el.append(ta, row);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finish(true); }
    });
    el.addEventListener("focusout", (e) => { if (!el.contains(e.relatedTarget)) finish(true); });
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; input.value = ""; add(v); });
  input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") input.blur(); });

  registerMenu("notes", (el, t) => {
    const nEl = t.closest(".note"), it = [];
    if (nEl && !nEl.classList.contains("editing")) {
      const id = nEl.dataset.id, n = notes.find((x) => x.id === id);
      if (n) it.push({ h: "Note" }, { t: "Modifier", fn: () => edit(id) }, { t: n.pinned ? "Détacher" : "Épingler en haut", fn: () => togglePin(id) },
        { t: "Copier le texte", fn: () => copy(id) }, { t: "Supprimer la note", fn: () => remove(id) }, "-");
    }
    it.push({ h: "Notes" }, { t: "Nouvelle note", fn: () => input.focus() });
    return it;
  });

  store.on(C, load);
  load();
}
