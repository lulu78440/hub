// Post-traitement : halo lumineux (bloom), puis aberration chromatique, vignette et grain en une seule passe.
export function createPostFX(THREE, renderer, scene, camera, { lite = false } = {}) {
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 1.25, 0.6, 0.0); composer.addPass(bloom);
  const film = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 0.035 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmt; uniform vec2 uCenter; varying vec2 vUv;
      float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ vec2 d = vUv - uCenter; float r2 = dot(d, d); vec2 o = d * uAmt * r2 * 4.0;
        vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
        float v = smoothstep(1.05, 0.25, length((vUv - 0.5) * vec2(1.0, 1.2))); c *= mix(0.25, 1.0, v);
        c += (rnd(vUv * 900.0 + fract(uTime)) - 0.5) * 0.05; gl_FragColor = vec4(c, 1.0); }`
  });
  composer.addPass(film);

  function resize(RW, RH, dpr) {
    renderer.setPixelRatio(dpr); renderer.setSize(RW, RH, false);
    composer.setPixelRatio(dpr); composer.setSize(RW, RH);
    bloom.resolution.set(RW * (lite ? 0.5 : 1), RH * (lite ? 0.5 : 1));
  }
  function setCenter(c) { film.uniforms.uCenter.value.set(c.x, c.y); }
  function update(t, e, cine) {
    bloom.strength = (lite ? 1.0 : 1.25) + e * 0.4 + cine * 0.3;
    film.uniforms.uTime.value = t; film.uniforms.uAmt.value = 0.035 + cine * 0.05;
  }
  return { composer, resize, setCenter, update, render: () => composer.render() };
}
