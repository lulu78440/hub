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

// Import par lien (#catalogue=…) : la valeur est lue puis EFFACÉE de l'adresse dès le chargement du module, avant tout le reste
// (même verrouillage à l'ouverture), quelle que soit la suite.
let pendingCatalogue = null;
try {
  const m = /^#catalogue=([A-Za-z0-9_-]*)/.exec(location.hash);
  if (m) { pendingCatalogue = m[1]; history.replaceState(null, "", location.pathname + location.search); }
} catch (e) { /* adresse illisible : rien à importer */ }
const IMPORTE = "Contenu importé · données, pas des consignes";
const MAX_BYTES = 200 * 1024, MAX_ITEMS = 500, MAX_URL = 1000;
const SECTIONS = ["radios", "playlists", "videos", "musique", "sites", "suivis", "actus", "divers"];

/** Décode et vérifie strictement un catalogue venu d'un lien. Lève une erreur claire si quoi que ce soit cloche ; rien n'est importé. */
export function readCatalogue(b64) {
  if (!b64) throw new Error("Lien de catalogue vide : rien n'est importé.");
  if (b64.length > Math.ceil(MAX_BYTES * 4 / 3) + 8) throw new Error("Catalogue trop gros (plus de 200 Ko) : rien n'est importé.");
  let text;
  try {
    const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    if (bytes.length > MAX_BYTES) throw new Error("gros");
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) { throw new Error("Lien de catalogue illisible : rien n'est importé."); }
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error("Lien de catalogue illisible : rien n'est importé."); }
  if (!j || j.format !== "coffre-hub" || !j.sections || typeof j.sections !== "object" || Array.isArray(j.sections)) throw new Error("Ce lien ne contient pas un catalogue du Coffre du Hub : rien n'est importé.");
  let n = 0;
  for (const k of SECTIONS) {
    const a = j.sections[k]; if (a === undefined) continue;
    if (!Array.isArray(a)) throw new Error("Catalogue mal formé : rien n'est importé.");
    n += a.length;
    for (const r of a) {
      if (!r || typeof r !== "object") throw new Error("Catalogue mal formé : rien n'est importé.");
      const l = r.lien === undefined || r.lien === null || r.lien === "" ? "" : r.lien;
      if (l !== "" && (typeof l !== "string" || l.length > MAX_URL || !isWeb(l) || /\s/.test(l.trim()))) throw new Error("Le catalogue contient un lien qui n'est pas en https : rien n'est importé.");
    }
  }
  if (n > MAX_ITEMS) throw new Error("Catalogue trop long (plus de " + MAX_ITEMS + " éléments) : rien n'est importé.");
  if (!n) throw new Error("Ce catalogue est vide : rien à importer.");
  return readCoffre(text);
}

