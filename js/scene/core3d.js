// Scène 3D du Hub : noyau, anneaux, cadran, constellation, faisceau, sol, colonnes, poussière.
// Reprise fidèle de la maquette v8 ; la scène ne connaît ni la page ni la souris : main.js lui passe l'état.

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

export function createCore(THREE, { lite = false } = {}) {
  const C = { cyan: new THREE.Color(0x3fe6ff), violet: new THREE.Color(0x9b72ff), amber: new THREE.Color(0xffb347) };
  const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02060d);
  scene.fog = new THREE.FogExp2(0x02060d, 0.045);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
  camera.position.set(0, 0.6, 9);

  const dotTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"); const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,.8)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();

  /* ---------- Noyau ---------- */
  const coreG = new THREE.Group(); scene.add(coreG);
  const spin = new THREE.Group(); coreG.add(spin);
  const shellMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C.cyan.clone() }, uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uPower; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
        float scan = 0.7 + 0.3 * sin(vP.y * 42.0 - uTime * 2.6);
        float band = smoothstep(0.06, 0.0, abs(fract(vP.y * 0.5 - uTime * 0.18) - 0.5)) * 0.6;
        float a = (f * scan + band * f * 2.0) * uPower; gl_FragColor = vec4(uColor * a * 1.5, a); }`,
    ...ADD
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.05, 64, 48), shellMat); spin.add(shell);
  const geo = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.82, 1)), new THREE.LineBasicMaterial({ color: C.cyan, opacity: 0.32, ...ADD })); spin.add(geo);
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), new THREE.MeshBasicMaterial({ color: 0xbff8ff })); coreG.add(heart);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: C.cyan, opacity: 0.55, ...ADD })); halo.scale.set(2.4, 2.4, 1); coreG.add(halo);

  /* ---------- Anneaux, plateau, arc, cadran ---------- */
  const rings = [];
  function ring(r, color, thick, tilt, speed) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, thick, 6, 240), new THREE.MeshBasicMaterial({ color, opacity: 0.9, ...ADD }));
    const g = new THREE.Group(); g.rotation.set(tilt[0], tilt[1], tilt[2]); g.add(m);
    const sat = new THREE.Mesh(new THREE.SphereGeometry(Math.max(thick * 5, 0.03), 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); sat.position.x = r; m.add(sat);
    spin.add(g); rings.push({ m, speed });
  }
  ring(1.45, C.cyan, 0.01, [Math.PI / 2.15, 0, 0.1], 0.35);
  ring(1.78, C.violet, 0.007, [Math.PI / 2.6, 0.5, -0.35], -0.22);
  ring(2.05, C.cyan, 0.005, [Math.PI / 1.8, -0.6, 0.5], 0.15);
  const plate = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.62, 160, 1), new THREE.MeshBasicMaterial({ color: C.cyan, opacity: 0.18, side: THREE.DoubleSide, ...ADD }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = -0.15; coreG.add(plate);
  const arcPts = []; for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 1.35; arcPts.push(Math.cos(a) * 2.53, 0, Math.sin(a) * 2.53); }
  const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(arcPts, 3));
  const arc = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: C.amber, size: 0.06, map: dotTex, ...ADD })); arc.position.y = -0.15; coreG.add(arc);
  const tickPts = []; for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r1 = 1.18, r2 = i % 10 === 0 ? 1.32 : 1.24; tickPts.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(tickPts, 3));
  const ticks = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: C.cyan, opacity: 0.5, ...ADD }));
  const dial = new THREE.Group(); dial.add(ticks); coreG.add(dial);

  /* ---------- Faisceau et sol ---------- */
  const floorY = -2.7;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C.cyan.clone() }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = 1.0 - abs(dot(vN, vV)); float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float flick = 0.85 + 0.15 * sin(vUv.y * 30.0 - uTime * 4.0); float a = (0.08 + 0.35 * pow(edge, 2.0)) * fade * flick; gl_FragColor = vec4(uColor * a, a); }`,
    side: THREE.DoubleSide, ...ADD
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.5, 2.4, 48, 1, true), beamMat); beam.position.y = floorY + 1.2; scene.add(beam);
  const grid = new THREE.GridHelper(80, 80, 0x3fe6ff, 0x3fe6ff); grid.material.transparent = true; grid.material.opacity = 0.12; grid.material.depthWrite = false; grid.position.y = floorY; scene.add(grid);
  const polar = new THREE.PolarGridHelper(3.4, 24, 6, 96, 0x3fe6ff, 0x3fe6ff); polar.material.transparent = true; polar.material.opacity = 0.32; polar.material.blending = THREE.AdditiveBlending; polar.material.depthWrite = false; polar.position.y = floorY + 0.01; scene.add(polar);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ map: dotTex, color: C.cyan, opacity: 0.45, ...ADD })); pool.rotation.x = -Math.PI / 2; pool.position.y = floorY + 0.02; scene.add(pool);

  /* ---------- Colonnes de données, constellation, poussière ---------- */
  let pillars = null, pillarData = [];
  const dummy = new THREE.Object3D();
  function buildPillars(n) {
    if (pillars) { scene.remove(pillars); pillars.geometry.dispose(); pillars.material.dispose(); }
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    pillars = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.22, ...ADD }), n);
    pillarData = []; const cols = [C.cyan, C.cyan, C.cyan, C.violet, C.amber];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 14;
      const d = { x: Math.cos(a) * r, z: Math.sin(a) * r - 4, w: 0.15 + Math.random() * 0.5, h: 0.5 + Math.random() * 5, ph: Math.random() * 6, sp: 0.3 + Math.random() * 1.2 };
      if (d.z > 3) d.z -= 10;
      pillarData.push(d); pillars.setColorAt(i, cols[(Math.random() * cols.length) | 0]);
    }
    scene.add(pillars);
  }
  function updatePillars(t, e) {
    pillarData.forEach((d, i) => { dummy.position.set(d.x, floorY, d.z); dummy.scale.set(d.w, d.h * (0.6 + 0.4 * Math.sin(t * d.sp + d.ph)) * (1 + e * 0.4), d.w); dummy.updateMatrix(); pillars.setMatrixAt(i, dummy.matrix); });
    pillars.instanceMatrix.needsUpdate = true;
  }
  let constel = null;
  function buildConstellation(n) {
    if (constel) { spin.remove(constel); constel.children.forEach((o) => { o.geometry.dispose(); o.material.dispose(); }); }
    constel = new THREE.Group(); const pts = [];
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 2.8 + Math.random() * 1.4, s = Math.sqrt(1 - u * u); pts.push(new THREE.Vector3(Math.cos(t) * s * r, u * r * 0.5, Math.sin(t) * s * r)); }
    const pos = [], lines = [];
    pts.forEach((p, i) => { pos.push(p.x, p.y, p.z); let k = 0; for (let j = i + 1; j < pts.length && k < 2; j++) if (p.distanceTo(pts[j]) < 1.0) { lines.push(p.x, p.y, p.z, pts[j].x, pts[j].y, pts[j].z); k++; } });
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    constel.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9fefff, size: 0.07, map: dotTex, ...ADD })));
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    constel.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: C.cyan, opacity: 0.16, ...ADD })));
    spin.add(constel);
  }
  let dust = null, dustSpeed = null;
  function buildDust(n) {
    if (dust) { scene.remove(dust); dust.geometry.dispose(); dust.material.dispose(); }
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); dustSpeed = new Float32Array(n);
    const pal = [C.cyan, C.cyan, C.cyan, C.violet, C.amber];
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 14 - 4; pos[i * 3 + 2] = Math.random() * -24 + 6; const c = pal[(Math.random() * pal.length) | 0]; col.set([c.r, c.g, c.b], i * 3); dustSpeed[i] = 0.08 + Math.random() * 0.25; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, map: dotTex, vertexColors: true, opacity: 0.75, ...ADD })); scene.add(dust);
  }

  /** (Re)construit les éléments dont la quantité dépend du mode : PC complet ou mobile allégé. */
  function build(isLite) {
    buildConstellation(isLite ? 70 : 180); buildDust(isLite ? 450 : 2800); buildPillars(isLite ? 40 : 140);
  }
  build(lite);

  /* ---------- Cadrage : place le noyau dans un rectangle d'écran ---------- */
  let camZ = 9, lastKey = "";
  /** rect = { left, top, width, height } en pixels. Retourne le centre du noyau à l'écran (0..1) si le cadrage a changé, sinon null. */
  function frame(rect, RW, RH) {
    const hc = Math.max(rect.height, 60), wc = Math.max(rect.width, 60);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const key = [RW, RH, cx.toFixed(1), cy.toFixed(1), hc.toFixed(1), wc.toFixed(1)].join();
    if (key === lastKey) return null; lastKey = key;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), span = 5.4;
    const zH = span * RH / (hc * 2 * tanH * 0.92), zW = span * RW / (wc * 2 * tanH * camera.aspect * 0.92);
    camZ = clamp(Math.max(zH, zW), 6.5, 70);
    scene.fog.density = 0.045 * 9 / Math.max(camZ, 9);
    camera.setViewOffset(RW, RH, RW / 2 - cx, RH / 2 - cy, RW, RH);
    return { x: cx / RW, y: 1 - cy / RH };
  }
  function resize(RW, RH) { camera.aspect = RW / RH; camera.updateProjectionMatrix(); lastKey = ""; }

  /* ---------- Animation ---------- */
  const camPos = new THREE.Vector3(), tmpCol = new THREE.Color();
  /** s = { t, dt, k, energy, accent (couleur ou null), cine, mx, my } */
  function update(s) {
    const { t, dt, k, energy: e, accent, cine, mx, my, tilt } = s;
    spin.rotation.y += dt * k * (0.12 + e * 0.5);
    shellMat.uniforms.uTime.value = t; beamMat.uniforms.uTime.value = t;
    shellMat.uniforms.uPower.value = 1 + e * 0.9;
    if (accent !== null) tmpCol.set(accent); else tmpCol.copy(C.cyan);
    shellMat.uniforms.uColor.value.lerp(tmpCol, Math.min(dt * 2.5, 1));
    halo.material.color.copy(shellMat.uniforms.uColor.value);
    beamMat.uniforms.uColor.value.copy(shellMat.uniforms.uColor.value);
    shell.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04 + e * 0.08);
    heart.scale.setScalar(1 + Math.sin(t * 3.2) * 0.12 + e * 0.5);
    halo.scale.setScalar(2.4 + Math.sin(t * 1.6) * 0.15 + e * 0.9);
    geo.rotation.x += dt * k * 0.15; geo.rotation.z -= dt * k * 0.08;
    ticks.rotation.z -= dt * k * (0.1 + e * 0.6); dial.lookAt(camera.position);
    rings.forEach((r) => { r.m.rotation.z += dt * k * r.speed * (1 + e * 2.5); });
    arc.rotation.y -= dt * k * 0.25; plate.rotation.z += dt * k * 0.05;
    constel.rotation.y -= dt * k * 0.05; polar.rotation.y += dt * k * 0.05;
    updatePillars(t, e);
    const p = dust.geometry.attributes.position.array;
    for (let i = 0; i < dustSpeed.length; i++) { p[i * 3 + 1] += dustSpeed[i] * dt * k; if (p[i * 3 + 1] > 10) p[i * 3 + 1] = -4; }
    dust.geometry.attributes.position.needsUpdate = true;

    const sway = Math.sin(t * 0.12) * 0.6;
    // Mobile : inclinaison du téléphone si disponible, sinon balancement lent
    const ax = lite && !tilt ? Math.sin(t * 0.25) * 0.4 : mx * 1.1 + sway;
    const ay = lite && !tilt ? Math.cos(t * 0.2) * 0.15 : -my * 0.5;
    camPos.set(ax, 0.7 + ay + cine * 1.6, camZ);
    camera.position.lerp(camPos, Math.min(dt * 2, 1));
    camera.lookAt(0, 0, 0);
  }

  return { scene, camera, build, frame, resize, update };
}
