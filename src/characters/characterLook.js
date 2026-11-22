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
//   4. OPEN MOUTH   the models have no inside of a mouth: the lips are one
//                   closed skin. When the jaw opens (speaking, surprise), the
//                   skin where the lips meet is stretched; here it is drawn
//                   dark, like the inside of a mouth. How open the jaw is, is
//                   worked out from the bones themselves, so every person in
//                   the scene has their own mouth with the same material.
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
// mouth (faceRig.js): { jaw, head (bone numbers), p (a point of the lower lip, model space), ref (meters: fully open) } or null
export function applyCharacterLook(material, chinY, mouth = null) {
  if (!material || !material.isMeshStandardMaterial || (material.userData && material.userData.pgCharacterLook)) return;
  material.userData.pgCharacterLook = true;
  const chin = { value: chinY > 0 ? chinY : 1e6 };           // (no chin known: nothing counts as the head)
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.uniforms.uPgCharFill = characterLight.uPgCharFill;
    shader.uniforms.uPgChin = chin;
    const def = mouth ? '#define PG_MOUTH\n' : '';
    if (mouth) {
      shader.uniforms.uPgJaw = { value: mouth.jaw }; shader.uniforms.uPgHeadBone = { value: mouth.head };
      shader.uniforms.uPgLipPoint = { value: mouth.p }; shader.uniforms.uPgOpenRef = { value: mouth.ref };
    }
    shader.vertexShader = def + shader.vertexShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform float uPgChin;',
        'varying float vPgHead;',
        '#ifdef PG_MOUTH',
        'uniform float uPgJaw, uPgHeadBone, uPgOpenRef;',
        'uniform vec3 uPgLipPoint;',
        'attribute vec2 pgLip;',
        'varying vec2 vPgLip;',
        'varying float vPgOpen;',
        '#endif',
      ].join('\n'))
      // (position = the rest pose, before the bones move it)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPgHead = smoothstep( uPgChin - 0.03, uPgChin + 0.005, position.y );')
      // how far the lower lip has moved away from where the head would carry it = how open the mouth is
      .replace('#include <skinning_vertex>', [
        '#include <skinning_vertex>',
        '#if defined( PG_MOUTH ) && defined( USE_SKINNING )',
        '\tvPgLip = pgLip;',
        '\tvPgOpen = 0.0;',
        '\tif ( pgLip.y > 0.0 ) {',         // (only the few points of the mouth: the rest of the body costs nothing more)
        '\t\tvec4 pgP = vec4( uPgLipPoint, 1.0 );',
        '\t\tvPgOpen = clamp( length( ( getBoneMatrix( uPgJaw ) * pgP ).xyz - ( getBoneMatrix( uPgHeadBone ) * pgP ).xyz ) / uPgOpenRef, 0.0, 1.0 );',
        '\t}',
        '#endif',
      ].join('\n'));
    shader.fragmentShader = def + shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uPgCharFill;\nvarying float vPgHead;\n#ifdef PG_MOUTH\nvarying vec2 vPgLip;\nvarying float vPgOpen;\n#endif')
      // the stretched skin between the lips (its side value is between 0 and 1 there) is the inside of the mouth
      .replace('#include <map_fragment>', [
        '#include <map_fragment>',
        '#ifdef PG_MOUTH',
        '\t{',
        '\t\tfloat pgGap = vPgLip.y * smoothstep( 0.08, 0.3, vPgLip.x ) * ( 1.0 - smoothstep( 0.7, 0.92, vPgLip.x ) ) * smoothstep( 0.03, 0.3, vPgOpen );',
        '\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.055, 0.022, 0.02 ), pgGap );',
        '\t}',
        '#endif',
      ].join('\n'))
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
  material.customProgramCacheKey = () => key + '|pg:character' + (mouth ? '+mouth' : '');
  material.needsUpdate = true;
}
