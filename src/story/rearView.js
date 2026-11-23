// THE REAR-VIEW MIRROR of a film shot (Chapter 6, "Leave": behind the van, Mace in the lit door of the garage, getting
// smaller as Nate drives away).
// A second, small picture of the world, seen from a camera at the back of the car looking back, shown mirrored (left
// and right change places) in a rounded mirror at the top of the screen, under the film bar. It is only made while a
// film shot asks for it: one more picture of the city costs time on a phone, so it is small and made every second frame.
//   const mirror = createRearView({ renderer, scene, camera });
//   mirror.set(car, { x }) ... mirror.set(null)    (the story step "rearView"; x: where across the top, -1 left .. 1 right)
//   mirror.render(dt)                             (every frame, just before the picture of the game is drawn)
import * as THREE from 'three';

const W = 480, H = 160;                 // the mirror's own picture, in pixels

const MIRROR_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const MIRROR_FS = `
uniform sampler2D map; uniform vec2 uSize; uniform float uFade;
varying vec2 vUv;
// a box with round corners: below 0 inside, above 0 outside
float rbox( vec2 p, vec2 b, float r ) { vec2 q = abs( p ) - b + r; return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r; }
void main() {
  vec2 p = ( vUv - 0.5 ) * uSize;
  float d = rbox( p, uSize * 0.5, uSize.y * 0.2 );
  if ( d > 0.0 ) discard;
  // the picture, mirrored; a mirror gives back a little less light, and a little less again near its edge
  vec3 c = texture2D( map, vec2( 1.0 - vUv.x, vUv.y ) ).rgb * 0.88;
  c *= 1.0 - 0.3 * smoothstep( -uSize.y * 0.3, 0.0, d );
  // a thin dark frame, with a faint line of light along its top
  float frame = smoothstep( -uSize.y * 0.075, -uSize.y * 0.055, d );
  vec3 rim = vec3( 0.016 ) + vec3( 0.045 ) * smoothstep( 0.25, 0.5, vUv.y - 0.5 );
  c = mix( c, rim, frame );
  gl_FragColor = vec4( c, uFade );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createRearView({ renderer, scene, camera }) {
  let rt = null, cam = null, quad = null, car = null, fade = 0, frame = 0, across = 0;
  // (made the first time it is used: most games never need it)
  function build() {
    rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    cam = new THREE.PerspectiveCamera(34, W / H, 0.4, 600);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: rt.texture }, uSize: { value: new THREE.Vector2(W / H, 1) }, uFade: { value: 0 } },
      vertexShader: MIRROR_VS, fragmentShader: MIRROR_FS, transparent: true, depthTest: false, depthWrite: false,
    });
    quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    quad.renderOrder = 40; quad.frustumCulled = false; quad.visible = false;
    camera.add(quad);
  }

  // where the mirror's camera is: just behind the car, at a driver's eye height, looking back along the road
  function placeCamera() {
    const x = car.rx ?? car.x, z = car.rz ?? car.z, h = car.rh ?? car.heading, y = car.ry ?? car.y;
    const back = (car.info && car.info.backZ) || -2.4;
    const s = Math.sin(h), c = Math.cos(h), d = back - 0.3;
    cam.position.set(x + s * d, y + 2.15, z + c * d);
    cam.lookAt(x + s * (d - 20), y + 1.55, z + c * (d - 20));
    cam.layers.mask = camera.layers.mask;
  }

  // the mirror on the screen: about a third of its width (half on a tall screen), just under the top film bar
  function placeQuad() {
    const dist = Math.max(0.15, camera.near * 2);
    const vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), vw = vh * camera.aspect;
    const w = Math.min(vw * (camera.aspect < 1 ? 0.56 : 0.32), vh * 0.75), h = w / (W / H);
    quad.scale.set(w, h, 1);
    quad.position.set(across * Math.max(0, vw / 2 - w / 2 - vw * 0.04), vh / 2 - vh * 0.11 - h / 2 - vh * 0.025, -dist);
  }

  return {
    get active() { return !!car; },
    // car: the car whose mirror it is, or null (the mirror fades out)
    set(v, o = {}) { if (v && !rt) build(); car = v || null; if (v) across = Math.max(-1, Math.min(1, o.x || 0)); },
    render(dt) {
      if (!rt) return;
      fade = car ? Math.min(1, fade + dt / 0.6) : Math.max(0, fade - dt / 0.4);
      quad.visible = fade > 0.001;
      quad.material.uniforms.uFade.value = fade;
      if (!quad.visible || !car) return;
      placeQuad();
      // (every second frame is enough for a mirror)
      if ((frame++ & 1) === 1) return;
      placeCamera();
      const prev = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate;
      quad.visible = false;
      renderer.shadowMap.autoUpdate = false;           // (the shadows of the main picture are good enough)
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
      renderer.shadowMap.autoUpdate = shadows;
      quad.visible = true;
    },
  };
}
