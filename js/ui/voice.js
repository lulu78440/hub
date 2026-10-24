// Recherche vocale (idée « Commandes vocales » de la Boîte à idées, première partie : la barre de recherche).
// Utilise la reconnaissance vocale du navigateur (Web Speech). Chrome, Edge et Android la permettent ; BRAVE la bloque
// (son service de reconnaissance est coupé pour la vie privée) : le hub le dit alors et propose d'ouvrir le hub dans Chrome.
// Phrases comprises (français) : « youtube chats drôles », « vidéo de recette de crêpes » (Brave Vidéos), « images de montagne »,
// « actualités météo » (Brave Actualités), « google … », « duckduckgo … », sinon recherche Brave.
import { prefs } from "../store/prefs.js";
import { pulse } from "../state.js";

const norm = (s) => s.toLowerCase().normalize("NFC").replace(/[.,!?;:]+$/g, "").replace(/\s+/g, " ").trim();
const cut = (q) => q.replace(/^(?:de |du |des |sur |d['’]|la |le |les )/, "").trim();

/** Phrase dite → texte de la barre de recherche (« !y chat »). Exporté pour les essais. */
export function voiceToQuery(said) {
  let t = norm(said).replace(/^(?:s'il te plaît |s'il vous plaît |ok hub |hub |dis |peux-tu |peux tu )+/, "").replace(/^(?:recherche|rechercher|cherche|chercher|trouve|trouver|montre-moi|montre moi|ouvre)\s+/, "");
  let m;
  if ((m = t.match(/^(.+?)\s+sur\s+youtube$/))) return "!y " + m[1];
  if ((m = t.match(/^(?:sur\s+)?youtube\s+(.+)$/))) return "!y " + cut(m[1]);
  if ((m = t.match(/^vid[ée]os?\s+(.+)$/))) return "!v " + cut(m[1]);
  if ((m = t.match(/^(.+?)\s+en\s+vid[ée]os?$/))) return "!v " + m[1];
  if ((m = t.match(/^images?\s+(.+)$/))) return "!i " + cut(m[1]);
  if ((m = t.match(/^(?:actualit[ée]s?|actus?|infos?)\s+(.+)$/))) return "!n " + cut(m[1]);
  if ((m = t.match(/^google\s+(.+)$/))) return "!g " + cut(m[1]);
  if ((m = t.match(/^(?:duckduckgo|duck duck go)\s+(.+)$/))) return "!d " + cut(m[1]);
  return t;
}

export function initVoice({ input, form }) {
  const barIn = form.querySelector(".bar-in"), go = document.getElementById("go");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "mic"; btn.setAttribute("aria-label", "Recherche vocale"); btn.title = "Recherche vocale";
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  barIn.insertBefore(btn, barIn.querySelector(".engine"));
  const apply = () => { btn.hidden = !prefs.on("voix"); };
  apply();
  let rec = null, listening = false;

  const isBrave = async () => { try { return !!(navigator.brave && await navigator.brave.isBrave()); } catch (e) { return false; } };
  async function help(why) {
    const brave = await isBrave(), url = location.href.split("#")[0], android = /android/i.test(navigator.userAgent), ios = /iphone|ipad/i.test(navigator.userAgent);
    go.innerHTML = "";
    const box = document.createElement("div"); box.className = "vhelp";
    const p = document.createElement("p");
    p.textContent = why === "denied" ? "Le micro est refusé : autorise-le pour ce site (cadenas de la barre d'adresse)."
      : brave ? "Brave bloque la reconnaissance vocale (protection de la vie privée). Le hub peut s'ouvrir dans Chrome, où la voix marche."
      : "La reconnaissance vocale n'est pas disponible dans ce navigateur. Elle marche dans Chrome, Edge et sur Android.";
    box.append(p);
    if (why !== "denied") {
      const row = document.createElement("div"); row.className = "erow";
      const a = document.createElement("a"); a.className = "btn"; a.target = "_blank"; a.rel = "noopener";
      if (android) { a.textContent = "Ouvrir le hub dans Chrome ↗"; a.href = "intent://" + url.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end"; }
      else if (ios) { a.textContent = "Ouvrir le hub dans Chrome ↗"; a.href = "googlechrome://" + url.replace(/^https?:\/\//, ""); }
      else { a.textContent = "Chrome ↗"; a.href = "https://www.google.com/chrome/"; }
      row.append(a);
      if (!android && !ios) {
        const c = document.createElement("button"); c.type = "button"; c.className = "btn"; c.textContent = "Copier le lien du hub";
        c.addEventListener("click", async () => { try { await navigator.clipboard.writeText(url); c.textContent = "Copié : colle-le dans Chrome"; } catch (e) { c.textContent = url; } });
        row.append(c);
      }
      box.append(row);
    }
    go.append(box);
  }
  function stop() { listening = false; btn.setAttribute("aria-pressed", "false"); btn.classList.remove("on"); try { rec && rec.stop(); } catch (e) { /* déjà arrêtée */ } }

  btn.addEventListener("click", () => {
    if (listening) { stop(); return; }
    if (!SR) { help("none"); return; }
    rec = new SR(); rec.lang = "fr-FR"; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    let last = "", failed = false;
    rec.onstart = () => { listening = true; btn.setAttribute("aria-pressed", "true"); btn.classList.add("on"); go.textContent = "Je t'écoute… (ex. « youtube chats drôles », « vidéo de crêpes »)"; pulse(0.8); };
    rec.onresult = (e) => {
      let txt = ""; for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      last = txt; input.value = voiceToQuery(txt); input.dispatchEvent(new Event("input"));
      if (e.results[e.results.length - 1].isFinal) { stop(); form.requestSubmit(); }
    };
    rec.onerror = (e) => {
      failed = true; stop();
      if (e.error === "no-speech") go.textContent = "Je n'ai rien entendu. Réessaie.";
      else if (e.error === "aborted") failed = false;
      else if (e.error === "not-allowed") help("denied");
      else help("none");          // « network » / « service-not-allowed » : le cas de Brave
    };
    rec.onend = () => { if (listening) stop(); if (!failed && !last && go.textContent.startsWith("Je t'écoute")) go.textContent = ""; };
    try { rec.start(); } catch (e) { help("none"); }
  });
  // Touche V dans la barre de recherche vide : lancer la voix au clavier
  addEventListener("keydown", (e) => { if (e.altKey && e.key.toLowerCase() === "v") { e.preventDefault(); btn.click(); } });
  return { apply, button: btn };
}
