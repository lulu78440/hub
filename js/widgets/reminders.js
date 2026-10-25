// Rappels (2.5) : surveille les événements (rappel X min avant) et les tâches (rappel à une heure),
// affiche une alerte dans le hub avec le son futuriste, et une notification Brave si le hub est en arrière-plan.
// Rattrapage : à l'ouverture, les rappels tombés pendant que le hub était fermé s'affichent (« manqué »).
// Limite : rien ne sonne si le hub est fermé (alerte téléphone fermé : phase 3 ou V2).
// État partagé (collection kv, document "rappels") : rappels vus et reportés, pour que tous les onglets soient d'accord.
import { store } from "../store/storage.js";
import { fromKey, toMin } from "./when.js";
import { sound } from "../device/sound.js";
import { notify } from "../device/notify.js";
import { buzz } from "../device/vibrate.js";
import { toast } from "../ui/toast.js";
import { state, pulse } from "../state.js";
import { inReserve } from "../ui/reserve.js";

const KV = "rappels", SNOOZE = 10 * 60e3, MAX_LATE = 24 * 3600e3, TICK = 15e3;
const pad = (n) => String(n).padStart(2, "0");
const hm = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

/** Liste de tous les rappels programmés, avec leur instant (ms). */
async function collect() {
  const out = [];
  for (const e of await store.all("events")) {
    if (!e.start || e.remind === null || e.remind === undefined) continue;
    const startMs = fromKey(e.date).getTime() + toMin(e.start) * 60e3;
    out.push({ key: e.id + "@" + startMs + "@" + e.remind, at: startMs - e.remind * 60e3, kind: "event", title: e.title, when: startMs, before: e.remind });
  }
  for (const t of (inReserve("tasks") ? [] : await store.all("tasks"))) {
    if (!t.remindAt || t.done) continue;
    const [k, h] = t.remindAt.split("T"), at = fromKey(k).getTime() + toMin(h) * 60e3;
    out.push({ key: t.id + "@" + at, at, kind: "task", title: t.text, when: at, before: 0, prio: t.prio });
  }
  return out;
}

export function initReminders() {
  const box = document.getElementById("alerts");
  const startedAt = Date.now();
  let kv = { id: KV, seen: {}, snooze: {} }, leader = !navigator.locks;
  const shown = new Map();         // clé → carte affichée

  // Un seul onglet du hub s'occupe des notifications (évite les doublons)
  if (navigator.locks) navigator.locks.request("hub-rappels", () => { leader = true; return new Promise(() => {}); }).catch(() => { leader = true; });

  async function loadKv() { const d = await store.get("kv", KV); kv = d && d.seen ? d : { id: KV, seen: {}, snooze: {} }; }
  async function saveKv() {
    const now = Date.now();                         // ménage : on oublie ce qui a plus de 3 jours
    Object.keys(kv.seen).forEach((k) => { if (now - kv.seen[k] > 3 * 864e5) delete kv.seen[k]; });
    Object.keys(kv.snooze).forEach((k) => { if (now - kv.snooze[k] > 3 * 864e5) delete kv.snooze[k]; });
    await store.put("kv", kv);
  }

  function describe(r) {
    if (r.kind === "task") return { head: "TÂCHE · " + hm(r.when), text: r.title };
    const mins = Math.round((r.when - Date.now()) / 60e3);
    const rel = mins > 1 ? "dans " + (mins >= 120 ? Math.round(mins / 60) + " h" : mins + " min") : mins >= -1 ? "maintenant" : "a commencé à " + hm(r.when);
    return { head: "RAPPEL · " + hm(r.when), text: r.title, sub: rel };
  }

  function card(r, missed) {
    const d = describe(r), c = document.createElement("div");
    c.className = "alert" + (r.kind === "task" ? " task" : "") + (missed ? " missed" : ""); c.setAttribute("role", "alertdialog");
    const ring = document.createElement("span"); ring.className = "ring"; ring.setAttribute("aria-hidden", "true");
    const tx = document.createElement("div"); tx.className = "atx";
    const h = document.createElement("small"); h.textContent = d.head + (missed ? " · MANQUÉ" : "");
    const b = document.createElement("b"); b.textContent = d.text;
    tx.append(h, b);
    if (d.sub) { const s = document.createElement("span"); s.className = "sub"; s.textContent = d.sub; tx.append(s); }
    const acts = document.createElement("div"); acts.className = "aacts";
    const mk = (l, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = "btn " + cls; x.textContent = l; x.addEventListener("click", fn); return x; };
    acts.append(mk("OK", "ok", () => ack(r.key)), mk("+10 min", "", () => snooze(r.key)));
    if (notify.state === "default") acts.append(mk("Notifications Brave", "", async () => { const s = await notify.ask(); toast(s === "granted" ? "Notifications activées : tu seras prévenu même hub en arrière-plan" : "Notifications refusées (réglable dans Brave)"); acts.lastChild.remove(); }));
    c.append(ring, tx, acts);
    c.setAttribute("aria-label", d.head + " " + d.text);
    return c;
  }

  function show(r, missed) {
    if (shown.has(r.key)) return;
    const c = card(r, missed); shown.set(r.key, c); box.prepend(c); box.hidden = false;
    pulse(1.2); state.accent = 0xffb347; setTimeout(() => { if (!shown.size) state.accent = null; }, 4000);
    const visible = document.visibilityState === "visible";
    if (visible) { sound.play(missed ? "doux" : "rappel"); buzz([60, 80, 60]); }
    if (leader && (!visible || !document.hasFocus())) notify.show("Hub · " + describe(r).head, r.title + (missed ? " (manqué)" : ""), r.key);
    const ok = c.querySelector(".btn.ok"); if (ok && !state.lite) ok.focus({ preventScroll: true });
  }
  function drop(key) { const c = shown.get(key); if (c) { c.remove(); shown.delete(key); } if (!shown.size) { box.hidden = true; state.accent = null; } }
  async function ack(key) { kv.seen[key] = Date.now(); delete kv.snooze[key]; drop(key); await saveKv(); }
  async function snooze(key) { kv.snooze[key] = Date.now() + SNOOZE; drop(key); await saveKv(); toast("Rappel reporté de 10 minutes"); }

  let busy = false;
  async function check() {
    if (busy) return; busy = true;
    try {
      const now = Date.now(), list = await collect(), live = new Set();
      for (const r of list) {
        live.add(r.key);
        if (kv.seen[r.key]) { drop(r.key); continue; }
        const at = kv.snooze[r.key] || r.at;
        if (at > now) { drop(r.key); continue; }
        if (now - at > MAX_LATE) continue;                     // trop vieux : on ne dérange plus
        show(r, at < startedAt - 60e3 && !kv.snooze[r.key]);
      }
      [...shown.keys()].forEach((k) => { if (!live.has(k)) drop(k); });   // supprimé ou modifié ailleurs
    } finally { busy = false; }
  }

  store.on("kv", async () => { await loadKv(); check(); });
  store.on("events", check); store.on("tasks", check);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  loadKv().then(check);
  setInterval(check, TICK);

  return {
    /** Rappel d'essai, pour tester le son et l'alerte. */
    test() { const r = { key: "essai@" + Date.now(), at: Date.now(), kind: "event", title: "Rappel d'essai : tout fonctionne", when: Date.now() + 5 * 60e3, before: 5 }; show(r, false); if (!sound.ready && sound.on) toast("Son bloqué par le navigateur : clique une fois dans le hub, puis réessaie"); }
  };
}
