// Charge Three.js (copie locale figée, r147) et ses passes de post-traitement, dans l'ordre.
// Ces fichiers sont des scripts classiques qui posent `THREE` sur window.
const FILES = [
  "vendor/three/three.min.js",
  "vendor/three/examples/shaders/CopyShader.js",
  "vendor/three/examples/shaders/LuminosityHighPassShader.js",
  "vendor/three/examples/postprocessing/EffectComposer.js",
  "vendor/three/examples/postprocessing/RenderPass.js",
  "vendor/three/examples/postprocessing/ShaderPass.js",
  "vendor/three/examples/postprocessing/UnrealBloomPass.js"
];

function load(src) {
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = new URL("../../" + src, import.meta.url).href;
    s.onload = ok; s.onerror = () => ko(new Error("Chargement impossible : " + src));
    document.head.append(s);
  });
}

export async function loadThree() {
  for (const f of FILES) await load(f);      // l'ordre compte : chaque fichier complète le précédent
  const T = window.THREE;
  if (!T || !T.EffectComposer || !T.UnrealBloomPass || !T.ShaderPass) throw new Error("La bibliothèque 3D est incomplète.");
  return T;
}
