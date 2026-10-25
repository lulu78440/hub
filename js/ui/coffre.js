// Import du « Coffre du Hub » (fichier coffre-hub.json, préparé dans l'artifact Coffre du Hub sur Claude).
// Contrairement à l'import d'un export du hub, celui-ci AJOUTE sans rien effacer, et ignore les doublons.
//   sites            → Favoris (groupe = dossier du Coffre)
//   radios           → radios de la fenêtre Musique
//   vidéos YouTube   → « Vidéos à suivre » ; autres vidéos (Vimeo, .mp4) → Favoris, groupe « Vidéos » (lecteur à venir)
//   playlists        → Favoris, groupe « Playlists YouTube » (la première devient la playlist de la Musique si aucune n'est choisie)
//   musique, autres, sites suivis, sources d'actu → une note par catégorie (la veille passe par flux/sources.json)
import { store, newId } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { parseYouTube, RADIOS, fixRadios } from "../widgets/media.js";

const norm = (u) => (u || "").trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
const isWeb = (u) => /^https:\/\//i.test(u || "");
const readJ = (k, d) => { try { const v = JSON.parse(prefs.get(k, "null")); return v ?? d; } catch (e) { return d; } };
const clip = (s, n) => String(s || "").trim().slice(0, n);

/** Lit le fichier et vérifie qu'il vient bien du Coffre. */
export function readCoffre(text) {
  let j = null; try { j = JSON.parse(String(text).replace(/^\uFEFF/, "")); } catch (e) { j = null; }
  if (!j || (j.format !== "coffre-hub" && !(j.format === "hub-donnees" && j.sections)) || !j.sections || typeof j.sections !== "object") {
    throw new Error("Ce fichier n'est pas un export du Coffre du Hub (coffre-hub.json).");
  }
  const s = {};
  for (const k of ["radios", "playlists", "videos", "musique", "sites", "suivis", "actus", "divers"]) {
    s[k] = (Array.isArray(j.sections[k]) ? j.sections[k] : [])
      .filter((r) => r && typeof r.nom === "string" && r.nom.trim())
      .map((r) => ({ nom: clip(r.nom, 200), lien: clip(r.lien, 1000), cat: clip(r.cat, 60), note: clip(r.note, 300) }));
  }
  return s;
}

/** Ajoute le contenu du Coffre au hub. Renvoie le résumé par destination. */
export async function importCoffre(s) {
  const out = { favs: 0, radios: 0, videos: 0, notes: 0, skipped: 0 };
  const now = Date.now();

  // Favoris : sites, playlists, vidéos hors YouTube
  const favs = await store.all("favs"), seen = new Set(favs.map((f) => norm(f.url))), fresh = [];
  const addFav = (r, group) => {
    if (!isWeb(r.lien)) { out.skipped++; return; }
    const k = norm(r.lien); if (seen.has(k)) { out.skipped++; return; }
    seen.add(k); fresh.push({ id: newId("f"), title: clip(r.nom, 120), url: r.lien, group: group || "Coffre", created: now + fresh.length });
  };
  s.sites.forEach((r) => addFav(r, r.cat || "Coffre"));
  s.playlists.forEach((r) => addFav(r, "Playlists YouTube"));

  // Vidéos : YouTube dans « Vidéos à suivre » (30 au plus, les plus récentes devant), le reste en favoris
  let queue = readJ("video-file", []); const qv = new Set(queue.map((x) => x.v)), addQ = [];
  s.videos.forEach((r) => {
    const y = parseYouTube(r.lien);
    if (y && y.v) { if (qv.has(y.v)) { out.skipped++; return; } qv.add(y.v); addQ.push({ v: y.v, list: y.list, t: r.nom }); }
    else addFav(r, y && y.list ? "Playlists YouTube" : "Vidéos");
  });
  if (addQ.length) { queue = addQ.concat(queue).slice(0, 30); prefs.set("video-file", JSON.stringify(queue)); out.videos = addQ.length; }
  if (fresh.length) { await store.putMany("favs", fresh); out.favs = fresh.length; }

  // Première playlist du Coffre = playlist de la Musique, si aucune n'est encore choisie
  if (!readJ("musique-yt", null)) {
    const p = s.playlists.map((r) => parseYouTube(r.lien)).find((y) => y && y.list);
    if (p) prefs.set("musique-yt", JSON.stringify(p));
  }

  // Radios (adresse https uniquement ; une page web au lieu d'un flux ne jouera pas)
  let radios = fixRadios(readJ("radios", null) || RADIOS.slice()).list; const ru = new Set(radios.map((r) => norm(r.u))); let nr = 0;
  s.radios.forEach((r) => { if (!isWeb(r.lien) || ru.has(norm(r.lien))) { out.skipped++; return; } ru.add(norm(r.lien)); radios = radios.concat({ n: clip(r.nom, 60), u: r.lien }); nr++; });
  if (nr) { prefs.set("radios", JSON.stringify(radios)); out.radios = nr; }

  // Le reste en notes (une par catégorie), sans doublon d'une note identique
  const notes = await store.all("notes"), texts = new Set(notes.map((n) => n.text)), newNotes = [];
  const line = (r) => "• " + r.nom + (r.lien ? " — " + r.lien : "") + (r.cat ? " (" + r.cat + ")" : "") + (r.note ? " · " + r.note : "");
  [["musique", "Coffre · Musique"], ["divers", "Coffre · Autres"], ["suivis", "Coffre · Sites à surveiller (à ajouter à la veille)"], ["actus", "Coffre · Sources d'actu (à ajouter à la veille)"]].forEach(([k, title]) => {
    if (!s[k].length) return;
    const text = title + "\n" + s[k].map(line).join("\n");
    if (texts.has(text)) { out.skipped += s[k].length; return; }
    newNotes.push({ id: newId("n"), text, pinned: false, created: now + newNotes.length, updated: now + newNotes.length });
  });
  if (newNotes.length) { await store.putMany("notes", newNotes); out.notes = newNotes.length; }
  return out;
}

/** Bouton « Importer le Coffre du Hub » : choisit le fichier, ajoute, résume. */
export function initCoffre() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json"; input.hidden = true; document.body.append(input);
  input.addEventListener("change", async () => {
    const f = input.files && input.files[0]; input.value = ""; if (!f) return;
    let s; try { s = readCoffre(await f.text()); } catch (e) { toast(e.message, { ms: 5000 }); return; }
    try {
      const r = await importCoffre(s);
      const parts = [r.favs && `${r.favs} favori(s)`, r.radios && `${r.radios} radio(s)`, r.videos && `${r.videos} vidéo(s) à suivre`, r.notes && `${r.notes} note(s)`].filter(Boolean);
      if (!parts.length) { toast("Rien de nouveau dans ce Coffre" + (r.skipped ? ` (${r.skipped} déjà présent(s) ou sans lien web)` : ""), { ms: 4500 }); return; }
      toast("Coffre ajouté : " + parts.join(", ") + (r.skipped ? ` · ${r.skipped} ignoré(s)` : "") + ". Recharge pour voir les radios et vidéos.", { ms: 9000, action: { label: "Recharger", fn: () => location.reload() } });
    } catch (e) { toast("Import du Coffre impossible : " + e.message, { ms: 5000 }); }
  });
  const pick = () => input.click();
  const b = document.getElementById("b-coffre"); if (b) b.addEventListener("click", pick);
  return pick;
}
