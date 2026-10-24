// Export et import des données du hub (fichier JSON). Boutons dans Diag, lignes dans le menu du fond.
// L'import remplace tout ce qui est sur l'appareil, après confirmation.
import { exportAll, readExport, importAll, store } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { VERSION } from "../version.js";
import { toast } from "./toast.js";
import { vault } from "../store/vault.js";
import { askSecret } from "./lockui.js";

const pad = (n) => String(n).padStart(2, "0");
const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function initData() {
  const $ = (id) => document.getElementById(id);
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json"; input.hidden = true; document.body.append(input);

  function showLast() {
    const v = prefs.get("dernier-export", ""), el = $("d-export"); if (!el) return;
    el.textContent = v ? fmt.format(new Date(v)) : "Jamais"; el.className = v ? "ok" : "warn";
  }

  async function exportFile() {
    try {
      const d = await exportAll(VERSION), n = new Date();
      // Verrouillage actif : le fichier est chiffré (il s'ouvre avec la phrase ou la clé de secours du moment)
      const sealed = vault.active, file = sealed ? await vault.sealExport(d) : d;
      const name = `hub-donnees-${sealed ? "chiffre-" : ""}${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}.json`;
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, sealed ? 0 : 1)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      prefs.set("dernier-export", n.toISOString()); showLast();
      const total = Object.values(d.data).reduce((s, l) => s + l.length, 0);
      toast(`Export prêt : ${name} (${total} élément${total > 1 ? "s" : ""}). Range-le sur le PC et dans Google Drive.`, { ms: 4500 });
    } catch (e) { toast("Export impossible : " + e.message, { ms: 4000 }); }
  }

  input.addEventListener("change", async () => {
    const f = input.files && input.files[0]; input.value = "";
    if (!f) return;
    let r, text = await f.text(), opened = null;
    // Export chiffré : il faut la phrase (ou la clé de secours) de l'époque de l'export
    let obj = null; try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (vault.isSealed(obj)) {
      opened = await askSecret("Export verrouillé", "Ce fichier est chiffré. Entre la phrase secrète (ou la clé de secours) en vigueur quand il a été exporté.", (v) => vault.openExport(obj, v));
      if (!opened) { toast("Import annulé"); return; }
      text = JSON.stringify(opened.d);
    }
    try { r = readExport(text); } catch (e) { toast(e.message, { ms: 4500 }); return; }
    const c = r.counts;
    const quand = r.date && !isNaN(r.date) ? " du " + fmt.format(r.date) : "";
    const ok = confirm(`Importer l'export${quand} ?\n\n${c.notes} note(s), ${c.tasks} tâche(s), ${c.events} événement(s), ${c.favs} favori(s), ${c.images} image(s).\n\nATTENTION : tout ce qui est actuellement dans le hub sur cet appareil sera remplacé.`);
    if (!ok) { toast("Import annulé"); return; }
    toast("Import en cours…", { ms: 10000 });
    try {
      if (opened && !vault.active) await vault.adopt(opened.bytes, opened.coffre);     // l'appareil reprend le verrouillage du fichier
      await importAll(r.d); toast("Import terminé : rechargement…"); setTimeout(() => location.reload(), 900); }
    catch (e) { toast("Import impossible : " + e.message, { ms: 4500 }); }
  });
  const importFile = () => input.click();

  $("b-export").addEventListener("click", exportFile);
  $("b-import").addEventListener("click", importFile);
  showLast();
  // Où sont les données : vraiment enregistrées sur l'appareil, ou seulement en mémoire (navigation privée…)
  (async () => {
    const el = $("d-store"); if (!el) return;
    const ok = await store.durable();
    let kept = false; try { kept = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (e) { kept = false; }
    el.textContent = ok ? "Sur l'appareil" + (kept ? " · protégées" : "") : "En mémoire seulement : perdues à la fermeture";
    el.className = ok ? "ok" : "bad";
    if (!ok) toast("Attention : ce navigateur n'enregistre pas les données du hub (navigation privée ?)", { ms: 6000 });
  })();
  return { exportFile, importFile };
}
