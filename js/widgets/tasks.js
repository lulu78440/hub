// Widget Tâches (2.3) : liste avec priorité et échéance, stockée sur l'appareil.
// Une tâche : { id, text, done, prio (0 normale, 1 haute), due ("AAAA-MM-JJ" ou null), remindAt ("AAAA-MM-JJTHH:MM" ou null), created, doneAt }.
// Saisie rapide : « ! » = priorité haute, « @demain », « @lun », « @25/10 » = échéance, « 18h » = rappel à cette heure.
import { store, newId } from "../store/storage.js";
import { dayKey, dayLabel, daysFrom, parseDue, parseTime, addDays } from "./when.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { pulse } from "../state.js";
import { setLabel } from "../ui/labels.js";

const C = "tasks";

export function initTasks() {
  const win = document.querySelector('.win[data-id="tasks"]'); if (!win) return;
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag");
  let pf = win.querySelector(".pf");
  if (!pf) { pf = document.createElement("div"); pf.className = "pf"; win.querySelector(".in").append(pf); }
  pb.className = "pb pb-tasks";
  pb.innerHTML = '<form class="addrow" autocomplete="off"><input class="inl" type="text" maxlength="300" placeholder="Nouvelle tâche…  ! urgent · @demain · 18h = rappel" aria-label="Nouvelle tâche"></form><ul class="tasks"></ul><div class="meter" role="img"></div>';
  pf.innerHTML = '<span class="sum">—</span><button type="button" class="lnk" hidden>Effacer les faites</button>';
  const form = pb.querySelector("form"), input = form.querySelector("input"), ul = pb.querySelector(".tasks"), meter = pb.querySelector(".meter"), clearBtn = pf.querySelector(".lnk");
  let tasks = [], editing = null;

  function sorted() {
    const todo = tasks.filter((t) => !t.done).sort((a, b) => (b.prio - a.prio) || ((a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : 0) || (a.created - b.created));
    const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    return todo.concat(done);
  }
  async function load() { tasks = await store.all(C); if (!editing) render(); }

  function render() {
    ul.innerHTML = "";
    const s = sorted();
    if (!s.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "Rien à faire. Ajoute une tâche ci-dessus."; ul.append(li); }
    s.forEach((t) => {
      const li = document.createElement("li"); li.dataset.id = t.id;
      li.className = (t.done ? "done" : "") + (t.prio ? " hi" : "");
      const chk = document.createElement("button"); chk.type = "button"; chk.className = "chk";
      chk.setAttribute("aria-label", t.done ? "Remettre « " + t.text + " » à faire" : "Marquer « " + t.text + " » comme faite");
      chk.append(document.createElement("i"));
      chk.addEventListener("click", () => toggleDone(t.id));
      const sp = document.createElement("span"); sp.className = "tt"; sp.textContent = t.text; sp.tabIndex = 0;
      sp.addEventListener("click", () => edit(t.id));
      sp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); edit(t.id); } });
      const em = document.createElement("em");
      if (t.done) em.textContent = "fait";
      else if (t.due) { const n = daysFrom(t.due); em.textContent = (n < 0 ? "en retard · " + dayLabel(t.due) : dayLabel(t.due)) + (t.remindAt ? " · " + t.remindAt.slice(11) : ""); if (n < 0) em.className = "late"; else if (n === 0) em.className = "today"; if (t.remindAt) em.classList.add("bell"); }
      else em.textContent = "—";
      li.append(chk, sp, em); ul.append(li);
    });
    const todo = tasks.filter((t) => !t.done).length, done = tasks.length - todo, late = tasks.filter((t) => !t.done && t.due && daysFrom(t.due) < 0).length;
    tag.textContent = todo ? todo + " À FAIRE" : (tasks.length ? "TOUT EST FAIT" : "TÂCHES");
    setLabel("tasks", todo ? todo + " à faire" : "");
    pf.querySelector(".sum").textContent = tasks.length ? `${done} faite${done > 1 ? "s" : ""} sur ${tasks.length}` + (late ? ` · ${late} en retard` : "") : "Stockées sur l'appareil";
    clearBtn.hidden = !done;
    const segs = Math.min(tasks.length, 12), filled = tasks.length ? Math.round(done / tasks.length * segs) : 0;
    meter.innerHTML = Array.from({ length: segs }, (_, i) => `<u class="${i < filled ? "f" : ""}"></u>`).join("");
    meter.setAttribute("aria-label", `${done} tâche(s) faite(s) sur ${tasks.length}`);
  }

  async function save(t) { render(); await store.put(C, t); }
  async function add(raw) {
    let text = raw, prio = 0;
    if (/(^|\s)!(\s|$)/.test(text) || text.startsWith("!")) { prio = 1; text = text.replace(/(^|\s)!(?=\s|$)/g, " ").replace(/^!/, "").trim(); }
    const p = parseDue(text), h = parseTime(p.text);
    if (!h.text) return;
    const due = p.due || (h.start ? dayKey() : null);
    const t = { id: newId("t"), text: h.text, done: false, prio, due, remindAt: h.start ? due + "T" + h.start : null, created: Date.now(), doneAt: null };
    tasks.push(t); pulse(0.6); await save(t);
    if (due || prio) toast("Tâche ajoutée" + (prio ? " · urgente" : "") + (due ? " · pour " + ({ "auj.": "aujourd'hui", "dem.": "demain" }[dayLabel(due)] || dayLabel(due)) : "") + (h.start ? " · rappel à " + h.start : ""));
  }
  async function toggleDone(id) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    t.done = !t.done; t.doneAt = t.done ? Date.now() : null; if (t.done) pulse(1);
    await save(t);
  }
  const setPrio = (id, v) => { const t = tasks.find((x) => x.id === id); if (t) { t.prio = v; save(t); } };
  const setDue = (id, v) => { const t = tasks.find((x) => x.id === id); if (t) { t.due = v; t.remindAt = v && t.remindAt ? v + "T" + t.remindAt.slice(11) : null; save(t); } };
  async function remove(id) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    tasks = tasks.filter((x) => x.id !== id); render(); await store.del(C, id);
    toast("Tâche supprimée", { action: { label: "Annuler", fn: () => { tasks.push(t); save(t); } } });
  }
  async function clearDone() {
    const gone = tasks.filter((t) => t.done); if (!gone.length) return;
    tasks = tasks.filter((t) => !t.done); render(); await store.delMany(C, gone.map((t) => t.id));
    toast(gone.length + " tâche(s) faite(s) effacée(s)", { action: { label: "Annuler", fn: async () => { for (const t of gone) { tasks.push(t); await store.put(C, t); } render(); } } });
  }

  // Modifier une tâche sur place : texte, échéance, priorité
  function edit(id) {
    if (editing) return;
    const t = tasks.find((x) => x.id === id), li = ul.querySelector(`li[data-id="${id}"]`); if (!t || !li) return;
    editing = id; li.className = "editing"; li.innerHTML = "";
    const tx = document.createElement("input"); tx.type = "text"; tx.className = "inl"; tx.value = t.text; tx.maxLength = 300; tx.setAttribute("aria-label", "Texte de la tâche");
    const row = document.createElement("div"); row.className = "erow";
    const date = document.createElement("input"); date.type = "date"; date.className = "inl date"; date.value = t.due || ""; date.setAttribute("aria-label", "Échéance");
    const time = document.createElement("input"); time.type = "time"; time.className = "inl time"; time.value = t.remindAt ? t.remindAt.slice(11) : ""; time.setAttribute("aria-label", "Heure du rappel (facultative)"); time.title = "Rappel à cette heure";
    let prio = t.prio, over = false;
    const mk = (label, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label; b.addEventListener("pointerdown", (e) => e.preventDefault()); b.addEventListener("click", fn); return b; };
    const pr = mk("Urgent", () => { prio = prio ? 0 : 1; pr.setAttribute("aria-pressed", String(!!prio)); }, "prio"); pr.setAttribute("aria-pressed", String(!!prio));
    const finish = async (ok) => {
      if (over) return; over = true; editing = null;
      const v = tx.value.trim();
      if (ok && !v) { await remove(id); return; }
      if (ok) {
        t.text = v; t.prio = prio; t.due = date.value || (time.value ? dayKey() : null);
        t.remindAt = time.value ? t.due + "T" + time.value : null;
        await save(t);
      } else render();
    };
    row.append(date, time, pr, mk("Supprimer", () => { over = true; editing = null; remove(id); }, "danger"), mk("OK", () => finish(true), "ok"));
    li.append(tx, row);
    tx.focus(); tx.setSelectionRange(tx.value.length, tx.value.length);
    li.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
      if (e.key === "Enter" && e.target !== date && e.target !== time) { e.preventDefault(); finish(true); }
    });
    li.addEventListener("focusout", (e) => { if (!li.contains(e.relatedTarget)) setTimeout(() => { if (!li.contains(document.activeElement)) finish(true); }, 0); });
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) return; input.value = ""; add(v); });
  input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") input.blur(); });
  clearBtn.addEventListener("click", clearDone);

  registerMenu("tasks", (el, target) => {
    const li = target.closest(".tasks li[data-id]"), it = [];
    if (li && !li.classList.contains("editing")) {
      const t = tasks.find((x) => x.id === li.dataset.id);
      if (t) it.push({ h: "Tâche · " + (t.text.length > 28 ? t.text.slice(0, 27) + "…" : t.text) },
        { t: t.done ? "Remettre à faire" : "Marquer comme faite", fn: () => toggleDone(t.id) },
        { t: t.prio ? "Priorité normale" : "Priorité haute", fn: () => setPrio(t.id, t.prio ? 0 : 1) },
        { t: "Pour aujourd'hui", fn: () => setDue(t.id, dayKey()), off: t.due === dayKey() },
        { t: "Pour demain", fn: () => setDue(t.id, dayKey(addDays(new Date(), 1))) },
        { t: "Sans échéance", fn: () => setDue(t.id, null), off: !t.due },
        { t: "Modifier", fn: () => edit(t.id) },
        { t: "Supprimer la tâche", fn: () => remove(t.id) }, "-");
    }
    it.push({ h: "Tâches" }, { t: "Nouvelle tâche", fn: () => input.focus() },
      { t: "Effacer les tâches faites", fn: clearDone, off: !tasks.some((t) => t.done) });
    return it;
  });

  // À minuit, les étiquettes (auj., dem., en retard) changent : on vérifie chaque minute et on redessine au changement de jour.
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); if (!editing) render(); } }, 60e3);

  store.on(C, load);
  load();
}
