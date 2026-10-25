// Verrouillage de l'espace perso : écran de déverrouillage, verrouillage automatique, réglages dans Diag.
// La sécurité elle-même est dans store/vault.js ; ici, seulement l'interface.
import { vault } from "../store/vault.js";
import { rewriteAll, plainAll, migrate } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { extendMenu } from "./menus.js";
// p4-perf : rien ne s'anime derrière l'écran verrouillé
import { state } from "../state.js";

const MIN = 10;                                  // longueur minimale de la phrase
let screen = null, locked = false, fails = 0, waitUntil = 0;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
function field(ph, type = "password") { const i = el("input", "inl"); i.type = type; i.placeholder = ph; i.autocomplete = type === "password" ? "current-password" : "off"; i.spellcheck = false; i.addEventListener("keydown", (e) => e.stopPropagation()); return i; }
function btn(text, cls = "btn") { const b = el("button", cls, text); b.type = "button"; return b; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Grand écran du coffre (au-dessus de tout). Renvoie la carte à remplir. */
function sheet() {
  if (!screen) { screen = el("div", "lock"); screen.setAttribute("role", "dialog"); screen.setAttribute("aria-modal", "true"); screen.innerHTML = '<div class="lring" aria-hidden="true"></div>'; document.body.append(screen); }
  screen.hidden = false; document.body.classList.add("locked"); state.paused = true;
  screen.querySelector(".lcard") && screen.querySelector(".lcard").remove();
  const card = el("form", "lcard"); card.autocomplete = "off"; screen.append(card);
  return card;
}
function closeSheet() { if (screen) screen.hidden = true; document.body.classList.remove("locked"); state.paused = false; }

/** Nouvelle phrase (deux fois). Résout avec la phrase choisie, ou null si annulé (cancel = false : impossible d'annuler). */
function askNew(card, title, intro, cancel = true) {
  return new Promise((res) => {
    card.innerHTML = "";
    card.append(el("b", "lh", title), el("p", "lp", intro));
    const a = field("Nouvelle phrase secrète (" + MIN + " caractères ou plus)"), b = field("La même, encore une fois");
    a.autocomplete = b.autocomplete = "new-password";
    const msg = el("p", "lmsg"), row = el("div", "erow"), ok = btn("Valider", "btn ok");
    card.append(a, b, msg, row);
    if (cancel) { const no = btn("Annuler"); no.addEventListener("click", () => res(null)); row.append(no); }
    row.append(ok); ok.type = "submit";
    card.onsubmit = (e) => {
      e.preventDefault();
      if (a.value.length < MIN) { msg.textContent = `Au moins ${MIN} caractères. Idée : quatre mots sans lien, ex. « girafe tunnel citron 47 ».`; a.focus(); return; }
      if (a.value !== b.value) { msg.textContent = "Les deux phrases ne sont pas identiques."; b.focus(); return; }
      res(a.value);
    };
    setTimeout(() => a.focus(), 30);
  });
}

/** Montre la clé de secours : impossible de continuer sans confirmer qu'elle est notée. */
function showRescue(card, code, intro) {
  return new Promise((res) => {
    card.innerHTML = ""; card.onsubmit = (e) => e.preventDefault();
    card.append(el("b", "lh", "Ta clé de secours"), el("p", "lp", intro || "Elle ouvre le hub si tu oublies ta phrase. Note-la sur papier ou dans un gestionnaire de mots de passe, JAMAIS dans le dépôt GitHub ni dans le hub. Elle ne sera plus affichée."));
    const k = el("code", "lkey", code); card.append(k);
    const row = el("div", "erow"), cp = btn("Copier"), ok = btn("Terminé", "btn ok");
    const lab = el("label", "chkl"), cb = document.createElement("input"); cb.type = "checkbox"; lab.append(cb, document.createTextNode(" Je l'ai notée en lieu sûr, hors du hub"));
    ok.disabled = true; cb.addEventListener("change", () => { ok.disabled = !cb.checked; });
    cp.addEventListener("click", async () => { try { await navigator.clipboard.writeText(code); cp.textContent = "Copiée"; } catch (e) { cp.textContent = "Copie impossible : recopie-la"; } });
    ok.addEventListener("click", () => { try { navigator.clipboard.writeText("").catch(() => {}); } catch (e) { /* rien */ } res(); });
    row.append(cp, ok); card.append(lab, row);
  });
}

/** Demande la phrase (ou la clé de secours). mode "start" : ouvre le coffre ; "screen" : vérifie seulement. */
function askUnlock(mode) {
  return new Promise((res) => {
    const card = sheet();
    let rescue = false;
    const draw = () => {
      card.innerHTML = "";
      card.append(el("b", "lh", rescue ? "Clé de secours" : "HUB · VERROUILLÉ"), el("p", "lp", rescue ? "Entre la clé de secours notée lors de l'activation (24 caractères). Tu choisiras ensuite une nouvelle phrase." : "Entre ta phrase secrète pour ouvrir ton espace perso."));
      const i = field(rescue ? "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" : "Phrase secrète", rescue ? "text" : "password");
      const msg = el("p", "lmsg"), row = el("div", "erow"), ok = btn(rescue ? "Ouvrir avec la clé" : "Déverrouiller", "btn ok"); ok.type = "submit";
      const sw = btn(rescue ? "J'ai ma phrase" : "Phrase oubliée ?", "btn lnkb");
      sw.addEventListener("click", () => { rescue = !rescue; draw(); });
      row.append(sw, ok); card.append(i, msg, row);
      card.onsubmit = async (e) => {
        e.preventDefault();
        const left = Math.ceil((waitUntil - Date.now()) / 1000);
        if (left > 0) { msg.textContent = `Trop d'essais : attends ${left} s.`; return; }
        ok.disabled = true; msg.textContent = "Vérification…"; await sleep(30);
        const v = i.value;
        const good = mode === "start" ? await (rescue ? vault.unlockRescue(v) : vault.unlock(v)) : await (rescue ? vault.checkRescue(v) : vault.check(v));
        ok.disabled = false;
        if (!good) { document.dispatchEvent(new CustomEvent("hub:unlock", { detail: { ok: false, secours: !!rescue } })); fails++; if (fails >= 5) { waitUntil = Date.now() + 30000 * (fails - 4); } msg.textContent = rescue ? "Clé de secours incorrecte." : "Phrase incorrecte."; i.select(); return; }
        fails = 0; document.dispatchEvent(new CustomEvent("hub:unlock", { detail: { ok: true, secours: !!rescue } }));
        if (rescue) {
          const p = await askNew(card, "Nouvelle phrase secrète", "La clé de secours a servi : choisis une nouvelle phrase. Une nouvelle clé de secours sera ensuite créée (l'ancienne ne marchera plus).", false);
          card.innerHTML = ""; card.append(el("b", "lh", "Nouvelle clé…"), el("p", "lp", "Tes données sont rechiffrées. Ne ferme pas l'onglet."));
          await showRescue(card, await rotate(p));
        }
        res();
      };
      setTimeout(() => i.focus(), 30);
    };
    draw();
  });
}

/** Au démarrage : si le verrouillage est actif, rien ne s'ouvre avant la bonne phrase. */
export async function gate() {
  if (!vault.active) return;
  await askUnlock("start");
  closeSheet();
  // Ménage : un changement de clé interrompu est terminé, un élément resté en clair est chiffré.
  try { await migrate(async () => { if (vault.rotating) { await rewriteAll(); vault.endRotation(); } else await rewriteAll(true); }); } catch (e) { console.warn("coffre : ménage reporté", e); }
}

/** Nouvelle clé de données + nouvelle phrase + nouvelle clé de secours (renvoyée), données rechiffrées. */
async function rotate(phrase) {
  return migrate(async () => { const code = await vault.rotate(phrase); await rewriteAll(); await vault.flush(); vault.endRotation(); return code; });
}

export async function lockNow() {
  if (!vault.active || locked || (screen && !screen.hidden)) return;
  locked = true;
  await askUnlock("screen");
  locked = false; closeSheet(); mark();
}

/** Demande un secret pour ouvrir un export chiffré. tryIt(valeur) renvoie le résultat, ou null si le secret est faux.
 *  Résout avec ce résultat, ou null si annulé. */
export function askSecret(title, intro, tryIt) {
  return new Promise((res) => {
    const card = sheet();
    card.append(el("b", "lh", title), el("p", "lp", intro));
    const i = field("Phrase secrète ou clé de secours"), msg = el("p", "lmsg"), row = el("div", "erow"), no = btn("Annuler"), ok = btn("Ouvrir", "btn ok"); ok.type = "submit";
    row.append(no, ok); card.append(i, msg, row);
    no.addEventListener("click", () => { closeSheet(); res(null); });
    card.onsubmit = async (e) => {
      e.preventDefault(); ok.disabled = true; msg.textContent = "Vérification…";
      let r = null; try { r = await tryIt(i.value); } catch (err) { r = null; }
      ok.disabled = false;
      if (r) { closeSheet(); res(r); } else { msg.textContent = "Phrase ou clé incorrecte pour ce fichier."; i.select(); }
    };
    setTimeout(() => i.focus(), 30);
  });
}

// ---------- Verrouillage automatique ----------
let lastAct = Date.now();
const mark = () => { lastAct = Date.now(); };
const delay = () => +prefs.get("coffre-delai", "15") * 60e3;      // 0 = jamais

export function initLockUI() {
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => addEventListener(t, mark, { passive: true, capture: true }));
  let mv = 0; addEventListener("pointermove", () => { const n = Date.now(); if (n - mv > 5000) { mv = n; mark(); } }, { passive: true });
  setInterval(() => { if (vault.active && delay() && !locked && Date.now() - lastAct > delay()) lockNow(); }, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && vault.active && delay() && Date.now() - lastAct > delay()) lockNow(); });
  extendMenu("fond", () => (vault.active ? [{ t: "Verrouiller maintenant", fn: lockNow }] : []));

  const box = document.getElementById("coffre"); if (!box) return;
  const dd = document.getElementById("d-coffre");
  function draw() {
    box.querySelectorAll(":scope > :not(b)").forEach((n) => n.remove());
    if (dd) { dd.textContent = vault.active ? "Actif · données chiffrées sur l'appareil" : "Non activé : notes et tâches lisibles sur l'appareil"; dd.className = vault.active ? "ok" : "warn"; }
    const row = el("div", "erow");
    if (!vault.active) {
      const p = el("p", "lp", "Une phrase secrète ouvre le hub ; tout ce qui est personnel est chiffré sur l'appareil et dans les exports. Fais d'abord un export (en clair) par sécurité.");
      const on = btn("Activer le verrouillage", "btn ok"); on.addEventListener("click", enable); row.append(on); box.append(p, row); return;
    }
    const now = btn("Verrouiller maintenant"); now.addEventListener("click", lockNow);
    const ch = btn("Changer la phrase"); ch.addEventListener("click", change);
    const rs = btn("Nouvelle clé de secours"); rs.addEventListener("click", renew);
    const off = btn("Désactiver", "btn danger"); off.addEventListener("click", disable);
    const lab = el("label", "chkl", "Verrouillage auto "), sel = document.createElement("select"); sel.className = "inl";
    [["5", "après 5 min"], ["15", "après 15 min"], ["30", "après 30 min"], ["60", "après 1 h"], ["0", "jamais (fermer l'onglet)"]].forEach(([v, t]) => { const o = el("option", "", t); o.value = v; sel.append(o); });
    sel.value = prefs.get("coffre-delai", "15"); sel.addEventListener("change", () => { prefs.set("coffre-delai", sel.value); toast("Verrouillage automatique : " + sel.selectedOptions[0].textContent); });
    lab.append(sel); row.append(now, ch, rs, off); box.append(row, lab);
  }
  async function confirmPhrase(card, title) {
    card.innerHTML = ""; card.append(el("b", "lh", title), el("p", "lp", "Entre ta phrase actuelle."));
    const i = field("Phrase actuelle"), msg = el("p", "lmsg"), row = el("div", "erow"), no = btn("Annuler"), ok = btn("Continuer", "btn ok"); ok.type = "submit";
    row.append(no, ok); card.append(i, msg, row); setTimeout(() => i.focus(), 30);
    return new Promise((res) => {
      no.addEventListener("click", () => res(false));
      card.onsubmit = async (e) => { e.preventDefault(); msg.textContent = "Vérification…"; if (await vault.check(i.value)) res(i.value); else { msg.textContent = "Phrase incorrecte."; i.select(); } };
    });
  }
  async function enable() {
    const card = sheet();
    const p = await askNew(card, "Activer le verrouillage", "Choisis une phrase secrète : elle sera demandée à chaque ouverture du hub (et après le verrouillage automatique). Sans elle ni la clé de secours, tes données sont perdues : personne ne peut les récupérer.");
    if (!p) { closeSheet(); return; }
    card.innerHTML = ""; card.append(el("b", "lh", "Chiffrement…"), el("p", "lp", "Tes données sont chiffrées sur l'appareil. Ne ferme pas l'onglet."));
    let code = null;
    try {
      code = await migrate(async () => {
        if (vault.active) return null;                       // déjà activé dans un autre onglet
        const c = await vault.create(p);
        try { await rewriteAll(); await vault.flush(); }
        catch (e) { try { await plainAll(); await vault.destroy(); } catch (e2) { /* rien de plus à faire */ } throw e; }   // retour en arrière
        return c;
      });
    } catch (e) { closeSheet(); draw(); toast("Activation impossible : " + e.message, { ms: 5000 }); return; }
    if (!code) { location.reload(); return; }
    await showRescue(card, code);
    closeSheet(); draw(); toast("Verrouillage actif : tes données sont chiffrées sur cet appareil", { ms: 4500 });
  }
  async function change() {
    const card = sheet();
    if (!await confirmPhrase(card, "Changer la phrase")) { closeSheet(); return; }
    const p = await askNew(card, "Nouvelle phrase", "Le hub change aussi sa clé interne et te donne une nouvelle clé de secours : l'ancienne phrase et l'ancienne clé de secours n'ouvriront plus que les exports faits avant.");
    if (!p) { closeSheet(); return; }
    card.innerHTML = ""; card.append(el("b", "lh", "Nouvelle clé…"), el("p", "lp", "Tes données sont rechiffrées. Ne ferme pas l'onglet."));
    try { await showRescue(card, await rotate(p)); toast("Nouvelle phrase enregistrée"); }
    catch (e) { toast("Changement impossible : " + e.message, { ms: 5000 }); }
    closeSheet();
  }
  async function renew() {
    const card = sheet();
    const p = await confirmPhrase(card, "Nouvelle clé de secours"); if (!p) { closeSheet(); return; }
    card.innerHTML = ""; card.append(el("b", "lh", "Nouvelle clé…"), el("p", "lp", "Tes données sont rechiffrées. Ne ferme pas l'onglet."));
    try { await showRescue(card, await rotate(p), "L'ancienne clé de secours n'ouvre plus que les exports faits avant. Note la nouvelle hors du hub."); toast("Nouvelle clé de secours enregistrée"); }
    catch (e) { toast("Échec : " + e.message, { ms: 5000 }); }
    closeSheet();
  }
  async function disable() {
    const card = sheet();
    if (!await confirmPhrase(card, "Désactiver le verrouillage")) { closeSheet(); return; }
    card.innerHTML = ""; card.append(el("b", "lh", "Déchiffrement…"), el("p", "lp", "Tes données sont remises en clair sur l'appareil."));
    try { await migrate(async () => { await plainAll(); await vault.destroy(); }); closeSheet(); draw(); toast("Verrouillage désactivé : données en clair sur cet appareil", { ms: 4500 }); }
    catch (e) { closeSheet(); toast("Désactivation impossible : " + e.message, { ms: 5000 }); }
  }
  draw();
}
