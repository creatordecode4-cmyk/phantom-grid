// ---------------------------------------------------------------------------
// characterLook.js - how the skin and clothes of the characters take light.
//
// The streets are dark at night. Lit only by the street, a face becomes a
// black shape with black holes for eyes, and hands look like dark spots. Films
// and games solve that the same way: the people get a little light of their
// own. This file adds three things to the material of a character:
//
//   1. FILL LIGHT   a soft light that always comes from where the camera is.
//                   What faces the camera gets most of it, edges get less, so
//                   a body keeps its round shape. It costs no real light and
//                   no extra drawing. main.js sets its strength every frame
//                   (strong at night and indoors, almost nothing in the sun).
//   2. MATT SKIN    the head never shines like wet plastic: its roughness has
//                   a floor. That removes the white "tear" streaks on faces.
//   3. SOFT BUMPS   the small bumps painted into the model are halved on the
//                   head, so a face is not full of hard little shadows.
//
// "The head" is everything above the chin in the rest pose (the chin height
// comes from autoRig.js). Nothing here imports three.js: the file is also
// loaded by the rigging worker.
// ---------------------------------------------------------------------------

// shared by all characters: color x strength of the fill light
export const characterLight = { uPgCharFill: { value: [0, 0, 0] } };

// Sets the fill light. power: 0 = off; about 0.1 is a clear but soft light at night.
export function setCharacterFill(power, r = 1, g = 0.96, b = 0.9) {
  const v = characterLight.uPgCharFill.value;
  v[0] = power * r; v[1] = power * g; v[2] = power * b;
}

// material: the material of a character model. chinY: the height of the chin in the model (meters).
export function applyCharacterLook(material, chinY) {
  if (!material || !material.isMeshStandardMaterial || (material.userData && material.userData.pgCharacterLook)) return;
  material.userData.pgCharacterLook = true;
  const chin = { value: chinY > 0 ? chinY : 1e6 };           // (no chin known: nothing counts as the head)
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.uniforms.uPgCharFill = characterLight.uPgCharFill;
    shader.uniforms.uPgChin = chin;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPgChin;\nvarying float vPgHead;')
      // (position = the rest pose, before the bones move it)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPgHead = smoothstep( uPgChin - 0.03, uPgChin + 0.005, position.y );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uPgCharFill;\nvarying float vPgHead;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = max( roughnessFactor, 0.64 * vPgHead );')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n\tnormal = normalize( mix( normal, nonPerturbedNormal, 0.5 * vPgHead ) );')
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        '\t{',
        '\t\tfloat pgFacing = saturate( dot( normal, normalize( vViewPosition ) ) );',
        '\t\ttotalEmissiveRadiance += diffuseColor.rgb * uPgCharFill * ( 0.3 + 0.7 * pgFacing );',
        '\t}',
      ].join('\n'));
  };
  // (three.js re-uses compiled shaders between materials with the same key)
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => key + '|pg:character';
  material.needsUpdate = true;
}
