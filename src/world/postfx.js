// ---------------------------------------------------------------------------
// postfx.js - the "camera lens" effects for Medium and High quality:
//   * light bloom (bright things glow softly)
//   * a film-like color grade
//   * High only: dark corners (vignette) and film grain
//
// How: the 3D scene is first drawn into a hidden picture that can store very
// bright values (HDR). Small blurred copies of the bright parts make the
// bloom. A last pass mixes everything, applies the ACES tone mapping set on
// the renderer, and draws to the screen.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

// One big triangle that covers the whole screen (cheaper than two triangles).
const fsGeo = new THREE.BufferGeometry();
fsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
fsGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
const FS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }`;

function pass(fragmentShader, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FS_VERTEX, fragmentShader, uniforms,
    depthTest: false, depthWrite: false, toneMapped: false, ...extra,
  });
}

export function createPostFX(renderer) {
  // HDR pictures need this GPU feature. Almost every phone has it.
  const supported = renderer.capabilities.isWebGL2 &&
    (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));

  const fsScene = new THREE.Scene();
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(fsGeo, null);
  quad.frustumCulled = false;
  fsScene.add(quad);

  const LEVELS = 5;
  let sceneRT = null;
  const bloomRT = [];
  let width = 0, height = 0, samples = -1;

  // ---- 1. keep only the bright parts, at half size ----
  const prefilter = pass(/* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uTexel;
    uniform float uThreshold;
    varying vec2 vUv;
    void main() {
      // 4 samples = small blur; very bright single pixels count less (no flicker)
      vec3 a = texture2D( tMap, vUv + uTexel * vec2( -1.0, -1.0 ) ).rgb;
      vec3 b = texture2D( tMap, vUv + uTexel * vec2(  1.0, -1.0 ) ).rgb;
      vec3 c = texture2D( tMap, vUv + uTexel * vec2( -1.0,  1.0 ) ).rgb;
      vec3 d = texture2D( tMap, vUv + uTexel * vec2(  1.0,  1.0 ) ).rgb;
      float wa = 1.0 / ( 1.0 + max( a.r, max( a.g, a.b ) ) );
      float wb = 1.0 / ( 1.0 + max( b.r, max( b.g, b.b ) ) );
      float wc = 1.0 / ( 1.0 + max( c.r, max( c.g, c.b ) ) );
      float wd = 1.0 / ( 1.0 + max( d.r, max( d.g, d.b ) ) );
      vec3 col = ( a * wa + b * wb + c * wc + d * wd ) / ( wa + wb + wc + wd );
      float br = max( col.r, max( col.g, col.b ) );
      float keep = max( 0.0, br - uThreshold ) / max( br, 1e-4 );
      gl_FragColor = vec4( min( col * keep, vec3( 40.0 ) ), 1.0 );
    }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 } });

  // ---- 2. shrink (blur while making it smaller) ----
  const down = pass(/* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      vec3 s = texture2D( tMap, vUv ).rgb * 4.0;
      s += texture2D( tMap, vUv - uTexel ).rgb;
      s += texture2D( tMap, vUv + uTexel ).rgb;
      s += texture2D( tMap, vUv + vec2( uTexel.x, - uTexel.y ) ).rgb;
      s += texture2D( tMap, vUv - vec2( uTexel.x, - uTexel.y ) ).rgb;
      gl_FragColor = vec4( s / 8.0, 1.0 );
    }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });

  // ---- 3. grow back (blur more) and add to the next bigger picture ----
  const up = pass(/* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      vec3 s = texture2D( tMap, vUv + vec2( - uTexel.x * 2.0, 0.0 ) ).rgb;
      s += texture2D( tMap, vUv + vec2( - uTexel.x, uTexel.y ) ).rgb * 2.0;
      s += texture2D( tMap, vUv + vec2( 0.0, uTexel.y * 2.0 ) ).rgb;
      s += texture2D( tMap, vUv + vec2( uTexel.x, uTexel.y ) ).rgb * 2.0;
      s += texture2D( tMap, vUv + vec2( uTexel.x * 2.0, 0.0 ) ).rgb;
      s += texture2D( tMap, vUv + vec2( uTexel.x, - uTexel.y ) ).rgb * 2.0;
      s += texture2D( tMap, vUv + vec2( 0.0, - uTexel.y * 2.0 ) ).rgb;
      s += texture2D( tMap, vUv + vec2( - uTexel.x, - uTexel.y ) ).rgb * 2.0;
      gl_FragColor = vec4( s / 12.0, 1.0 );
    }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } },
    { blending: THREE.AdditiveBlending, transparent: true });

  // ---- 4. final picture: scene + bloom, tone mapping, film look ----
  const finalUniforms = {
    tScene: { value: null }, tBloom: { value: null },
    uBloom: { value: 0.14 },
    uTime: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const final = pass(/* glsl */ `
    uniform sampler2D tScene;
    uniform sampler2D tBloom;
    uniform float uBloom;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
    void main() {
      vec3 col = texture2D( tScene, vUv ).rgb;
      col += texture2D( tBloom, vUv ).rgb * uBloom;
      // darker corners, like a real lens (done before tone mapping = natural falloff)
      vec2 q = vUv - 0.5;
      col *= 1.0 - uVignette * smoothstep( 0.12, 0.75, dot( q, q ) * 2.0 );
      // ACES tone mapping + exposure, exactly as set on the renderer
      #ifdef TONE_MAPPING
        col = toneMapping( col );
      #endif
      col = clamp( col, 0.0, 1.0 );
      // ---- film-like grade ----
      float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      // a little more contrast in the mid tones
      col = mix( col, col * col * ( 3.0 - 2.0 * col ), 0.16 );
      // cool shadows, warm highlights
      col += vec3( - 0.010, 0.002, 0.016 ) * ( 1.0 - l ) * ( 1.0 - l ) + vec3( 0.014, 0.004, - 0.012 ) * l * l;
      // slightly muted colors
      col = mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, 0.93 );
      // film never reaches pure black
      col = col * 0.985 + 0.006;
      gl_FragColor = linearToOutputTexel( vec4( clamp( col, 0.0, 1.0 ), 1.0 ) );
      // film grain, a bit stronger in the shadows
      float n = hash( vUv * uRes + fract( uTime ) * 61.7 ) - 0.5;
      gl_FragColor.rgb += n * uGrain * ( 1.25 - l );
    }`, finalUniforms, { toneMapped: true });

  function resize(w, h, msaa) {
    w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
    if (w === width && h === height && msaa === samples) return;
    width = w; height = h; samples = msaa;
    if (sceneRT) sceneRT.dispose();
    for (const rt of bloomRT) rt.dispose();
    bloomRT.length = 0;
    sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: msaa, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    let bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
    for (let i = 0; i < LEVELS; i++) {
      bloomRT.push(new THREE.WebGLRenderTarget(bw, bh, {
        type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      }));
      bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1);
    }
    finalUniforms.uRes.value.set(w, h);
  }

  function runPass(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(fsScene, fsCam);
  }

  // Draw one frame with all effects.
  function render(scene, camera, time) {
    renderer.autoClear = true;
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);

    // bloom: threshold follows the exposure, so "bright" means bright on screen
    prefilter.uniforms.tMap.value = sceneRT.texture;
    prefilter.uniforms.uTexel.value.set(0.5 / width, 0.5 / height);
    prefilter.uniforms.uThreshold.value = 0.92 / renderer.toneMappingExposure;
    runPass(prefilter, bloomRT[0]);
    for (let i = 1; i < LEVELS; i++) {
      down.uniforms.tMap.value = bloomRT[i - 1].texture;
      down.uniforms.uTexel.value.set(0.5 / bloomRT[i - 1].width, 0.5 / bloomRT[i - 1].height);
      runPass(down, bloomRT[i]);
    }
    renderer.autoClear = false; // the next passes ADD light to what is already there
    for (let i = LEVELS - 1; i > 0; i--) {
      up.uniforms.tMap.value = bloomRT[i].texture;
      up.uniforms.uTexel.value.set(0.5 / bloomRT[i].width, 0.5 / bloomRT[i].height);
      runPass(up, bloomRT[i - 1]);
    }
    renderer.autoClear = true;

    finalUniforms.tScene.value = sceneRT.texture;
    finalUniforms.tBloom.value = bloomRT[0].texture;
    finalUniforms.uTime.value = time;
    runPass(final, null);
  }

  function setQuality(q) {
    finalUniforms.uVignette.value = q.vignette ? 0.34 : 0;
    finalUniforms.uGrain.value = q.grain ? 0.03 : 0;
  }

  return { supported, resize, render, setQuality };
}
