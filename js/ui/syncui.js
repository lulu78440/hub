// Réglage et lancement de la synchro (3.5), dans Diag. Automatique ensuite : à l'ouverture, après chaque changement
// (au bout de 15 s), toutes les 5 minutes et au retour sur l'onglet.
import { sync } from "../store/sync.js";
import { store } from "../store/storage.js";
import { toast } from "./toast.js";

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function initSyncUI() {
  const $ = (id) => document.getElementById(id);
  const dd = $("d-sync"), box = $("syncbox");
  let busy = false, timer = 0, lastErr = "";

  function status(text, cls) { dd.textContent = text; dd.className = cls || ""; }
  function refresh() {
    if (!sync.configured) { status("Non configurée (une seule fois par appareil)", "warn"); $("b-sync").textContent = "Configurer la synchro"; $("b-sync-now").hidden = true; $("b-sync-off").hidden = true; return; }
    const s = sync.state();
    status(lastErr ? "Erreur : " + lastErr : s ? "Active · dernière " + fmt.format(new Date(s.at)) : "Active", lastErr ? "bad" : "ok");
    $("b-sync").textContent = "Changer le jeton ou la phrase"; $("b-sync-now").hidden = false; $("b-sync-off").hidden = false;
  }
  async function run(manual) {
    if (!sync.configured || busy || !navigator.onLine) return;
    busy = true; status("Synchro en cours…", "warn");
    try { const r = await sync.run(); lastErr = ""; if (manual || r.pulled) toast(r.pulled ? `Synchro : ${r.pulled} changement(s) reçu(s) de l'autre appareil` : "Synchro faite"); }
    catch (e) { if (e.message !== lastErr || manual) toast("Synchro : " + e.message, { ms: 5000 }); lastErr = e.message; }
    finally { busy = false; refresh(); }
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => run(false), 15000); };

  // Formulaire de mise en route
  function form() {
    box.hidden = false; box.innerHTML = "";
    const h = document.createElement("div"); h.className = "sguide";
    h.innerHTML = `<b>Mettre en route la synchro (5 minutes, une fois par appareil)</b>
      <ol><li>Sur GitHub, ouvre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Nouveau jeton (fine-grained) ↗</a>.</li>
      <li>Nom : « hub-synchro ». Expiration : 1 an (le hub te préviendra s'il expire).</li>
      <li>« Permissions » → « Account permissions » → <b>Gists : Read and write</b>. Rien d'autre.</li>
      <li>« Generate token », copie-le et colle-le ci-dessous.</li>
      <li>Choisis une phrase secrète (la même sur le PC et le téléphone). Elle chiffre tes données : GitHub ne peut pas les lire. Ne la perds pas.</li></ol>`;
    const t = document.createElement("input"); t.type = "password"; t.className = "inl"; t.placeholder = "Jeton GitHub (github_pat_…)"; t.autocomplete = "off";
    const p = document.createElement("input"); p.type = "password"; p.className = "inl"; p.placeholder = "Phrase secrète (8 caractères ou plus)"; p.autocomplete = "new-password";
    const row = document.createElement("div"); row.className = "erow";
    const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn ok"; ok.textContent = "Activer la synchro";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annuler";
    row.append(no, ok); box.append(h, t, p, row); t.focus();
    [t, p].forEach((x) => x.addEventListener("keydown", (e) => e.stopPropagation()));
    no.addEventListener("click", () => { box.hidden = true; });
    ok.addEventListener("click", async () => {
      ok.disabled = true; ok.textContent = "Vérification…";
      try { const r = await sync.setup(t.value, p.value); box.hidden = true; toast(r.created ? "Synchro activée : coffre chiffré créé sur GitHub" : "Synchro activée : données de l'autre appareil retrouvées", { ms: 5000 }); lastErr = ""; await run(false); }
      catch (e) { toast(e.message, { ms: 5000 }); ok.disabled = false; ok.textContent = "Activer la synchro"; }
      refresh();
    });
  }
  $("b-sync").addEventListener("click", form);
  $("b-sync-now").addEventListener("click", () => run(true));
  $("b-sync-off").addEventListener("click", () => { if (!confirm("Arrêter la synchro sur cet appareil ? Tes données restent ici et dans le coffre GitHub.")) return; sync.forget(); lastErr = ""; refresh(); toast("Synchro arrêtée sur cet appareil"); });

  store.on("*", soon);
  setTimeout(() => run(false), 3000);
  setInterval(() => run(false), 5 * 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) run(false); });
  addEventListener("online", () => run(false));
  refresh();
  return { run };
}
