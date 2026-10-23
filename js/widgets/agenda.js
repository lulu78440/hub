// Widget Agenda (2.4) : calendrier propre au hub, stocké sur l'appareil.
// Un événement : { id, title, date "AAAA-MM-JJ", start "HH:MM" | null (journée entière), end "HH:MM" | null, created }.
// PC : bande du jour sous le bandeau (v8) ; un clic l'ouvre en grand (vues jour, semaine, mois). Mobile : la fenêtre Agenda.
// Les tâches qui ont une échéance apparaissent aussi dans le calendrier (losanges).
import { store, newId } from "../store/storage.js";
import { dayKey, fromKey, addDays, daysFrom, parseDue, parseTime, toMin, mondayOf } from "./when.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { state, pulse } from "../state.js";

const C = "events";
const DAY0 = 8 * 60, SPAN = 14 * 60;            // bande du jour : 08:00 → 22:00
const JOURS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const fmtLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const byTime = (a, b) => (a.start ? toMin(a.start) : -1) - (b.start ? toMin(b.start) : -1) || a.created - b.created;
const span = (e) => e.start ? e.start + (e.end ? "–" + e.end : "") : "journée";

export function initAgenda() {
  let events = [], tasks = [];
  const views = [];                                // calendriers affichés (tiroir PC, fenêtre mobile)
  const dayEvents = (k) => events.filter((e) => e.date === k).sort(byTime);
  const dayTasks = (k) => tasks.filter((t) => t.due === k && !t.done);

  async function load() { events = await store.all(C); tasks = await store.all("tasks"); renderAll(); }
  function renderAll() { views.forEach((v) => v.render()); band.render(); }

  async function save(e) { const i = events.findIndex((x) => x.id === e.id); if (i < 0) events.push(e); else events[i] = e; renderAll(); await store.put(C, e); pulse(0.6); }
  async function remove(id) {
    const e = events.find((x) => x.id === id); if (!e) return;
    events = events.filter((x) => x.id !== id); renderAll(); await store.del(C, id);
    toast("Événement supprimé", { action: { label: "Annuler", fn: () => save(e) } });
  }
  /** Saisie rapide : « Dentiste 14h30 @mar », sinon le jour affiché. */
  async function quickAdd(raw, fallbackDay) {
    const d = parseDue(raw), t = parseTime(d.text);
    if (!t.text) return;
    const e = { id: newId("e"), title: t.text, date: d.due || fallbackDay, start: t.start, end: t.end, created: Date.now() };
    await save(e);
    toast("Ajouté : " + fmtLong.format(fromKey(e.date)) + (e.start ? " à " + e.start : ""));
    return e;
  }

  // ---------- Un calendrier (vues jour / semaine / mois) ----------
  function makeCalendar(root, { view = "week", onClose = null } = {}) {
    let cur = dayKey(), form = null;
    root.classList.add("cal");
    root.innerHTML = "";
    const head = el("div", "cal-head");
    const nav = el("div", "cal-nav");
    const bPrev = el("button", "btn", "‹"), bToday = el("button", "btn", "Aujourd'hui"), bNext = el("button", "btn", "›");
    [bPrev, bToday, bNext].forEach((b) => { b.type = "button"; nav.append(b); });
    bPrev.setAttribute("aria-label", "Précédent"); bNext.setAttribute("aria-label", "Suivant");
    const title = el("div", "cal-title");
    const tabs = el("div", "seg cal-tabs"); tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Vue");
    const TABS = [["day", "Jour"], ["week", "Semaine"], ["month", "Mois"]].map(([v, l]) => { const b = el("button", "btn", l); b.type = "button"; b.dataset.v = v; b.addEventListener("click", () => setView(v)); tabs.append(b); return b; });
    head.append(nav, title, tabs);
    if (onClose) { const x = el("button", "btn cal-x", "Fermer · Échap"); x.type = "button"; x.addEventListener("click", onClose); head.append(x); }
    const add = el("form", "addrow"); add.autocomplete = "off";
    const inp = el("input", "inl"); inp.type = "text"; inp.maxLength = 200; inp.placeholder = "Nouvel événement…  ex. Dentiste 14h30 @mar"; inp.setAttribute("aria-label", "Nouvel événement");
    const plus = el("button", "btn", "+ Détails"); plus.type = "button"; plus.title = "Formulaire complet";
    add.append(inp, plus);
    const body = el("div", "cal-body");
    root.append(head, add, body);

    function setView(v) { view = v; closeForm(); render(); }
    function move(dir) {
      const d = fromKey(cur);
      if (view === "day") cur = dayKey(addDays(d, dir));
      else if (view === "week") cur = dayKey(addDays(d, 7 * dir));
      else { const m = new Date(d.getFullYear(), d.getMonth() + dir, 1); cur = dayKey(m); }
      closeForm(); render();
    }
    bPrev.addEventListener("click", () => move(-1)); bNext.addEventListener("click", () => move(1));
    bToday.addEventListener("click", () => { cur = dayKey(); closeForm(); render(); });
    add.addEventListener("submit", async (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; inp.value = ""; const ev = await quickAdd(v, cur); if (ev && ev.date !== cur && view === "day") { cur = ev.date; render(); } });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { if (onClose) onClose(); else inp.blur(); } });
    plus.addEventListener("click", () => openForm(null, cur));

    function chip(e, withTime = true) {
      const b = el("button", "ev"); b.type = "button"; b.dataset.id = e.id;
      if (withTime && e.start) b.append(el("em", "", e.start));
      b.append(el("span", "", e.title));
      b.title = span(e) + " · " + e.title;
      b.addEventListener("click", (ev) => { ev.stopPropagation(); openForm(e); });
      return b;
    }
    function taskChip(t) { const s = el("span", "tk" + (t.prio ? " hi" : ""), t.text); s.title = "Tâche à faire : " + t.text; return s; }

    function render() {
      if (form) return;            // on ne redessine pas sous le formulaire ouvert
      TABS.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
      root.dataset.view = view;
      body.innerHTML = "";
      const d = fromKey(cur);
      if (view === "day") {
        title.textContent = cap(fmtLong.format(d)) + (cur === dayKey() ? " · aujourd'hui" : "");
        const evs = dayEvents(cur), tks = dayTasks(cur);
        const ul = el("ul", "cal-day");
        evs.forEach((e) => { const li = el("li"); li.append(el("time", "", span(e)), chip(e, false)); ul.append(li); });
        tks.forEach((t) => { const li = el("li", "task"); li.append(el("time", "", "tâche"), taskChip(t)); ul.append(li); });
        if (!evs.length && !tks.length) ul.append(el("li", "empty", "Rien de prévu ce jour-là."));
        body.append(ul);
      } else if (view === "week") {
        const mon = mondayOf(cur), sun = addDays(fromKey(mon), 6);
        title.textContent = "Semaine du " + fmtShort.format(fromKey(mon)) + " au " + fmtShort.format(sun);
        const grid = el("div", "cal-week");
        for (let i = 0; i < 7; i++) {
          const k = dayKey(addDays(fromKey(mon), i)), col = el("div", "col" + (k === dayKey() ? " today" : "") + (daysFrom(k) < 0 ? " past" : ""));
          const h = el("button", "dh"); h.type = "button"; h.append(el("b", "", JOURS[i]), el("span", "", String(fromKey(k).getDate())));
          h.title = "Voir le " + fmtLong.format(fromKey(k)); h.addEventListener("click", () => { cur = k; setView("day"); });
          col.append(h);
          dayEvents(k).forEach((e) => col.append(chip(e)));
          dayTasks(k).forEach((t) => col.append(taskChip(t)));
          col.addEventListener("dblclick", (e) => { if (e.target === col) openForm(null, k); });
          grid.append(col);
        }
        body.append(grid);
      } else {
        title.textContent = cap(fmtMonth.format(d));
        const first = new Date(d.getFullYear(), d.getMonth(), 1), start = fromKey(mondayOf(dayKey(first)));
        const grid = el("div", "cal-month");
        JOURS.forEach((j) => grid.append(el("div", "wd", j)));
        for (let i = 0; i < 42; i++) {
          const day = addDays(start, i), k = dayKey(day);
          if (i >= 35 && day.getMonth() !== d.getMonth()) break;   // 5 semaines suffisent souvent
          const cell = el("button", "cell" + (day.getMonth() !== d.getMonth() ? " out" : "") + (k === dayKey() ? " today" : "")); cell.type = "button";
          cell.append(el("b", "", String(day.getDate())));
          const evs = dayEvents(k), tks = dayTasks(k), n = evs.length + tks.length;
          evs.slice(0, 2).forEach((e) => cell.append(el("span", "mev", (e.start ? e.start + " " : "") + e.title)));
          if (evs.length < 2) tks.slice(0, 2 - evs.length).forEach((t) => cell.append(el("span", "mev tk", t.text)));
          if (n > 2) cell.append(el("span", "more", "+" + (n - 2)));
          cell.setAttribute("aria-label", fmtLong.format(day) + (n ? ", " + n + " élément(s)" : ""));
          cell.addEventListener("click", () => { cur = k; setView("day"); });
          grid.append(cell);
        }
        body.append(grid);
      }
    }

    // Formulaire complet : titre, date, heures, journée entière
    function openForm(e, k) {
      closeForm(true);
      const isNew = !e;
      const f = el("form", "evform"); f.autocomplete = "off";
      const t = el("input", "inl"); t.type = "text"; t.maxLength = 200; t.placeholder = "Titre de l'événement"; t.value = e ? e.title : ""; t.setAttribute("aria-label", "Titre");
      const row = el("div", "erow");
      const dt = el("input", "inl date"); dt.type = "date"; dt.value = e ? e.date : k; dt.setAttribute("aria-label", "Date"); dt.required = true;
      const all = el("label", "chkl"); const cb = el("input"); cb.type = "checkbox"; cb.checked = e ? !e.start : false; all.append(cb, document.createTextNode(" Journée entière"));
      const t1 = el("input", "inl time"); t1.type = "time"; t1.value = e && e.start ? e.start : "09:00"; t1.setAttribute("aria-label", "Début");
      const t2 = el("input", "inl time"); t2.type = "time"; t2.value = e && e.end ? e.end : ""; t2.setAttribute("aria-label", "Fin (facultative)");
      const sync = () => { t1.disabled = t2.disabled = cb.checked; };
      cb.addEventListener("change", sync); sync();
      row.append(dt, all, t1, el("span", "to", "→"), t2);
      const acts = el("div", "erow");
      const mk = (l, cls, fn, type = "button") => { const b = el("button", "btn " + cls, l); b.type = type; if (fn) b.addEventListener("click", fn); return b; };
      if (!isNew) acts.append(mk("Supprimer", "danger", () => { closeForm(); remove(e.id); }));
      acts.append(mk("Annuler", "", () => closeForm()), mk(isNew ? "Ajouter" : "Enregistrer", "ok", null, "submit"));
      f.append(el("div", "fh", isNew ? "Nouvel événement" : "Modifier l'événement"), t, row, acts);
      f.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const title = t.value.trim(); if (!title) { t.focus(); return; }
        if (!dt.value) { dt.focus(); return; }
        const start = cb.checked ? null : (t1.value || null);
        let end = cb.checked || !t2.value ? null : t2.value;
        if (start && end && toMin(end) <= toMin(start)) end = null;
        const obj = Object.assign(e ? { ...e } : { id: newId("e"), created: Date.now() }, { title, date: dt.value, start, end });
        form = null; f.remove(); body.hidden = false;
        if (view === "day") cur = obj.date;
        await save(obj);
      });
      f.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") { ev.preventDefault(); closeForm(); } });
      form = f; body.hidden = true; root.append(f); t.focus();
    }
    function closeForm(silent) { if (!form) return; form.remove(); form = null; body.hidden = false; if (!silent) render(); }

    const v = { render, setView, goto(k) { cur = k; render(); }, newEvent: () => openForm(null, cur), get formOpen() { return !!form; }, closeForm, focus: () => inp.focus(), root };
    views.push(v); render();
    return v;
  }

  // ---------- PC : bande du jour (v8) et tiroir ----------
  const bandEl = document.getElementById("agband"), drawer = document.getElementById("agdrawer");
  let cal = null;
  function openDrawer(view) {
    if (state.lite) return;
    if (!cal) cal = makeCalendar(drawer.querySelector(".agin"), { view: "week", onClose: closeDrawer });
    drawer.hidden = false; document.body.classList.add("agopen");
    if (view) cal.setView(view); else cal.render();
    cal.focus(); pulse(0.8);
  }
  function closeDrawer() { if (drawer.hidden) return; if (cal) cal.closeForm(true); drawer.hidden = true; document.body.classList.remove("agopen"); }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });
  addEventListener("pointerdown", (e) => { if (!drawer.hidden && !drawer.contains(e.target) && !bandEl.contains(e.target) && !e.target.closest(".ctx")) closeDrawer(); }, true);
  const band = {
    render() {
      if (!bandEl || state.lite) return;
      const k = dayKey(), now = new Date(), m = now.getHours() * 60 + now.getMinutes();
      const track = bandEl.querySelector(".agtrack");
      track.querySelectorAll(".ev").forEach((x) => x.remove());
      const evs = dayEvents(k);
      evs.filter((e) => e.start).forEach((e) => {
        const s = toMin(e.start), en = e.end ? toMin(e.end) : s + 60;
        const l = Math.max(0, (s - DAY0) / SPAN), r = Math.min(1, (en - DAY0) / SPAN);
        if (r <= 0 || l >= 1) return;
        const d = el("div", "ev" + (en <= m ? " past" : "")); d.style.left = (l * 100).toFixed(2) + "%"; d.style.width = (Math.max(r - l, 0.012) * 100).toFixed(2) + "%";
        const sp = el("span"); sp.append(el("em", "", e.start), document.createTextNode(e.title)); d.append(sp); d.title = span(e) + " · " + e.title;
        track.insertBefore(d, track.querySelector(".now"));
      });
      track.querySelector(".now").style.left = (Math.min(Math.max((m - DAY0) / SPAN, 0), 1) * 100).toFixed(2) + "%";
      const next = evs.find((e) => e.start && toMin(e.start) > m), allDay = evs.filter((e) => !e.start);
      const nt = bandEl.querySelector(".agnext");
      nt.innerHTML = "";
      if (next) nt.append(el("span", "", "Prochain"), el("b", "", next.start + " · " + next.title));
      else if (allDay.length) nt.append(el("span", "", "Aujourd'hui"), el("b", "", allDay.map((e) => e.title).join(", ")));
      else if (evs.length) nt.append(el("span", "", "Journée terminée"));
      else nt.append(el("span", "", "Rien aujourd'hui · clic pour ouvrir"));
    }
  };
  if (bandEl) {
    bandEl.addEventListener("click", (e) => { if (e.button === 0) openDrawer(); });
    bandEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(); } });
    registerMenu("agenda", () => [{ h: "Agenda" },
      { t: "Ouvrir · vue semaine", fn: () => openDrawer("week") },
      { t: "Ouvrir · vue jour", fn: () => openDrawer("day") },
      { t: "Ouvrir · vue mois", fn: () => openDrawer("month") },
      { t: "Nouvel événement", fn: () => { openDrawer(); cal.newEvent(); } }]);
  }

  // ---------- Mobile : la fenêtre Agenda ----------
  const win = document.querySelector('.win[data-id="agenda"]');
  if (win && state.lite) {
    const pb = win.querySelector(".pb"); pb.className = "pb pb-agenda";
    makeCalendar(pb, { view: "day" });
    const tag = win.querySelector(".tag"), pf = win.querySelector(".pf");
    const upd = () => {
      const n = dayEvents(dayKey()).length;
      tag.textContent = n ? n + " AUJOURD'HUI" : "AGENDA";
      if (pf) pf.lastElementChild.textContent = events.length + " événement" + (events.length > 1 ? "s" : "");
    };
    views.push({ render: upd }); upd();
  }

  // Le repère « maintenant » avance ; à minuit tout change de jour
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); renderAll(); } else band.render(); }, 30e3);

  store.on(C, load); store.on("tasks", load);
  load();
  return { openDrawer, closeDrawer };
}
