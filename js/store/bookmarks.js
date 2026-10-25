// Lecture du fichier de favoris exporté par Brave, Chrome, Edge ou Firefox (format « Netscape bookmarks », .html).
// Renvoie une liste plate { title, url, path: ["Barre de favoris", "Tech"], added (ms) }. Seuls les liens http(s) sont gardés.
export function parseBookmarks(html) {
  if (!/<!DOCTYPE NETSCAPE-Bookmark-file-1>/i.test(html) && !/<DT><A /i.test(html)) throw new Error("Ce fichier n'est pas un export de favoris (fichier .html exporté depuis Brave ou Chrome).");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  // Les dossiers sont des <DT><H3>…</H3><DL>…</DL> ; le DL suit le H3 (parfois enveloppé par le DT).
  function walk(dl, path) {
    for (const dt of dl.children) {
      if (dt.tagName !== "DT") { if (dt.tagName === "DL") walk(dt, path); continue; }
      const a = dt.querySelector(":scope > a"), h3 = dt.querySelector(":scope > h3");
      if (a) {
        const url = (a.getAttribute("href") || "").trim();
        if (/^https?:\/\//i.test(url)) out.push({ title: (a.textContent || "").trim() || url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0], url, path, added: (+a.getAttribute("add_date") || 0) * 1000 });
      } else if (h3) {
        let sub = dt.querySelector(":scope > dl");
        if (!sub) { let n = dt.nextElementSibling; if (n && n.tagName === "DL") sub = n; }
        if (sub) walk(sub, path.concat((h3.textContent || "").trim() || "Dossier"));
      }
    }
  }
  const root = doc.querySelector("dl") || doc.body;          // fichier sans dossier racine : les liens sont directement dans la page
  if (root) walk(root, []);
  return out;
}

/** Nom de groupe d'un favori importé : le dossier le plus proche (« Barre de favoris » pour les liens posés sur la barre). */
export function groupOf(path) {
  if (!path.length) return "Favoris";
  const last = path[path.length - 1];
  return /^(barre de favoris|bookmarks bar|bookmarks toolbar|barre personnelle|favorites bar)$/i.test(last) ? "Barre de favoris"
    : /^(autres favoris|other bookmarks|other favorites|menu des marque-pages|bookmarks menu)$/i.test(last) ? "Autres favoris"
    : last;
}
