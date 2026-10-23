// Images libres (2.9, repris de la v8, PC) : glisser une image sur le hub, la coller (Ctrl+V) ou la choisir (clic droit sur le fond).
// Déplacer, redimensionner (Maj = sans garder les proportions), effet hologramme, opacité, devant / derrière les fenêtres, figer.
// 12 images au maximum, réduites à 1600 px et stockées sur l'appareil (collection images, incluses dans l'export).
import { store, newId } from "../store/storage.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { state, pulse } from "../state.js";

const C = "images", MAX = 12, MAXSIDE = 1600;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, MAXSIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res({ blob: b, w: c.width, h: c.height }) : rej(new Error("encodage"))), "image/webp", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("lecture")); };
    img.src = url;
  });
}

export function initImages({ world, plans, force, wins }) {
  if (state.lite) return {};
  const anchor = document.getElementById("anchor");
  const P = [];                    // images affichées : { d (données), el, url, cx, cy, rz, vx, drag }
  let W = innerWidth, H = innerHeight;
  const toWorld = (x, y) => { const c = wins.core, z = plans.zoom; return { x: c.x + (x - c.x) / z, y: c.y + (y - c.y) / z }; };

  const save = (p) => store.put(C, p.d);
  function size(p) { p.el.style.width = p.d.w + "px"; p.el.style.height = p.d.h + "px"; }
  function look(p, restack) { p.el.classList.toggle("holo", !!p.d.holo); p.el.classList.toggle("pinned", !!p.d.pin); p.el.style.opacity = p.d.op; if (restack || p.d.back) p.el.style.zIndex = p.d.back ? 0 : wins.nextZ(); }

  function make(d) {
    const el = document.createElement("div"); el.className = "pic pc-only"; el.dataset.menu = "pic"; el.dataset.id = d.id;
    const img = document.createElement("img"); img.alt = ""; img.draggable = false;
    const url = URL.createObjectURL(d.blob); img.src = url;
    el.append(img); el.insertAdjacentHTML("beforeend", '<span class="fr"></span><span class="grip" aria-hidden="true"></span>');
    const p = { d, el, url, cx: d.x * W, cy: d.y * H, rz: 0, vx: 0, drag: false };
    world.insertBefore(el, anchor.nextSibling);
    size(p); look(p, true); bind(p); P.push(p);
    return p;
  }

  function bind(p) {
    const el = p.el, grip = el.querySelector(".grip");
    let mode = null, sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0, lastX = 0;
    const start = (e, m) => {
      if (e.button !== 0) return; e.stopPropagation();
      if (p.d.pin) { toast("Image figée : clic droit pour la libérer"); return; }
      mode = m; sx = e.clientX; sy = e.clientY; ox = p.d.x * W; oy = p.d.y * H; ow = p.d.w; oh = p.d.h; lastX = e.clientX;
      p.drag = m === "move"; force.setDrag(el); if (!p.d.back) el.style.zIndex = wins.nextZ();
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
    };
    const move = (e) => {
      if (!mode) return;
      const z = plans.zoom, dx = (e.clientX - sx) / z, dy = (e.clientY - sy) / z;
      if (mode === "move") { p.d.x = (ox + dx) / W; p.d.y = (oy + dy) / H; p.vx = e.clientX - lastX; lastX = e.clientX; }
      else { p.d.w = Math.max(60, ow + dx); p.d.h = e.shiftKey ? Math.max(40, oh + dy) : p.d.w / p.d.ratio; size(p); }
    };
    const end = () => { if (!mode) return; mode = null; p.drag = false; p.vx = 0; force.setDrag(null); save(p); };
    el.addEventListener("pointerdown", (e) => { if (e.target !== grip) start(e, "move"); });
    grip.addEventListener("pointerdown", (e) => start(e, "size"));
    [el, grip].forEach((h) => { h.addEventListener("pointermove", move); h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end); });
    el.addEventListener("dblclick", (e) => { e.stopPropagation(); if (plans.plan !== 1) plans.goPlan(1); });
  }

  async function add(files, at) {
    const imgs = [...files].filter((f) => f.type && f.type.startsWith("image/"));
    if (!imgs.length) { toast("Ce fichier n'est pas une image"); return; }
    const pt = at || { x: wins.core.x, y: wins.core.y };
    let n = 0;
    for (const f of imgs) {
      if (P.length >= MAX) { toast("Maximum " + MAX + " images, pour garder le hub fluide"); break; }
      try {
        const r = await shrink(f), w = Math.min(360, r.w), h = w * r.h / r.w;
        const d = { id: newId("i"), x: (pt.x - w / 2 + n * 26) / W, y: (pt.y - h / 2 + n * 26) / H, w, h, ratio: r.w / r.h, nw: r.w, holo: false, op: 1, pin: false, back: false, created: Date.now(), blob: r.blob };
        const p = make(d); p.cx = d.x * W; p.cy = d.y * H; n++;
        await store.put(C, d);
      } catch (e) { toast("Cette image n'a pas pu être lue"); }
    }
    if (n) { pulse(1); toast(n + " image" + (n > 1 ? "s" : "") + " ajoutée" + (n > 1 ? "s" : "") + " · clic droit dessus pour les effets"); }
  }
  function remove(p) {
    P.splice(P.indexOf(p), 1); p.el.remove(); URL.revokeObjectURL(p.url); store.del(C, p.d.id);
    toast("Image supprimée", { action: { label: "Annuler", fn: async () => { await store.put(C, p.d); make(p.d); } } });
  }

  // Ajout : glisser-déposer, coller, choisir un fichier
  const pick = document.createElement("input"); pick.type = "file"; pick.accept = "image/*"; pick.multiple = true; pick.hidden = true; document.body.append(pick);
  let pickAt = null;
  pick.addEventListener("change", () => { if (pick.files.length) add(pick.files, pickAt); pick.value = ""; });
  const drop = document.createElement("div"); drop.className = "dropzone pc-only"; drop.hidden = true; drop.textContent = "LÂCHE L'IMAGE ICI"; document.body.append(drop);
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; depth++; drop.hidden = false; });
  addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) drop.hidden = true; });
  addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener("drop", (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; drop.hidden = true; add(e.dataTransfer.files, toWorld(e.clientX, e.clientY)); });
  let mx = innerWidth / 2, my = innerHeight / 2;
  addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  addEventListener("paste", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable='true']")) return;
    const files = e.clipboardData ? [...e.clipboardData.files] : [];
    if (files.length) { e.preventDefault(); add(files, toWorld(mx, my)); }
  });

  // Menu de l'image
  const nextOp = (o) => (o > 0.9 ? 0.7 : o > 0.5 ? 0.4 : 1);
  registerMenu("pic", (el) => {
    const p = P.find((q) => q.el === el); if (!p) return [];
    const d = p.d, ch = (fn) => () => { fn(); look(p, true); save(p); };
    return [{ h: "Image" },
      { t: d.holo ? "Retirer l'effet hologramme" : "Effet hologramme", fn: ch(() => { d.holo = !d.holo; }) },
      { t: "Opacité " + Math.round(d.op * 100) + " % → " + Math.round(nextOp(d.op) * 100) + " %", fn: ch(() => { d.op = nextOp(d.op); }) },
      { t: d.pin ? "Libérer l'image" : "Figer l'image", fn: ch(() => { d.pin = !d.pin; }) },
      { t: d.back ? "Mettre devant les fenêtres" : "Mettre derrière les fenêtres", fn: ch(() => { d.back = !d.back; }) },
      { t: "Taille d'origine", fn: () => { d.w = Math.min(d.nw, 900); d.h = d.w / d.ratio; size(p); save(p); } },
      "-", { t: "Supprimer l'image", fn: () => remove(p) }];
  });
  registerMenu("fond", (t, x, y) => [{ t: "Ajouter une image ici", k: "Ctrl+V", fn: () => { pickAt = toWorld(x, y); pick.click(); } }]);

  function update(dt) {
    W = wins.size.W; H = wins.size.H;
    const kPos = state.reduce ? 1 : 1 - Math.exp(-dt * 16), kRot = state.reduce ? 1 : 1 - Math.exp(-dt * 8);
    for (const p of P) {
      const tx = p.d.x * W, ty = p.d.y * H;
      p.cx += (tx - p.cx) * kPos; p.cy += (ty - p.cy) * kPos;
      p.rz += ((p.drag && !state.reduce ? clamp(p.vx * 0.12, -3, 3) : 0) - p.rz) * kRot; p.vx *= 0.85;
      const tf = `translate3d(${p.cx.toFixed(1)}px, ${p.cy.toFixed(1)}px, 0) rotate(${p.rz.toFixed(2)}deg) scale(${p.drag ? 1.02 : 1})`;
      if (tf !== p.last) { p.last = tf; p.el.style.transform = tf; }
    }
  }

  // Chargement, et mise à jour si un autre onglet (ou un import) change les images
  async function load() {
    const list = (await store.all(C)).filter((d) => d.blob instanceof Blob).sort((a, b) => a.created - b.created);
    const ids = new Set(list.map((d) => d.id));
    P.slice().forEach((p) => { if (!ids.has(p.d.id)) { P.splice(P.indexOf(p), 1); p.el.remove(); URL.revokeObjectURL(p.url); } });
    list.forEach((d) => { const p = P.find((q) => q.d.id === d.id); if (!p) make(d); else if (!p.drag) { Object.assign(p.d, d, { blob: p.d.blob }); size(p); look(p); } });
  }
  store.on(C, () => { if (!P.some((p) => p.drag)) load(); });
  load();
  return { update, add };
}
