// ---------------------------------------------------------------------------
// actors.js - the people of the story (Theo, Dante, Mace, Dr. Solberg ...).
//
//   * A character's model file (assets/characters/<Name>.glb) is only loaded
//     when the story needs that person. The automatic skeleton is worked out
//     in the background (a "worker"), so the game does not stop meanwhile.
//   * If the file is missing, a plain mannequin with a name tag stands in.
//   * "Extras" (people without a name: two strangers arguing, a guard) are dark
//     copies of a body that is already loaded. They cost almost nothing.
//   * Every actor can stand, walk to a place, sit in a car, take a pose, look at
//     something, move a hand while speaking, and step out of the player's way.
//   * Only actors near the player are updated every frame.
//   * Nobody stands on the water: an actor in deep water (src/world/water.js) swims, at the surface.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { autoRig, cloneRig, analyzeCharacter } from '../characters/autoRig.js';
import { createAnimator, WALK_STYLES } from '../characters/proceduralAnim.js';
import { applyCharacterLook } from '../characters/characterLook.js';
import { makeMannequin } from '../city/models.js';
import { CONFIG } from '../config.js';
import { SWIM } from '../world/water.js';

const DEG = Math.PI / 180;
// compass degrees (0 north, 90 east, 180 south, 270 west) -> our angle (north = +z, east = -x)
export const compassToAngle = (deg) => Math.atan2(-Math.sin(deg * DEG), Math.cos(deg * DEG));
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ------------------------------------------------------------------ a jacket of somebody else (Chapter 4)
// The models are one mesh with one picture: their clothes cannot be changed. So a jacket is PAINTED over the body:
// the shader colors the chest, the back and the arms (from the rest pose of the model, where the auto rig found the
// shoulders, elbows and wrists), keeps the folds of the model's own picture as light and shadow, and leaves an open
// front (the shirt shows). j: { color: [r, g, b] as it looks, cuff: 0..1 (where the sleeve ends between shoulder
// and wrist: below 0.9 the sleeves are short, "a little small"), hem: meters above the hips (a short jacket),
// trim: [r, g, b] of the stripes at the cuffs and the hem (white when not given) }
// Theo's jacket: a blue bomber with white stripes at the cuffs and the hem. (Chapter 9: Dante's old Chrome Wolves
// jacket is charcoal with silver stripes.)
export function jacketLook(rig, j) {
  const src = rig.mesh.material, A = rig.def, J = A && A.joints;
  if (!src || !J || !J.upperArm_L || !J.hand_L || !A.info) return src;
  const m = src.clone();
  m.userData = { ...src.userData };
  const before = src.onBeforeCompile, baseKey = src.customProgramCacheKey ? src.customProgramCacheKey() : '';
  const V = (p) => new THREE.Vector3(p[0], p[1], p[2]);
  const sides = A.info.sides || [];
  const u = {
    uJkColor: { value: new THREE.Color().setRGB(...(j.color || [0.11, 0.42, 0.78]), THREE.SRGBColorSpace) },
    uJkTrim: { value: new THREE.Color().setRGB(...(j.trim || [0.86, 0.87, 0.88]), THREE.SRGBColorSpace) },
    uJkShL: { value: V(J.upperArm_L) }, uJkElL: { value: V(J.foreArm_L) }, uJkWrL: { value: V(J.hand_L) },
    uJkShR: { value: V(J.upperArm_R) }, uJkElR: { value: V(J.foreArm_R) }, uJkWrR: { value: V(J.hand_R) },
    // (the top: the neck, but always under the chin - a beard is not cloth)
    uJkHem: { value: A.info.hipY + (j.hem === undefined ? 0.06 : j.hem) }, uJkNeck: { value: Math.min(A.info.neckY + 0.025, (A.info.chinY || 9) - 0.045) },
    uJkArmR: { value: Math.max(0.05, ((sides[0] && sides[0].armR) || 0.05) * 1.9) }, uJkCuff: { value: j.cuff || 0.84 },
    uJkMidX: { value: (J.upperArm_L[0] + J.upperArm_R[0]) / 2 }, uJkHalf: { value: Math.abs(J.upperArm_L[0] - J.upperArm_R[0]) / 2 + 0.015 },
  };
  m.onBeforeCompile = (sh, r) => {
    if (before) before.call(src, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vJkP;\nvarying vec3 vJkN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvJkP = position;\n\tvJkN = normal;');
    sh.fragmentShader = [
      'varying vec3 vJkP;', 'varying vec3 vJkN;',
      'uniform vec3 uJkColor, uJkTrim, uJkShL, uJkElL, uJkWrL, uJkShR, uJkElR, uJkWrR;',
      'uniform float uJkHem, uJkNeck, uJkArmR, uJkCuff, uJkMidX, uJkHalf;',
      // (how far a point is from the line shoulder - elbow - wrist, and how far along it)
      'float jkSeg( vec3 p, vec3 a, vec3 b ) { vec3 ab = b - a; float t = clamp( dot( p - a, ab ) / dot( ab, ab ), 0.0, 1.0 ); return length( p - a - ab * t ); }',
      'float jkSleeve( vec3 p, vec3 sh, vec3 el, vec3 wr, out float trim ) {',
      '	float d = min( jkSeg( p, sh, el ), jkSeg( p, el, wr ) );',
      '	vec3 aw = wr - sh; float t = dot( p - sh, aw ) / dot( aw, aw );',
      '	trim = smoothstep( uJkCuff - 0.07, uJkCuff - 0.055, t ) * ( 1.0 - smoothstep( uJkCuff - 0.03, uJkCuff - 0.015, t ) );',
      '	return ( 1.0 - smoothstep( uJkArmR * 0.85, uJkArmR, d ) ) * ( 1.0 - smoothstep( uJkCuff - 0.01, uJkCuff, t ) ) * step( -0.2, t );',
      '}',
    ].join('\n') + '\n' + sh.fragmentShader.replace('#include <color_fragment>', [
      '#include <color_fragment>',
      '	{',
      '		vec3 p = vJkP;',
      '		float tl, tr;',
      '		float sl = jkSleeve( p, uJkShL, uJkElL, uJkWrL, tl ), sr = jkSleeve( p, uJkShR, uJkElR, uJkWrR, tr );',
      // the body of the jacket: from the hem to the neck, as wide as the shoulders
      '		float body = smoothstep( uJkHem - 0.008, uJkHem + 0.004, p.y ) * ( 1.0 - smoothstep( uJkNeck - 0.01, uJkNeck + 0.004, p.y ) ) * ( 1.0 - smoothstep( uJkHalf - 0.01, uJkHalf + 0.01, abs( p.x - uJkMidX ) ) );',
      // open in front: the shirt shows in a strip down the middle (not at the collar)
      '		float open = ( 1.0 - smoothstep( 0.045, 0.06, abs( p.x - uJkMidX ) ) ) * smoothstep( 0.2, 0.45, normalize( vJkN ).z ) * ( 1.0 - smoothstep( uJkNeck - 0.06, uJkNeck - 0.03, p.y ) );',
      '		float k = clamp( max( body * ( 1.0 - open ), max( sl, sr ) ), 0.0, 1.0 );',
      // the stripes: at the cuffs, and a band just above the hem
      '		float hemBand = smoothstep( uJkHem + 0.012, uJkHem + 0.018, p.y ) * ( 1.0 - smoothstep( uJkHem + 0.028, uJkHem + 0.034, p.y ) ) * body;',
      '		float trim = clamp( max( max( tl * sl, tr * sr ), hemBand * 0.85 ), 0.0, 1.0 );',
      // the folds of the model's own clothes stay as light and shadow on the new cloth
      '		float lum = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );',
      '		vec3 cloth = mix( uJkColor, uJkTrim, trim ) * clamp( 0.78 + ( lum - 0.18 ) * 1.6, 0.5, 1.3 );',
      '		diffuseColor.rgb = mix( diffuseColor.rgb, cloth, k );',
      '	}',
    ].join('\n'));
  };
  m.customProgramCacheKey = () => baseKey + '|jacket';
  return m;
}

// HOW EACH ONE WALKS (WALK_STYLES in proceduralAnim.js). The story can give an actor another style ("gait").
// Somebody in a copy of the player's body (the crowds of the story) gets a style from their name.
const WALKS = {
  Lena_Marchetti: 'brisk',        // quick, decided steps
  Viktor_Rask: 'old',             // a heavy old dock man
  Mace_Doyle: 'tough',            // the mechanic: shoulders, fists
  Dante_Rios: 'swagger',          // the racer who owns the street
  Juno_Kade: 'soldier',           // the Guard's sniper in her gear
  Ingrid_Solberg: 'elegant',      // the doctor
  Sloane_Harrow: 'posh',          // the captain of the Guard in The Crown
  Theo_Calloway: 'confident',
  Nate_Calloway: 'confident',
  Adrian_Vance: 'posh',
  Calder_Voss: 'tough',
};
// (by what the person is: the id or the name says it - a guard walks like a soldier, a mechanic like a tough guy)
const WALK_HINTS = [[/officer|guard|sentry|soldier|^g\d/, 'soldier'], [/girl|\btea\b|woman|mother|lady/, 'femme'], [/marshal|boss|captain/, 'confident'],
  [/wolf|racer/, 'swagger'], [/mech|crew|worker|docker/, 'tough'], [/^rep\d|reporter|press/, 'brisk'], [/\bold\b|grand/, 'old']];
const CROWD_WALKS = ['normal', 'normal', 'confident', 'brisk', 'tough', 'old', 'swagger'];
function walkFor(id, spec) {
  if (spec.gait && WALK_STYLES[spec.gait]) return spec.gait;
  if (spec.model && WALKS[spec.model]) return WALKS[spec.model];
  const who = (id + ' ' + (spec.name || '')).toLowerCase();
  for (const [re, style] of WALK_HINTS) if (re.test(who)) return style;
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CROWD_WALKS[h % CROWD_WALKS.length];
}

export function createActors({ scene, city, materials, player, vehicles, camera = null }) {
  const list = [];
  const rigs = new Map();          // model name -> promise of the first rig (later ones are copies)
  let loaderPromise = null, worker = null, workerBroken = false, nextJob = 1;
  const jobs = new Map();

  // ---- the heavy part of the rigging, in a background worker when the browser can do that ----
  function analyze(raw, index, height) {
    if (!worker && !workerBroken) {
      try {
        worker = new Worker(new URL('../characters/rigWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => { const j = jobs.get(e.data.id); if (!j) return; jobs.delete(e.data.id); if (e.data.ok) j.resolve(e.data.A); else j.reject(new Error(e.data.error)); };
        worker.onerror = () => { workerBroken = true; for (const j of jobs.values()) j.fallback(); jobs.clear(); };
      } catch (e) { workerBroken = true; }
    }
    if (workerBroken || !worker) return Promise.resolve(analyzeCharacter(raw, index, { height }));
    return new Promise((resolve, reject) => {
      const id = nextJob++, p = new Float32Array(raw), ix = new Uint32Array(index);
      jobs.set(id, { resolve, reject, fallback: () => { try { resolve(analyzeCharacter(raw, index, { height })); } catch (err) { reject(err); } } });
      worker.postMessage({ id, positions: p, index: ix, height }, [p.buffer, ix.buffer]);
    });
  }
  async function loadModel(name) {
    if (!loaderPromise) {
      loaderPromise = Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => {
        const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l;
      });
    }
    const loader = await loaderPromise;
    const gltf = await loader.loadAsync(`assets/characters/${name}.glb`);
    return autoRig(THREE, gltf.scene, { height: 1.8, name, log: false, analyze, faceClean: CONFIG.player.faceClean });
  }
  // the first rig of a model (shared by everybody who asks)
  function rigOf(model) {
    if (!rigs.has(model)) rigs.set(model, loadModel(model).then((rig) => ({ rig, used: false })));
    return rigs.get(model);
  }
  // start loading people before they are needed (the story calls this at the start of a chapter)
  function preload(models) { return Promise.all(models.map((m) => rigOf(m).catch(() => null))); }

  // dark, flat look for extras: only a shape in the rain
  const shadeMats = new Map();
  function shade(color) {
    const key = color.join(',');
    if (!shadeMats.has(key)) shadeMats.set(key, new THREE.MeshStandardMaterial({ color: new THREE.Color(color[0], color[1], color[2]), roughness: 0.85, metalness: 0.05 }));
    return shadeMats.get(key);
  }

  // SALVAGED CLOTHES (the Tidewalkers of Chapter 3): extra = { pants, coat, patch, scarf, head } colors [r, g, b].
  // One material colors the body by height (trousers, a coat with patches of other cloth, a scarf, a hood);
  // all of them share one shader program. The face (the front of the head, above the chin) keeps the body's
  // own picture, so they have faces; and they get the same soft night light as the story people.
  function outfit(o) {
    const key = 'o:' + JSON.stringify(o);
    if (shadeMats.has(key)) return shadeMats.get(key);
    const geo = player.rig.mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    // (the colors are written as they look on screen: turned into the light values the shader works with)
    const C = (c, d) => new THREE.Color().setRGB(...(c || d), THREE.SRGBColorSpace);
    const u = {
      uMinY: { value: bb.min.y }, uSpanY: { value: Math.max(0.01, bb.max.y - bb.min.y) },
      uPants: { value: C(o.pants, [0.08, 0.08, 0.09]) }, uCoat: { value: C(o.coat, [0.18, 0.16, 0.13]) }, uPatch: { value: C(o.patch, [0.1, 0.16, 0.2]) },
      uScarf: { value: C(o.scarf, [0.35, 0.12, 0.08]) }, uHead: { value: C(o.head, [0.12, 0.11, 0.1]) },
    };
    const src = player.rig.mesh.material, chin = player.rig.def && player.rig.def.info ? player.rig.def.info.chinY || 0 : 0;
    const pic = chin > 0 && src && src.map ? src.map : null;          // (no picture or no chin: no face, all cloth)
    u.uChin = { value: pic ? chin : 1e6 };
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.02, map: pic });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec3 vTideP;\nvarying vec3 vTideN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvTideP = position;\n\tvTideN = normal;');
      sh.fragmentShader = 'uniform float uMinY, uSpanY, uChin;\nuniform vec3 uPants, uCoat, uPatch, uScarf, uHead;\nvarying vec3 vTideP;\nvarying vec3 vTideN;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
	{
		vec3 pic = diffuseColor.rgb;          // (the body's own picture: only the face keeps it)
		float h = ( vTideP.y - uMinY ) / uSpanY;
		vec3 c = mix( uPants, uCoat, smoothstep( 0.44, 0.47, h ) );
		// patches of other cloth on the coat (squares a hand wide), seams in between
		vec2 q = floor( vTideP.xy / ( uSpanY * 0.09 ) + vec2( vTideP.z / ( uSpanY * 0.09 ), 0.0 ) );
		float r = fract( sin( dot( q, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
		c = mix( c, uPatch, step( 0.72, r ) * smoothstep( 0.46, 0.5, h ) * ( 1.0 - smoothstep( 0.8, 0.82, h ) ) );
		c = mix( c, uScarf, smoothstep( 0.79, 0.81, h ) * ( 1.0 - smoothstep( 0.85, 0.87, h ) ) );
		c = mix( c, uHead, smoothstep( 0.86, 0.88, h ) );
		// the face: above the chin, below the forehead, on the front of the head
		float face = smoothstep( uChin - 0.005, uChin + 0.015, vTideP.y ) * ( 1.0 - smoothstep( uChin + 0.16, uChin + 0.185, vTideP.y ) ) * smoothstep( 0.3, 0.55, normalize( vTideN ).z );
		diffuseColor.rgb = mix( c, pic, face );
	}`);
    };
    m.customProgramCacheKey = () => 'tideOutfit';
    // the soft fill light from the camera (faces are not black at night), a matt head
    applyCharacterLook(m, chin);
    shadeMats.set(key, m);
    return m;
  }

  // put the jacket on (j) or take it off (null)
  function setJacket(a, j) {
    a.jacket = j || null;
    if (!a.rig || !a.rig.mesh) return;
    if (!a.baseMat) a.baseMat = a.rig.mesh.material;
    if (j && !a.jacketMat) a.jacketMat = jacketLook(a.rig, j);
    a.rig.mesh.material = j ? a.jacketMat : a.baseMat;
  }

  // ------------------------------------------------------------------ spawn
  // spec: { model: 'Mace_Doyle' | null, extra: [r, g, b] (a dark copy of the player's body) or { pants, coat, patch, scarf, head }
  //         (a copy in salvaged clothes), name: text for the tag,
  //         at: [x, y, z], heading (radians), pose, scale, tag: always show the name, fixed: never steps aside,
  //         mood: the expression of the face, gait: how this one walks (WALK_STYLES; left out: WALKS below) }
  function spawn(id, spec) {
    const old = get(id);
    if (old) remove(id);
    const root = new THREE.Group();
    root.name = 'actor_' + id;
    const a = {
      id, name: spec.name || '', root, rig: null, anim: null, mannequin: false, ready: false,
      x: spec.at[0], y: spec.at[1], z: spec.at[2], heading: spec.heading || 0, scale: spec.scale || 1,
      pose: spec.pose || 'idle', look: spec.look === undefined ? 'auto' : spec.look, talking: 0, tag: !!spec.tag, fixed: !!spec.fixed,
      hidden: !!spec.hidden, seat: null, seated: null, walk: null, speed: 0, attached: [], floorBelow: spec.floorBelow || 0.45, far: 0,
      keepY: !!spec.keepY,       // true: stands on a floor inside a building (the height is not taken from the street)
      mood: spec.mood || 'neutral', // the expression of the face (faceAnim.js)
      jacket: spec.jacket || null,  // somebody else's jacket painted over the clothes (Chapter 4: Dante in Theo's jacket)
      ghost: !!spec.ghost,       // true: the player can walk through (far away figures)
      carried: null,             // a box held with both hands: { object, size } (see carry)
      walkStyle: walkFor(id, spec), // how this one walks and stands (WALKS above)
      grips: {},                 // hands closed around a handle: { L: degrees, R: degrees }
    };
    root.position.set(a.x, a.y, a.z);
    root.rotation.y = a.heading;
    root.scale.setScalar(a.scale);
    root.visible = false;
    scene.add(root);
    list.push(a);
    const finish = (rig) => {
      if (!list.includes(a)) return;                    // (removed again before the model arrived)
      a.rig = rig; a.anim = createAnimator(THREE, rig);
      a.anim.walkStyle = a.walkStyle;
      if (a.jacket) setJacket(a, a.jacket);
      a.anim.setPose(a.pose, 0); a.anim.floorBelow = a.floorBelow; a.anim.setFace(a.mood, 0);
      if (a.carried) a.anim.carry = a.carried.size;
      for (const t in a.grips) a.anim.setGrip(t, a.grips[t]);
      root.add(rig.root);
      for (const at of a.attached) rig.bones[at.bone].add(at.object);
      a.ready = true;
    };
    const fallback = () => {
      if (!list.includes(a)) return;
      // no model file: a plain figure with a name tag
      const m = new THREE.Mesh(makeMannequin(), materials.mats.prop);
      m.castShadow = true;
      root.add(m);
      a.mannequin = true; a.tag = true; a.ready = true;
    };
    if (spec.extra && player.rig) finish(cloneRig(THREE, player.rig, Array.isArray(spec.extra) ? shade(spec.extra) : outfit(spec.extra)));
    else if (spec.model) {
      rigOf(spec.model).then((entry) => {
        if (!entry) return fallback();
        // the first actor of a model uses the rig itself, later ones get a copy
        // (somebody in a jacket always gets a copy: the jacket is his own material)
        if (!entry.used && !spec.jacket) { entry.used = true; finish(entry.rig); } else finish(cloneRig(THREE, entry.rig));
      }).catch((e) => { console.warn('[actors] could not load', spec.model, e); fallback(); });
    } else fallback();
    return a;
  }
  const get = (id) => list.find((a) => a.id === id) || null;
  function remove(id) {
    const i = list.findIndex((a) => a.id === id);
    if (i < 0) return;
    const a = list[i];
    if (a.rig && a.rig.root.parent && a.rig.root.parent !== a.root) a.rig.root.parent.remove(a.rig.root);
    scene.remove(a.root);
    // the first rig of a model can be used again by the next actor of that model
    for (const p of rigs.values()) p.then((entry) => { if (entry && a.rig === entry.rig) entry.used = false; }).catch(() => {});
    list.splice(i, 1);
  }
  function clear() { while (list.length) remove(list[0].id); }
  // free the memory of models that nobody uses (between chapters)
  function unload() {
    for (const [model, p] of rigs) p.then((entry) => {
      if (!entry || entry.used || list.some((a) => a.rig && a.rig.def === entry.rig.def)) return;
      entry.rig.mesh.geometry.dispose();
      const m = entry.rig.mesh.material;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[key]) m[key].dispose();
      m.dispose();
      rigs.delete(model);
    }).catch(() => {});
  }

  // ------------------------------------------------------------------ what the story can ask of an actor
  // put something into a hand or on the body: bone name ('hand_R' ...), object with its own position
  function attach(a, bone, object) { a.attached.push({ bone, object }); if (a.rig) a.rig.bones[bone].add(object); }
  // a box held in front with both hands (a package): size = { w, h, d, cx, cy, cz } (its size and its middle).
  // The animator puts the hands on its sides and says where the box is (carryAt); null = put it away.
  function carry(a, object, size) {
    if (a.carried && a.carried.object.parent) a.carried.object.parent.remove(a.carried.object);
    a.carried = object ? { object, size } : null;
    if (object) { a.root.add(object); object.visible = false; }      // (shown once it is in the hands)
    if (a.anim) a.anim.carry = object ? size : null;
    if (object) setPose(a, 'carry', 0.3);
    else if (a.pose === 'carry') setPose(a, 'idle', 0.3);
  }
  // a hand that holds something by a handle (Dr. Solberg's case): the fingers close around it. curl 0 = normal
  function grip(a, tag, curl) { a.grips[tag] = curl || 0; if (a.anim) a.anim.setGrip(tag, curl || 0); }
  function setPose(a, pose, seconds = 0.4) { a.pose = pose; if (a.anim) a.anim.setPose(pose, seconds); }
  // another way of walking for this actor (a name from WALK_STYLES)
  function setWalk(a, name) { a.walkStyle = WALK_STYLES[name] ? name : a.walkStyle; if (a.anim) a.anim.walkStyle = a.walkStyle; }
  // the expression of the face: 'smile', 'sad', 'angry' ... (FACES in src/characters/faceAnim.js)
  function setMood(a, mood, seconds = 0.45) { a.mood = mood; if (a.anim) a.anim.setFace(mood, seconds); }
  // walk to a place (speed in m/s), then turn to "face" (radians) if given
  function walkTo(a, x, z, speed = 1.4, face = null) { a.walk = { x, z, speed, face }; }
  function place(a, x, y, z, heading = null) { a.x = x; a.y = y; a.z = z; if (heading !== null) a.heading = heading; a.walk = null; a.dryY = undefined; a.wet = 0; a.swim = false; if (a.anim) a.anim.reset(); }
  // sit in a car: seat = 'passenger'. null = get out (the story places the actor afterwards)
  function sitIn(a, vehicle) { a.seat = vehicle; if (!vehicle && a.seated) { a.root.add(a.rig.root); a.rig.root.position.set(0, 0, 0); a.rig.root.rotation.set(0, 0, 0); a.rig.root.scale.setScalar(1); a.anim.floorBelow = a.floorBelow; a.seated = null; setPose(a, 'idle', 0); } }

  // ------------------------------------------------------------------ every frame
  const tmp = new THREE.Vector3();
  function update(dt, time, driving) {
    const px = player.position.x, pz = player.position.z;
    for (const a of list) {
      if (!a.ready) continue;
      a.root.visible = !a.hidden && !(a.seat && !a.seated);
      if (a.hidden) continue;
      // ---- in a car seat: the body belongs to the car ----
      if (a.seat) {
        const s = vehicles.passengerSeat(a.seat);
        if (!s || !a.anim) { a.root.visible = false; continue; }
        // (a car seat: 'sit', leaning back. A boat: 'sitEdge' on the edge of the deck, turned to the water)
        if (a.seated !== s.node) { a.seated = s.node; s.node.add(a.rig.root); a.anim.setPose(s.pose || 'sit', 0); a.anim.floorBelow = s.floorBelow || a.floorBelow; }
        else if (s.pose && a.anim.pose !== s.pose) a.anim.setPose(s.pose, 0.3);      // (a boat seat keeps its own pose)
        a.rig.root.position.set(s.x, s.y, s.z); a.rig.root.rotation.set(0, s.yaw || 0, 0); a.rig.root.scale.setScalar(s.scale * a.scale);
        // where the body really is (film cameras and markers look at it): the seat in the world, and the way it faces
        a.rig.root.getWorldPosition(tmp); a.x = tmp.x; a.y = tmp.y; a.z = tmp.z;
        a.heading = a.seat.heading + (s.yaw || 0);
        a.anim.talk = a.talking;
        a.anim.look = a.look && a.look !== 'auto' && typeof a.look === 'object' && 'yaw' in a.look ? a.look : null;
        a.anim.update(dt, {});
        continue;
      }
      const dist = Math.hypot(a.x - px, a.z - pz);
      // far away from the player AND from the camera: only now and then (nobody sees the difference).
      // (A film scene often shows people far from the player: near the camera they always move every frame -
      //  breathing, speaking, the head and the hands stay smooth while the camera moves.)
      const camD = camera ? Math.hypot(a.x - camera.position.x, a.z - camera.position.z) : dist;
      const far = Math.min(dist, camD) > 55;
      a.far += dt;
      if (far && a.far < 0.4 && !a.walk) continue;
      const step = far ? a.far : dt;
      a.far = 0;
      // ---- walking ----
      let speed = 0;
      if (a.walk) {
        const dx = a.walk.x - a.x, dz = a.walk.z - a.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { if (a.walk.face !== null) a.heading += angleDiff(a.heading, a.walk.face) * Math.min(1, step * 6); if (a.walk.face === null || Math.abs(angleDiff(a.heading, a.walk.face)) < 0.05) a.walk = null; }
        else {
          speed = Math.min(a.walk.speed, d / Math.max(step, 0.001));
          a.heading += angleDiff(a.heading, Math.atan2(dx, dz)) * Math.min(1, step * 7);
          a.x += (dx / d) * speed * step; a.z += (dz / d) * speed * step;
          if (!a.keepY) a.y = city.groundHeight(a.x, a.z);
        }
      } else if (!a.fixed && !driving && dist < 0.7 && a.pose !== 'fallen' && a.pose !== 'lie' && a.pose !== 'sitEdge') {
        // the player walks into them: one step aside
        const ax = a.x - px, az = a.z - pz, d = Math.hypot(ax, az) || 1;
        walkTo(a, a.x + (ax / d) * 0.6 - (az / d) * 0.35, a.z + (az / d) * 0.6 + (ax / d) * 0.35, 1.2, a.heading);
      }
      a.speed = speed;
      // ---- deep water under him (no deck, nor a floor at his height): he swims, the root at the surface ----
      // (who is put into the water swims at once; walking, a crack of a few centimeters between two decks is
      //  stepped over: only after a moment over the water does he go in)
      const w = city.water ? city.water.at(a.x, a.z) : null;
      const deep = !!w && w.surface - w.bottom >= SWIM && a.y <= w.surface + 0.05;
      a.wet = deep ? (a.wet || 0) + step : 0;
      if (deep && (a.swim || a.wet > 0.3 || a.dryY === undefined)) { a.swim = true; a.y = w.surface; }
      else { a.swim = false; if (deep) a.y = a.dryY; else a.dryY = a.y; }
      a.root.position.set(a.x, a.y - (a.swim && !a.anim ? 1.25 : 0), a.z);      // (a plain figure: in the water up to the chest)
      a.root.rotation.y = a.heading;
      if (!a.anim) continue;
      // ---- where to look: at the player when near ('auto'), at a point, or freely ----
      let look = null;
      const target = a.look === 'player' || (a.look === 'auto' && dist < 6 && !a.walk) ? tmp.set(px, player.position.y + (driving ? 1.1 : player.swimming ? 0.25 : 1.6), pz) : a.look && typeof a.look === 'object' && 'x' in a.look ? tmp.set(a.look.x, a.look.y, a.look.z) : null;
      if (target) {
        const yaw = angleDiff(a.heading, Math.atan2(target.x - a.x, target.z - a.z));
        // (the eyes: 1.62 m above the feet standing, about 0.8 m above the seat when sitting on a chair, just above the water swimming)
        const eye = a.y + (a.swim ? 0.25 : (a.pose === 'sit' || a.pose === 'sitEdge') ? 0.8 : 1.62) * a.scale;
        if (Math.abs(yaw) < 1.9) look = { yaw, pitch: -Math.atan2(target.y - eye, Math.max(0.5, Math.hypot(target.x - a.x, target.z - a.z))) };
      } else if (a.look && typeof a.look === 'object' && 'yaw' in a.look) look = a.look;
      a.anim.look = look;
      a.anim.talk = a.talking;
      // where the hands work (the story's "hands": a point in the world) - in the body's own space
      if (a.workAt) {
        const dx = a.workAt[0] - a.x, dy = a.workAt[1] - a.y, dz = a.workAt[2] - a.z, c = Math.cos(a.heading), sn = Math.sin(a.heading), sc = a.scale || 1;
        a.anim.workAt = (a.workLocal = a.workLocal || new THREE.Vector3()).set((dx * c - dz * sn) / sc, dy / sc, (dx * sn + dz * c) / sc);
      } else a.anim.workAt = null;
      a.anim.update(step, { speed, x: a.x, z: a.z, y: a.y, heading: a.heading, groundAt: a.keepY ? null : city.groundHeight, swim: a.swim });
      if (a.carried) {
        const at = a.anim.carryAt, C = a.carried;
        C.object.visible = !!at;
        if (at) C.object.position.set(at.x - C.size.cx, at.y - C.size.cy, at.z - C.size.cz);
      }
      // the player cannot walk through a standing person
      if (!a.walk && dist < 12 && city.colliders.dynamic && a.pose !== 'fallen' && !a.ghost) city.colliders.dynamic.push({ x: a.x, z: a.z, r: 0.32 });
    }
  }
  // name tags (mannequins and actors marked with "tag"): writes { x, y, text } into "out"
  function tags(camera, out) {
    for (const a of list) {
      if (!a.tag || !a.name || a.hidden || !a.ready) continue;
      if (Math.abs(a.x - player.position.x) > 25 || Math.abs(a.z - player.position.z) > 25) continue;
      tmp.set(a.x, a.y + (a.swim ? 0.75 : 2.05) * a.scale, a.z).project(camera);
      if (tmp.z < 1 && Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1) out.push({ x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight, text: a.name });
    }
  }

  return { list, spawn, get, remove, clear, unload, preload, update, tags, attach, carry, grip, setPose, setMood, setWalk, walkTo, place, sitIn, setJacket };
}