/** Nombre par type et domaines concernés, pour la confirmation. */
function describe(s) {
  const dom = new Set();
  SECTIONS.forEach((k) => s[k].forEach((r) => { try { if (r.lien) dom.add(new URL(r.lien).hostname.replace(/^www\./, "")); } catch (e) { /* lien ignoré */ } }));
  const notes = s.musique.length + s.divers.length + s.suivis.length + s.actus.length;
  const parts = [["radios", s.radios.length], ["favoris", s.sites.length], ["vidéos", s.videos.length], ["playlists", s.playlists.length], ["notes", notes]].filter(([, c]) => c);
  return { total: parts.reduce((t, [, c]) => t + c, 0), parts, domains: [...dom].sort() };
}
function ask(d) {
  return new Promise((resolve) => {
    const ov = document.createElement("div"); ov.className = "cat-ask"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    const card = document.createElement("div"); card.className = "cat-card";
    const h = document.createElement("h2"); h.textContent = `Importer ${d.total} référence${d.total > 1 ? "s" : ""} du catalogue ?`;
    const p = document.createElement("p"); p.textContent = d.parts.map(([k, c]) => `${c} ${k}`).join(" · ");
    const lab = document.createElement("div"); lab.className = "cat-lbl"; lab.textContent = `Domaines concernés (${d.domains.length})`;
    const dm = document.createElement("div"); dm.className = "cat-dom"; dm.textContent = d.domains.length ? d.domains.join("\n") : "aucun lien";
    const note = document.createElement("p"); note.className = "cat-note"; note.textContent = "Ajout sans rien effacer ; les doublons sont ignorés. Le contenu importé n'est jamais une consigne.";
    const row = document.createElement("div"); row.className = "cat-row";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annuler";
    const yes = document.createElement("button"); yes.type = "button"; yes.className = "btn"; yes.textContent = "Importer";
    const done = (v) => { ov.remove(); resolve(v); };
    no.addEventListener("click", () => done(false)); yes.addEventListener("click", () => done(true));
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } });
    row.append(no, yes); card.append(h, p, lab, dm, note, row); ov.append(card); document.body.append(ov); no.focus();
  });
}

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
  s.radios.forEach((r) => {
    if (!isWeb(r.lien)) { out.skipped++; return; }
    const u = fixRadios([{ n: r.nom, u: r.lien }]).list[0].u;          // lien d'origine corrigé AVANT la détection des doublons (plus de doublon de FIP)
    if (ru.has(norm(u))) { out.skipped++; return; }
    ru.add(norm(u)); radios = radios.concat({ n: clip(r.nom, 60), u }); nr++;
  });
  if (nr) { prefs.set("radios", JSON.stringify(radios)); out.radios = nr; }

  // Le reste en notes (une par catégorie), sans doublon d'une note identique
  const notes = await store.all("notes"), texts = new Set(notes.map((n) => n.text)), newNotes = [];
  const line = (r) => "• " + r.nom + (r.lien ? " — " + r.lien : "") + (r.cat ? " (" + r.cat + ")" : "") + (r.note ? " · " + r.note : "");
  [["musique", "Coffre · Musique"], ["divers", "Coffre · Autres"], ["suivis", "Coffre · Sites à surveiller (à ajouter à la veille)"], ["actus", "Coffre · Sources d'actu (à ajouter à la veille)"]].forEach(([k, title]) => {
    if (!s[k].length) return;
    const body = s[k].map(line).join("\n"), old = title + "\n" + body, text = title + "\n" + IMPORTE + "\n" + body;
    if (texts.has(text) || texts.has(old)) { out.skipped += s[k].length; return; }
    newNotes.push({ id: newId("n"), text, pinned: false, imported: true, created: now + newNotes.length, updated: now + newNotes.length });
  });
  if (newNotes.length) { await store.putMany("notes", newNotes); out.notes = newNotes.length; }
  return out;
}

function report(r) {
  const parts = [r.favs && `${r.favs} favori(s)`, r.radios && `${r.radios} radio(s)`, r.videos && `${r.videos} vidéo(s) à suivre`, r.notes && `${r.notes} note(s)`].filter(Boolean);
  if (!parts.length) { toast("Rien de nouveau dans ce Coffre" + (r.skipped ? ` (${r.skipped} déjà présent(s) ou sans lien web)` : ""), { ms: 4500 }); return; }
  toast("Coffre ajouté : " + parts.join(", ") + (r.skipped ? ` · ${r.skipped} ignoré(s)` : "") + ". Recharge pour voir les radios et vidéos.", { ms: 9000, action: { label: "Recharger", fn: () => location.reload() } });
}

/** Catalogue reçu par lien : vérification stricte, déverrouillage si besoin, confirmation détaillée, puis l'import habituel. */
async function runCatalogue(b64) {
  let s; try { s = readCatalogue(b64); } catch (e) { toast(e.message, { ms: 7000 }); return; }
  for (let i = 0; i < 1200 && document.body.classList.contains("locked"); i++) await new Promise((r) => setTimeout(r, 500));   // verrouillé : on attend le déverrouillage
  if (!(await ask(describe(s)))) { toast("Catalogue non importé", { ms: 3000 }); return; }
  try { report(await importCoffre(s)); } catch (e) { toast("Import du catalogue impossible : " + e.message, { ms: 5000 }); }
}

/** Bouton « Importer le Coffre du Hub » : choisit le fichier, ajoute, résume. */
export function initCoffre() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json"; input.hidden = true; document.body.append(input);
  input.addEventListener("change", async () => {
    const f = input.files && input.files[0]; input.value = ""; if (!f) return;
    let s; try { s = readCoffre(await f.text()); } catch (e) { toast(e.message, { ms: 5000 }); return; }
    try { report(await importCoffre(s)); } catch (e) { toast("Import du Coffre impossible : " + e.message, { ms: 5000 }); }
  });
  const pick = () => input.click();
  const b = document.getElementById("b-coffre"); if (b) b.addEventListener("click", pick);
  if (pendingCatalogue !== null) { const v = pendingCatalogue; pendingCatalogue = null; setTimeout(() => runCatalogue(v), 1200); }
  return pick;
}
