// Phase 5 · Mails importants, en LECTURE SEULE (Gmail et Outlook).
// Sécurité (décidée avec Opus) :
// - droits demandés : gmail.readonly (Google) et Mail.Read (Microsoft) : le hub ne peut ni envoyer, ni supprimer, ni modifier ;
// - aucun secret dans le code ni dans le dépôt : Lucien colle l'identifiant de SA propre application (Google Cloud, Microsoft Entra) dans le hub ;
// - connexion dans une fenêtre officielle Google / Microsoft ; jetons gardés sur l'appareil seulement (jamais exportés, jamais synchronisés) ;
// - Gmail : jeton d'une heure, redemandé sans clic tant que la session Google est ouverte ; Outlook : connexion avec PKCE, renouvelée 24 h.
// Tri : mails non lus des 7 derniers jours, marqués importants, ou venant d'un expéditeur / contenant un mot de tes règles.
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { pulse } from "../state.js";

const REDIRECT = new URL("oauth.html", location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "")).href;
const SEC = "hub-secret-mails";                 // jetons : exclus de l'export et de la synchro
const readJ = (k, d, store = localStorage) => { try { return JSON.parse(store.getItem(k)) ?? d; } catch (e) { return d; } };
const cfg = () => { try { return JSON.parse(prefs.get("mails", "null")) || { gmail: "", outlook: "", from: [], mots: [] }; } catch (e) { return { gmail: "", outlook: "", from: [], mots: [] }; } };
const saveCfg = (c) => prefs.set("mails", JSON.stringify(c));
const tok = () => readJ(SEC, {});
const saveTok = (t) => localStorage.setItem(SEC, JSON.stringify(t));
const rnd = (n = 32) => { const a = crypto.getRandomValues(new Uint8Array(n)); return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
async function sha256url(s) { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); return btoa(String.fromCharCode(...h)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

/** Ouvre la fenêtre de connexion et attend le retour (oauth.html). */
function popup(url, state) {
  return new Promise((res, rej) => {
    const w = open(url, "hub-oauth", "width=520,height=680");
    if (!w) { rej(new Error("Fenêtre bloquée : autorise les fenêtres surgissantes pour le hub")); return; }
    const bc = new BroadcastChannel("hub-oauth");
    const done = (data) => { clearInterval(iv); bc.close(); removeEventListener("message", onMsg); res(data); };
    const onMsg = (e) => { if (e.origin === location.origin && e.data && e.data.type === "hub-oauth") check(e.data.data); };
    const check = (d) => { const p = new URLSearchParams(d.hash || d.search); if (p.get("state") === state) done(p); };
    bc.onmessage = (e) => { if (e.data && e.data.type === "hub-oauth") check(e.data.data); };
    addEventListener("message", onMsg);
    const iv = setInterval(() => { if (w.closed) { setTimeout(() => { clearInterval(iv); bc.close(); removeEventListener("message", onMsg); rej(new Error("Connexion annulée")); }, 800); } }, 600);
  });
}

// ---------- Gmail ----------
async function gmailConnect(clientId, silent) {
  const state = rnd(12);
  const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: clientId, redirect_uri: REDIRECT, response_type: "token", scope: "https://www.googleapis.com/auth/gmail.readonly", include_granted_scopes: "true", state, ...(silent ? { prompt: "none" } : {}) });
  const p = await popup(url, state);
  if (p.get("error")) throw new Error("Google : " + p.get("error"));
  const t = tok(); t.gmail = { at: p.get("access_token"), exp: Date.now() + (+p.get("expires_in") - 60) * 1000 }; saveTok(t);
}
async function gmailList(c) {
  const t = tok().gmail; if (!t || t.exp < Date.now()) throw new Error("reconnexion");
  const or = ["is:important"].concat(c.from.map((f) => "from:" + f), c.mots.map((m) => "subject:" + JSON.stringify(m)));
  const q = "is:unread newer_than:7d (" + or.join(" OR ") + ")";
  const h = { Authorization: "Bearer " + t.at };
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?" + new URLSearchParams({ q, maxResults: "15" }), { headers: h });
  if (r.status === 401) throw new Error("reconnexion");
  if (!r.ok) throw new Error("Gmail répond " + r.status);
  const ids = ((await r.json()).messages || []).slice(0, 15);
  const out = await Promise.all(ids.map(async (m) => {
    const d = await (await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, { headers: h })).json();
    const hd = Object.fromEntries((d.payload && d.payload.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    return { src: "Gmail", from: (hd.from || "").replace(/<.*>/, "").replace(/"/g, "").trim() || hd.from, subject: hd.subject || "(sans objet)", date: +d.internalDate, extrait: d.snippet || "", lien: "https://mail.google.com/mail/u/0/#inbox/" + d.threadId, important: (d.labelIds || []).includes("IMPORTANT") };
  }));
  return out;
}

// ---------- Outlook (Microsoft Graph) ----------
const MS = "https://login.microsoftonline.com/common/oauth2/v2.0";
async function outlookConnect(clientId) {
  const verifier = rnd(48), state = rnd(12);
  const url = MS + "/authorize?" + new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: REDIRECT, response_mode: "query", scope: "offline_access Mail.Read User.Read", code_challenge: await sha256url(verifier), code_challenge_method: "S256", state, prompt: "select_account" });
  const p = await popup(url, state);
  if (p.get("error")) throw new Error("Microsoft : " + (p.get("error_description") || p.get("error")));
  await outlookToken(clientId, { grant_type: "authorization_code", code: p.get("code"), code_verifier: verifier, redirect_uri: REDIRECT });
}
async function outlookToken(clientId, body) {
  const r = await fetch(MS + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, scope: "offline_access Mail.Read User.Read", ...body }) });
  const j = await r.json(); if (!r.ok) throw new Error("Microsoft : " + (j.error_description || j.error || r.status));
  const t = tok(); t.outlook = { at: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000, rt: j.refresh_token || (t.outlook && t.outlook.rt) }; saveTok(t);
}
async function outlookList(c) {
  let t = tok().outlook; if (!t) throw new Error("reconnexion");
  if (t.exp < Date.now()) { if (!t.rt) throw new Error("reconnexion"); try { await outlookToken(c.outlook, { grant_type: "refresh_token", refresh_token: t.rt }); } catch (e) { throw new Error("reconnexion"); } t = tok().outlook; }
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const q = new URLSearchParams({ $filter: `receivedDateTime ge ${since} and isRead eq false`, $orderby: "receivedDateTime desc", $top: "40", $select: "subject,from,receivedDateTime,bodyPreview,webLink,importance" });
  const r = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?" + q, { headers: { Authorization: "Bearer " + t.at } });
  if (r.status === 401) throw new Error("reconnexion");
  if (!r.ok) throw new Error("Outlook répond " + r.status);
  const low = (s) => (s || "").toLowerCase();
  return ((await r.json()).value || []).map((m) => ({ src: "Outlook", from: (m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address)) || "", addr: low(m.from && m.from.emailAddress && m.from.emailAddress.address), subject: m.subject || "(sans objet)", date: Date.parse(m.receivedDateTime), extrait: m.bodyPreview || "", lien: m.webLink, important: m.importance === "high" }))
    .filter((m) => m.important || c.from.some((f) => m.addr.includes(low(f)) || low(m.from).includes(low(f))) || c.mots.some((k) => low(m.subject).includes(low(k))) || (!c.from.length && !c.mots.length))
    .slice(0, 15);
}

