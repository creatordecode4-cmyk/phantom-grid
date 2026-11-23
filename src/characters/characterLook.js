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
//   5. WET EYES     (with "detail" from characterDetail.js) the eyes of the
//                   models are only painted, matt like the skin around them,
//                   so they look dead. Here they are wet: they shine, and each
//                   gets a small light (like the light a film camera puts in an
//                   actor's eyes), only on the dark of the eye, never on skin.
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
// detail (characterDetail.js): { eyes } or null
export function applyCharacterLook(material, chinY, mouth = null, detail = null) {
  if (!material || !material.isMeshStandardMaterial || (material.userData && material.userData.pgCharacterLook)) return;
  material.userData.pgCharacterLook = true;
  const chin = { value: chinY > 0 ? chinY : 1e6 };           // (no chin known: nothing counts as the head)
  const D = detail ? detailUniforms(detail) : null;
  if (D) material.userData.pgDetail = D;                       // (the uniforms: tests and tuning can reach them)
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.uniforms.uPgCharFill = characterLight.uPgCharFill;
    shader.uniforms.uPgChin = chin;
    if (D) Object.assign(shader.uniforms, D);
    const def = (mouth ? '#define PG_MOUTH\n' : '') + (D ? '#define PG_DETAIL\n' : '');
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
        '#ifdef PG_DETAIL',
        'varying vec3 vPgPos;',
        '#endif',
      ].join('\n'))
      // (position = the rest pose, before the bones move it)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPgHead = smoothstep( uPgChin - 0.03, uPgChin + 0.005, position.y );\n#ifdef PG_DETAIL\n\tvPgPos = position;\n#endif')
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
      .replace('#include <common>', '#include <common>\nuniform vec3 uPgCharFill;\nvarying float vPgHead;\n#ifdef PG_MOUTH\nvarying vec2 vPgLip;\nvarying float vPgOpen;\n#endif\n' + DETAIL_COMMON)
      // the stretched skin between the lips (its side value is between 0 and 1 there) is the inside of the mouth
      .replace('#include <map_fragment>', [
        '#include <map_fragment>',
        '#ifdef PG_MOUTH',
        '\t{',
        '\t\tfloat pgGap = vPgLip.y * smoothstep( 0.08, 0.3, vPgLip.x ) * ( 1.0 - smoothstep( 0.7, 0.92, vPgLip.x ) ) * smoothstep( 0.03, 0.3, vPgOpen );',
        '\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.055, 0.022, 0.02 ), pgGap );',
        '\t}',
        '#endif',
        '#ifdef PG_DETAIL',
        '\tfloat pgEye = 0.0, pgCatch = 0.0;',
        // (how much of the person one screen point covers: worked out here, outside of any if, where the GPU can always do it)
        '\tfloat pgFoot = max( length( dFdx( vPgPos ) ), length( dFdy( vPgPos ) ) );',
        '#endif',
      ].join('\n'))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = max( roughnessFactor, 0.64 * vPgHead );')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n\tnormal = normalize( mix( normal, nonPerturbedNormal, 0.5 * vPgHead ) );\n' + DETAIL_SURFACE)
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        '\t{',
        '\t\tfloat pgFacing = saturate( dot( normal, normalize( vViewPosition ) ) );',
        '\t\ttotalEmissiveRadiance += diffuseColor.rgb * uPgCharFill * ( 0.3 + 0.7 * pgFacing );',
        '\t}',
        DETAIL_EYELIGHT,
      ].join('\n'));
  };
  // (three.js re-uses compiled shaders between materials with the same key)
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => key + '|pg:character' + (mouth ? '+mouth' : '') + (D ? '+detail' : '');
  material.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// 5. CLOSE UP - the shader parts (see the top of this file) and their inputs
// ---------------------------------------------------------------------------

// detail (characterDetail.js) -> the uniforms of the shader (plain arrays: nothing here imports three.js)
function detailUniforms(d) {
  const far = [0, -1000, 0];
  return {
    uPgEyeL: { value: d.eyes ? d.eyes.l.slice(0, 3) : far.slice() },
    uPgEyeR: { value: d.eyes ? d.eyes.r.slice(0, 3) : far.slice() },
    uPgEyeSize: { value: d.eyes ? d.eyes.size.slice(0, 3) : [0.01, 0.01, 0] },
  };
}

// declarations and helpers (after #include <common> of the fragment shader)
const DETAIL_COMMON = /* glsl */ `
#ifdef PG_DETAIL
uniform vec3 uPgEyeL, uPgEyeR, uPgEyeSize;    // the eyes: middles (rest pose); half width, half height, how sure
varying vec3 vPgPos;
// how much a place (rest pose) is the front of the eye whose middle is c
float pgEyeAt( vec3 p, vec3 c ) {
	vec3 d = p - c;
	return ( 1.0 - smoothstep( 0.6, 1.0, length( d.xy / uPgEyeSize.xy ) ) ) * step( - 0.012, d.z );
}
#endif
`;

// wet eyes (after #include <normal_fragment_maps>: the color, roughness and normal are still open; the light comes after)
const DETAIL_SURFACE = /* glsl */ `
#ifdef PG_DETAIL
	{
		// ---- the eyes: wet, they shine; and the small light in each: a dot a little above and to the left of the
		//      middle of the eye (as seen from the front), only on the dark of the eye ----
		pgEye = max( pgEyeAt( vPgPos, uPgEyeL ), pgEyeAt( vPgPos, uPgEyeR ) ) * uPgEyeSize.z * vPgHead;
		roughnessFactor = mix( roughnessFactor, 0.07, pgEye );
		if ( pgEye > 0.01 ) {
			vec3 eyeC = vPgPos.x > 0.5 * ( uPgEyeL.x + uPgEyeR.x ) ? uPgEyeL : uPgEyeR;
			float rad = 0.1 * uPgEyeSize.x;                               // (about 1.2 mm: small, like in a photo)
			float dist = length( vPgPos.xy - eyeC.xy - vec2( - 0.16, 0.12 ) * uPgEyeSize.xx );
			float dot1 = ( 1.0 - smoothstep( rad - 0.5 * pgFoot, rad + 0.5 * pgFoot, dist ) ) * min( 1.0, rad * rad / max( pgFoot * pgFoot, 1e-12 ) );
			pgCatch = dot1 * pgEye * ( 1.0 - smoothstep( 0.08, 0.3, dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ) );
		}
	}
#endif
`;

// the small light in each eye (after the fill light): a soft lamp just above and to the left of the camera
const DETAIL_EYELIGHT = /* glsl */ `
#ifdef PG_DETAIL
	if ( pgEye > 0.01 ) {
		float pgLight = 0.55 + 5.0 * ( uPgCharFill.r + uPgCharFill.g + uPgCharFill.b );    // (stronger at night)
		vec3 pgR = reflect( - normalize( vViewPosition ), normal );
		float pgSp = pow( max( dot( pgR, normalize( vec3( - 0.32, 0.42, 1.0 ) ) ), 0.0 ), 80.0 );
		totalEmissiveRadiance += vec3( 0.92, 0.95, 1.0 ) * ( pgSp * pgEye * 0.5 + pgCatch * 1.0 ) * pgLight;
	}
#endif
`;