export function initMail() {
  const win = document.querySelector('.win[data-id="mails"]'); if (!win) return;
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag"), pf = win.querySelector(".pf");
  pb.className = "pb pb-mails";
  let mails = [], errs = {}, busy = false;
  const fmt = (ms) => { const d = new Date(ms), n = new Date(); return d.toDateString() === n.toDateString() ? d.toTimeString().slice(0, 5) : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }); };

  function render() {
    const c = cfg(), t = tok();
    pb.innerHTML = "";
    const bar = document.createElement("div"); bar.className = "mbar";
    [["gmail", "Gmail"], ["outlook", "Outlook"]].forEach(([k, n]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn";
      const on = t[k] && (k === "outlook" ? t[k].rt || t[k].exp > Date.now() : t[k].exp > Date.now());
      b.textContent = !c[k] ? "Configurer " + n : on ? n + " ✓" : "Connecter " + n;
      b.title = !c[k] ? "Colle l'identifiant de ton application " + n : on ? "Connecté (lecture seule)" : "Ouvrir la connexion " + n;
      b.addEventListener("click", () => (!c[k] ? setup(k) : connect(k)));
      bar.append(b);
    });
    const rb = document.createElement("button"); rb.type = "button"; rb.className = "btn"; rb.textContent = "Règles"; rb.addEventListener("click", rules); bar.append(rb);
    pb.append(bar);
    const ul = document.createElement("ul"); ul.className = "mlist";
    if (!c.gmail && !c.outlook) ul.innerHTML = '<li class="none">Lecture seule de tes mails importants. Commence par « Configurer Gmail » ou « Configurer Outlook » : le mode d\'emploi s\'affiche.</li>';
    else if (!mails.length) ul.innerHTML = `<li class="none">${busy ? "Lecture…" : Object.keys(errs).length ? Object.values(errs).join(" · ") : "Aucun mail important non lu sur 7 jours."}</li>`;
    mails.forEach((m) => {
      const li = document.createElement("li"); li.tabIndex = 0; li.title = m.extrait;
      li.innerHTML = '<span class="src"></span><div><b></b><span></span></div><em></em>';
      li.querySelector(".src").textContent = m.src === "Gmail" ? "G" : "O"; li.querySelector(".src").classList.add(m.src.toLowerCase());
      li.querySelector("b").textContent = m.from; li.querySelector("div span").textContent = m.subject; li.querySelector("em").textContent = (m.important ? "★ " : "") + fmt(m.date);
      const go = () => { const a = document.createElement("a"); a.href = m.lien; a.target = "_blank"; a.rel = "noopener"; a.click(); };
      li.addEventListener("click", go); li.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      ul.append(li);
    });
    pb.append(ul);
    tag.textContent = mails.length ? mails.length + " IMPORTANT" + (mails.length > 1 ? "S" : "") : "MAILS";
    if (pf) { pf.firstElementChild.textContent = "Lecture seule · non lus, 7 jours"; pf.lastElementChild.textContent = c.from.length + c.mots.length ? (c.from.length + c.mots.length) + " règle(s)" : "—"; }
  }

  async function refresh(manual) {
    const c = cfg(); if (busy || (!c.gmail && !c.outlook)) { render(); return; }
    busy = true; render(); errs = {};
    const all = [];
    for (const [k, fn] of [["gmail", gmailList], ["outlook", outlookList]]) {
      if (!c[k] || !tok()[k]) continue;
      try { all.push(...await fn(c)); }
      catch (e) { errs[k] = e.message === "reconnexion" ? (k === "gmail" ? "Gmail" : "Outlook") + " : clique « Connecter » (session expirée)" : e.message; }
    }
    mails = all.sort((a, b) => b.date - a.date).slice(0, 20); busy = false;
    if (manual) toast(mails.length ? mails.length + " mail(s) important(s)" : "Rien d'important");
    if (mails.length) pulse(0.6);
    render();
  }
  async function connect(k) {
    const c = cfg();
    try { if (k === "gmail") await gmailConnect(c.gmail, false); else await outlookConnect(c.outlook); toast((k === "gmail" ? "Gmail" : "Outlook") + " connecté en lecture seule"); refresh(); }
    catch (e) { toast(e.message, { ms: 5000 }); }
  }
  function form(title, html, fields, onOk) {
    pb.innerHTML = "";
    const f = document.createElement("form"); f.className = "mform"; f.autocomplete = "off";
    f.innerHTML = `<b>${title}</b><div class="mguide">${html}</div>`;
    const inputs = fields.map(([ph, val]) => { const i = document.createElement("input"); i.className = "inl"; i.placeholder = ph; i.value = val || ""; i.addEventListener("keydown", (e) => e.stopPropagation()); f.append(i); return i; });
    const row = document.createElement("div"); row.className = "erow";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annuler"; no.addEventListener("click", render);
    const ok = document.createElement("button"); ok.type = "submit"; ok.className = "btn ok"; ok.textContent = "Enregistrer";
    row.append(no, ok); f.append(row);
    f.addEventListener("submit", (e) => { e.preventDefault(); onOk(inputs.map((i) => i.value.trim())); render(); });
    pb.append(f); inputs[0].focus();
  }
  function setup(k) {
    const c = cfg();
    const guide = k === "gmail"
      ? `<ol><li>Ouvre <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud ↗</a> avec ton compte Gmail, crée un projet « hub » (gratuit, sans carte).</li>
         <li>Active <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener">l'API Gmail ↗</a>.</li>
         <li>« Écran de consentement OAuth » : type Externe, nom « Hub », et ajoute ton adresse dans « Utilisateurs test ».</li>
         <li>« Identifiants » → « Créer » → « ID client OAuth » → Application Web. Origine JavaScript : <code>${location.origin}</code>. URI de redirection : <code>${REDIRECT}</code>.</li>
         <li>Copie l'« ID client » (se termine par .apps.googleusercontent.com) et colle-le ci-dessous.</li></ol>`
      : `<ol><li>Ouvre <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener">Microsoft Entra · Inscriptions d'applications ↗</a> avec ton compte Outlook (gratuit).</li>
         <li>« Nouvelle inscription » : nom « Hub », comptes : « comptes Microsoft personnels » (et professionnels si besoin).</li>
         <li>Redirection : plateforme <b>Application monopage (SPA)</b>, adresse <code>${REDIRECT}</code>.</li>
         <li>Copie l'« ID d'application (client) » et colle-le ci-dessous. Aucun secret à créer.</li></ol>`;
    form(k === "gmail" ? "Configurer Gmail (lecture seule)" : "Configurer Outlook (lecture seule)", guide, [["Identifiant client", c[k]]], ([id]) => { c[k] = id; saveCfg(c); if (id) toast("Identifiant enregistré : clique « Connecter »"); });
  }
  function rules() {
    const c = cfg();
    form("Règles de tri", "Un mail non lu des 7 derniers jours est gardé s'il est marqué important, ou s'il vient d'un expéditeur listé, ou si son objet contient un mot listé. Sépare par des virgules.",
      [["Expéditeurs (ex. banque.fr, maman@gmail.com)", c.from.join(", ")], ["Mots dans l'objet (ex. facture, rendez-vous)", c.mots.join(", ")]],
      ([f, m]) => { c.from = f.split(",").map((s) => s.trim()).filter(Boolean); c.mots = m.split(",").map((s) => s.trim()).filter(Boolean); saveCfg(c); refresh(); });
  }
  registerMenu("mails", () => [{ h: "Mails · lecture seule" }, { t: "Actualiser", fn: () => refresh(true) }, { t: "Règles de tri", fn: rules },
    { t: "Configurer Gmail", fn: () => setup("gmail") }, { t: "Configurer Outlook", fn: () => setup("outlook") },
    { t: "Déconnecter (effacer les jetons de cet appareil)", fn: () => { localStorage.removeItem(SEC); mails = []; render(); toast("Jetons effacés"); } }]);
  render(); refresh();
  setInterval(refresh, 10 * 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
