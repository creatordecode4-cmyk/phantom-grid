// ---------------------------------------------------------------------------
// materials.js - loads the textures and builds every material in the game.
//
// All big surfaces use three.js PBR materials (MeshStandardMaterial).
// On top of that we add small pieces of shader code ("patches") for the
// things three.js cannot do by itself:
//   * break up repeating textures with large soft noise
//   * dirt near the ground on walls
//   * wet roads and puddles when it rains
//   * windows on facades (day picture + glowing night picture)
//   * light pools from street lamps, stored in one top-down texture
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makeNoiseTexture, makeNormalRoughTexture, flattenImage, readPixels } from '../utils/noise.js';
import * as TX from './textures.js';

// ---------------------------------------------------------------------------
// Values shared by all patched materials. Change ".value" and every material
// sees the new value on the next frame.
// ---------------------------------------------------------------------------
export const shared = {
  uPgTime: { value: 0 },                         // seconds since start
  uPgWet: { value: 0 },                          // 0 = dry, 1 = soaked
  uPgNight: { value: 0 },                        // 0 = lamps off, 1 = lamps on
  uPgWinLight: { value: 0 },                     // share of windows that are lit
  uPgDay: { value: 1 },                          // daylight level 0..1
  uPgNoise: { value: null },                     // shared noise texture
  uPgLightMap: { value: null },                  // lamp light seen from above
  uPgLightRect: { value: new THREE.Vector4(-600, -600, 1 / 1200, 1 / 1200) },
  uPgLightColA: { value: new THREE.Color(CONFIG.streetLights.sodiumColor) },
  uPgLightColB: { value: new THREE.Color(CONFIG.streetLights.ledColor) },
  uPgPlayer: { value: new THREE.Vector3() },     // player position
  uPgWinAtlas: { value: null },                  // 8 x 8 day windows
  uPgWinLit: { value: null },                    // 4 x 4 glowing windows
  uPgShoreZ: { value: -470 },                    // where the sea meets the sand
  uPgWaterNormal: { value: null },
  uPgDetail: { value: null },                    // wall cracks / drips / pitting
};

// ---------------------------------------------------------------------------
// Facades are divided into "cells": one window bay wide, one floor high.
// These numbers say where the window opening sits inside a cell, as parts of
// the cell: [left, bottom, width, height].
// The wall shader (far away: painted windows) and the 3D window parts (near
// the player) both use them, so the two always line up.
//   style 1 = wide three-part window (cut from the photo)
//   style 2 = tall sash window
//   style 3 = office glass
// ---------------------------------------------------------------------------
export const WINDOW_STYLES = {
  1: [0.2, 0.26, 0.6, 0.48],
  2: [0.27, 0.24, 0.46, 0.54],
  3: [0.1, 0.24, 0.8, 0.62],
};
const glslVec4 = (a) => `vec4( ${a.map((v) => v.toFixed(4)).join(', ')} )`;

// ---------------------------------------------------------------------------
// Changes to three.js's own shader pieces. They apply to ALL materials.
// Must run before the first frame is drawn.
// ---------------------------------------------------------------------------
export function installGlobalShaderPatches() {
  const C = THREE.ShaderChunk;

  // ---- 1. Ground haze: fog that is thick near the street and thin high up ----
  C.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying float vFogHeight;
#endif`;
  C.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	// world height of this point (camera space -> world space, y only)
	vFogHeight = dot( viewMatrix[ 1 ].xyz, mvPosition.xyz ) + cameraPosition.y;
#endif`;
  C.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogHeight;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
	// How much haze lies between the camera and a point: 0 = none, 1 = hidden.
	float pgFogAmount() {
		#ifdef FOG_EXP2
			float y0 = max( cameraPosition.y, 0.0 ) / ${CONFIG.fog.height.toFixed(1)};
			float y1 = max( vFogHeight, 0.0 ) / ${CONFIG.fog.height.toFixed(1)};
			float dy = y1 - y0;
			// average haze thickness along the view line
			float t = abs( dy ) > 0.01 ? ( exp( - y0 ) - exp( - y1 ) ) / dy : exp( - y0 );
			float d = fogDensity * vFogDepth * t;
			return 1.0 - exp( - d * d );
		#else
			return smoothstep( fogNear, fogFar, vFogDepth );
		#endif
	}
#endif`;
  C.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, pgFogAmount() );
#endif`;

  // ---- 2. Shadows: a sharp map near the player + a soft map for the far city ----
  // The game uses exactly ONE sun. A second, black "helper" light only carries
  // the far shadow map. Here we teach the shader to blend the two maps.
  const sunShadowLine =
    'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  const marker = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )';
  const src = C.lights_fragment_begin;
  const at = src.indexOf(marker);
  if (at >= 0 && src.includes(sunShadowLine)) {
    let head = src.slice(0, at);
    let tail = src.slice(at);
    tail = tail.replace(
      sunShadowLine,
      `#if ( UNROLLED_LOOP_INDEX == 0 )
		directLight.color *= ( directLight.visible && receiveShadow ) ? pgSunShadow() : 1.0;
		#endif`
    );
    // only light number 0 (the sun) adds light; the helper light is skipped
    tail = tail.replace(
      'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
      `#if ( UNROLLED_LOOP_INDEX == 0 )
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		#endif`
    );
    C.lights_fragment_begin = head + tail;
    C.shadowmap_pars_fragment += /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	float pgSunShadow() {
		vec3 c = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
		vec2 e = abs( c.xy - 0.5 );
		// 0 inside the sharp map, 1 at (and beyond) its border
		float w = smoothstep( 0.39, 0.49, max( e.x, e.y ) );
		float nearS = 1.0;
		float farS = 1.0;
		if ( w < 1.0 ) nearS = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowIntensity, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
		#if NUM_DIR_LIGHT_SHADOWS > 1
		if ( w > 0.0 ) farS = getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowIntensity, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] );
		#endif
		return mix( nearS, farS, w );
	}
#endif`;
  } else {
    console.warn('[materials] shadow patch skipped (three.js shader text changed)');
  }
}

// ---------------------------------------------------------------------------
// The shader patch. "defs" is a list of switches, for example
// ['PG_GROUND', 'PG_ANTITILE'].
// ---------------------------------------------------------------------------
const PG_VERTEX_PARS = /* glsl */ `
varying vec3 vPgWorld;
varying vec3 vPgNormal;
#ifdef PG_USE_DATA
	attribute vec4 aData;
	#if defined( PG_SHOP ) || defined( PG_WINMOD )
		// "flat" = not blended between the corners, so every pixel of one shop
		// gets exactly the same numbers (its type and its random seed)
		flat varying vec4 vPgData;
	#else
		varying vec4 vPgData;
	#endif
#endif
#if defined( PG_SHOP ) || defined( PG_TOWER ) || defined( PG_WINMOD )
	varying vec2 vPgUv;
#endif
#ifdef PG_FOLIAGE
	uniform float uPgTime;
#endif
#ifdef PG_WINMOD
	attribute vec4 aInst;     // per window: width, height (meters), cell across, cell up
	attribute vec4 aInstB;    // per window: wall color (r, g, b), style + switches
	varying vec3 vPgTint;
#endif
`;

// 3D windows: one model is stretched to the size of each opening. Parts that
// a window does not have (sill, lintel, frame around it) are shrunk to nothing.
//   aData = ( part, -, offset x, offset y in meters )
//   part: 0 glass, 1 wall-colored sides, 2 sill, 3 lintel, 4 raised frame
const PG_VERTEX_WINMOD = /* glsl */ `
#ifdef PG_WINMOD
	float pgFlags = aInstB.a;
	float pgStyle = mod( pgFlags, 4.0 );
	float pgKeep = 1.0;
	if ( aData.x > 1.5 && aData.x < 2.5 ) pgKeep = step( 0.5, mod( floor( pgFlags / 4.0 ), 2.0 ) );
	else if ( aData.x > 2.5 && aData.x < 3.5 ) pgKeep = step( 0.5, mod( floor( pgFlags / 8.0 ), 2.0 ) );
	else if ( aData.x > 3.5 ) pgKeep = step( 0.5, mod( floor( pgFlags / 16.0 ), 2.0 ) );
	// how deep the glass sits inside the wall (meters)
	float pgDepth = pgStyle > 2.5 ? 0.13 : 0.21;
	transformed = vec3( position.x * aInst.x + aData.z, position.y * aInst.y + aData.w,
		position.z < 0.0 ? position.z * pgDepth : position.z ) * pgKeep;
#endif
`;

// 3D windows take the sun shadow of the wall around them. (Without this the
// glass would always be "in the shadow of its own wall", because the shadow
// map only knows the flat wall.)
const PG_SHADOW_WINMOD = /* glsl */ `
#if defined( PG_WINMOD ) && defined( USE_SHADOWMAP )
	{
		vec4 pgSp = vec4( transformed.xy, 0.06, 1.0 );
		#ifdef USE_INSTANCING
			pgSp = instanceMatrix * pgSp;
		#endif
		worldPosition = modelMatrix * pgSp;
	}
#endif
`;

// Vertex colors for props: the per-copy color only tints the "paint" parts.
const PG_COLOR_VERTEX_PROP = /* glsl */ `
#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, aData.z );
#endif
`;

const PG_VERTEX_MAIN = /* glsl */ `
	vec4 pgWp = vec4( transformed, 1.0 );
	vec3 pgN = objectNormal;
	#ifdef USE_INSTANCING
		pgWp = instanceMatrix * pgWp;
		pgN = mat3( instanceMatrix ) * pgN;
	#endif
	pgWp = modelMatrix * pgWp;
	vPgWorld = pgWp.xyz;
	vPgNormal = normalize( mat3( modelMatrix ) * pgN );
	#ifdef PG_USE_DATA
		#ifdef PG_WINMOD
			vPgData = vec4( aData.x, pgStyle, aInst.zw );
			vPgTint = aInstB.rgb;
		#else
			vPgData = aData;
		#endif
	#endif
	#if defined( PG_SHOP ) || defined( PG_TOWER ) || defined( PG_WINMOD )
		vPgUv = uv;
	#endif
`;

// Leaves move a little in the wind (aData.x = how much this vertex may move).
const PG_VERTEX_WIND = /* glsl */ `
#ifdef PG_FOLIAGE
	#ifdef USE_INSTANCING
		float pgPhase = instanceMatrix[ 3 ].x * 0.37 + instanceMatrix[ 3 ].z * 0.23;
	#else
		float pgPhase = 0.0;
	#endif
	float pgSway = aData.x;
	transformed.x += sin( uPgTime * 1.1 + pgPhase + position.y * 0.6 ) * 0.07 * pgSway;
	transformed.z += cos( uPgTime * 0.83 + pgPhase * 1.7 + position.x * 0.5 ) * 0.06 * pgSway;
	transformed.y += sin( uPgTime * 1.9 + pgPhase + position.x * 1.3 + position.z ) * 0.025 * pgSway;
#endif
`;

const PG_FRAGMENT_PARS = /* glsl */ `
uniform float uPgTime;
uniform float uPgWet;
uniform float uPgNight;
uniform float uPgWinLight;
uniform float uPgDay;
uniform sampler2D uPgNoise;
uniform sampler2D uPgLightMap;
uniform vec4 uPgLightRect;
uniform vec3 uPgLightColA;
uniform vec3 uPgLightColB;
uniform vec3 uPgPlayer;
uniform float uPgShoreZ;
varying vec3 vPgWorld;
varying vec3 vPgNormal;
#ifdef PG_USE_DATA
	#if defined( PG_SHOP ) || defined( PG_WINMOD )
		flat varying vec4 vPgData;
	#else
		varying vec4 vPgData;
	#endif
#endif
#if defined( PG_SHOP ) || defined( PG_TOWER ) || defined( PG_WINMOD )
	varying vec2 vPgUv;
#endif
#ifdef PG_WINMOD
	varying vec3 vPgTint;
#endif
#ifdef PG_CRACKS
	uniform sampler2D uPgDetail;
#endif
#ifdef PG_OCEAN
	uniform sampler2D uPgWaterNormal;
#endif

float pgHash( vec2 p ) {
	return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}

// Lamp light stored in a top-down picture: r = orange lamps, g = white lamps and shops.
vec3 pgLampTexel( vec2 xz ) {
	return texture2D( uPgLightMap, ( xz - uPgLightRect.xy ) * uPgLightRect.zw ).rgb;
}
// Real point lights already light the area near the player, so the fake
// orange lamp light is turned down there (no double brightness).
vec3 pgLampColor( vec3 lm, vec2 xz ) {
	float nearPlayer = 1.0 - smoothstep( 16.0, 38.0, distance( xz, uPgPlayer.xz ) );
	return ( lm.r * ( 1.0 - 0.65 * nearPlayer ) * uPgLightColA + lm.g * uPgLightColB ) * uPgNight;
}

// Soft-edged rectangle: 1 inside a..b, 0 outside. aa = blur width.
float pgRect( vec2 p, vec2 a, vec2 b, vec2 aa ) {
	vec2 s = smoothstep( a - aa, a + aa, p ) - smoothstep( b - aa, b + aa, p );
	return s.x * s.y;
}

// 1 between a and b, 0 outside (one direction only). aa = blur width.
float pgRect1( float x, float a, float b, float aa ) {
	return smoothstep( a - aa, a + aa, x ) - smoothstep( b - aa, b + aa, x );
}

#if defined( PG_WINDOWS ) || defined( PG_WINMOD ) || defined( PG_GLASS )
uniform sampler2D uPgWinAtlas;
uniform sampler2D uPgWinLit;
const vec4 PG_WIN1 = ${glslVec4(WINDOW_STYLES[1])};
const vec4 PG_WIN2 = ${glslVec4(WINDOW_STYLES[2])};
const vec4 PG_WIN3 = ${glslVec4(WINDOW_STYLES[3])};

// Random number 0..1 for a facade cell, made with whole-number math. It gives
// exactly the same result in the wall shader and in the 3D window shader, so
// a window keeps its picture and its light when it switches between the two.
float pgCellHash( vec2 cell, float k ) {
	uvec2 q = uvec2( ivec2( cell ) + ivec2( 8192 ) );
	uint h = q.x * 374761393u + q.y * 668265263u + uint( k ) * 2246822519u;
	h = ( h ^ ( h >> 13u ) ) * 1274126177u;
	h = h ^ ( h >> 16u );
	return float( h & 16777215u ) / 16777216.0;
}

// ---------------------------------------------------------------------------
// What one window looks like: frame, glass, curtains, blinds, light at night.
//   uv     = 0..1 across the opening,  gx / gy = change of uv per screen pixel
//   cell   = which window of the facade (whole numbers)
//   style  = 1 wide photo window, 2 tall sash window, 3 office glass
// ---------------------------------------------------------------------------
void pgWindowLook( vec2 uv, vec2 gx, vec2 gy, vec2 cell, float style, out vec3 col, out float glass, out vec3 emit ) {
	float h1 = pgCellHash( cell, 1.0 );
	float h2 = pgCellHash( cell, 2.0 );
	float h3 = pgCellHash( cell, 3.0 );
	vec2 bld = floor( cell / 64.0 );                  // the same for every window of one building
	float hb = pgCellHash( bld, 7.0 );
	vec2 aa = abs( gx ) + abs( gy ) + 0.0006;
	vec2 c = clamp( uv, 0.012, 0.988 );
	vec2 e = min( uv, 1.0 - uv );
	emit = vec3( 0.0 );
	// is the light on? every building has its own share of lit windows
	float lit = step( h2, 0.06 + 0.42 * pgCellHash( bld, 9.0 ) ) * step( h3, uPgWinLight );
	// most rooms are warm, a few have a cold screen glow
	vec3 lamp = ( h1 > 0.86 ? vec3( 0.55, 0.75, 1.15 ) : vec3( 1.0, 0.92, 0.8 ) ) * ( 1.1 + 1.3 * h2 );
	vec2 pick = floor( vec2( h1, fract( h1 * 57.31 ) ) * 8.0 );
	vec2 pick2 = floor( vec2( h3, fract( h3 * 31.7 ) ) * 4.0 );
	if ( style < 1.5 ) {
		// ---- wide window straight from the photo: frame, three panes, curtains ----
		vec4 wt = textureGrad( uPgWinAtlas, ( pick + c ) / 8.0, gx / 8.0, gy / 8.0 );
		col = wt.rgb * mix( 1.0, 0.6, wt.a );
		glass = wt.a;
		if ( lit > 0.5 ) emit = textureGrad( uPgWinLit, ( pick2 + c ) / 4.0, gx / 4.0, gy / 4.0 ).rgb * lamp;
	} else if ( style < 2.5 ) {
		// ---- tall sash window: one pane of the photo behind a painted frame ----
		vec2 k = vec2( 0.27, 0.8 );
		vec2 sub = vec2( 0.045 + 0.315 * floor( h3 * 2.999 ), 0.1 ) + c * k;
		vec4 wt = textureGrad( uPgWinAtlas, ( pick + sub ) / 8.0, gx * k / 8.0, gy * k / 8.0 );
		col = wt.rgb * mix( 1.0, 0.6, wt.a );
		glass = wt.a;
		float fr = 1.0 - smoothstep( 0.07 - aa.x, 0.07 + aa.x, e.x ) * smoothstep( 0.042 - aa.y, 0.042 + aa.y, e.y );
		fr = max( fr, 1.0 - smoothstep( 0.02 - aa.y, 0.02 + aa.y, abs( uv.y - 0.5 ) ) );   // bar across the middle
		vec3 frame = hb < 0.42 ? vec3( 0.72, 0.7, 0.64 ) : hb < 0.62 ? vec3( 0.05, 0.05, 0.055 )
			: hb < 0.82 ? vec3( 0.17, 0.1, 0.07 ) : vec3( 0.07, 0.13, 0.11 );
		col = mix( col, frame, fr );
		glass *= 1.0 - fr;
		if ( lit > 0.5 ) emit = textureGrad( uPgWinLit, ( pick2 + sub ) / 4.0, gx * k / 4.0, gy * k / 4.0 ).rgb * lamp * ( 1.0 - fr );
	} else {
		// ---- office glass: dark tinted pane, thin frame, some blinds ----
		float fr = 1.0 - smoothstep( 0.022 - aa.x, 0.022 + aa.x, e.x ) * smoothstep( 0.03 - aa.y, 0.03 + aa.y, e.y );
		fr = max( fr, 1.0 - smoothstep( 0.011 - aa.x, 0.011 + aa.x, abs( uv.x - 0.5 ) ) );  // post in the middle
		vec3 tintG = mix( vec3( 0.022, 0.04, 0.05 ), vec3( 0.05, 0.042, 0.03 ), step( 0.6, hb ) );
		col = tintG * ( 0.7 + 0.6 * uv.y );
		glass = 1.0;
		// blinds pulled down to a random height
		float blindH = h1 < 0.5 ? 0.0 : 0.15 + 0.8 * fract( h1 * 13.7 );
		float inBlind = smoothstep( 1.0 - blindH - aa.y, 1.0 - blindH + aa.y, uv.y ) * step( 0.001, blindH );
		float slats = mix( 0.88, 0.76 + 0.24 * sin( uv.y * 190.0 ), clamp( 1.0 - aa.y * 60.0, 0.0, 1.0 ) );
		col = mix( col, vec3( 0.5, 0.5, 0.47 ) * slats, inBlind * 0.9 );
		glass *= 1.0 - inBlind * 0.7;
		col = mix( col, vec3( 0.05, 0.055, 0.06 ), fr );
		glass *= 1.0 - fr;
		if ( lit > 0.5 ) {
			// ceiling lights seen through the glass
			float panels = 0.55 + 0.45 * smoothstep( 0.55, 0.8, uv.y ) * ( 0.6 + 0.4 * sin( uv.x * 25.0 ) );
			vec3 office = h1 > 0.7 ? vec3( 1.0, 0.86, 0.66 ) : vec3( 0.82, 0.92, 1.0 );
			emit = office * panels * ( 0.5 + 0.7 * h2 ) * ( 1.0 - fr ) * mix( 1.0, 0.55, inBlind );
		}
	}
}
#endif

#ifdef PG_SHOP
// ---------------------------------------------------------------------------
// Ground floor shop fronts are drawn by math, so they stay sharp up close.
//   p    = position on the opening in meters (x across, y up)
//   size = width and height of the opening in meters
//   type = 0 glass shop, 1 roller shutter, 2 door, 3 garage door
// ---------------------------------------------------------------------------
void pgShopFront( vec2 p, vec2 size, float type, float seed,
	out vec3 alb, out float rough, out float metal, out float glass, out float ridge ) {
	vec2 aa = fwidth( p ) + 0.0008;
	float h1 = pgHash( vec2( seed * 91.7, 3.1 ) );
	float h2 = pgHash( vec2( seed * 37.3, 7.7 ) );
	float h3 = pgHash( vec2( seed * 13.9, 5.3 ) );
	glass = 0.0;
	ridge = 0.0;
	if ( type < 0.5 ) {
		// ---- glass shop front: frame, low wall, door, big panes ----
		vec3 frame = h1 < 0.3 ? vec3( 0.03, 0.03, 0.034 ) : h1 < 0.55 ? vec3( 0.12, 0.085, 0.06 )
			: h1 < 0.75 ? vec3( 0.42, 0.43, 0.44 ) : h1 < 0.9 ? vec3( 0.5, 0.48, 0.43 ) : vec3( 0.07, 0.14, 0.11 );
		alb = frame;
		rough = 0.6;
		metal = ( h1 > 0.55 && h1 < 0.75 ) ? 0.6 : 0.1;
		float fw = 0.065;
		float plinthH = 0.32 + 0.3 * h2;
		float transomY = min( 2.38, size.y - 0.35 );
		float doorW = min( 1.0, size.x * 0.4 );
		float doorX = h3 < 0.5 ? 0.1 : size.x - 0.1 - doorW;
		float n = max( 1.0, floor( size.x / 1.9 + 0.5 ) );
		float colW = size.x / n;
		vec2 q = vec2( mod( p.x, colW ), p.y );
		float pane = pgRect( q, vec2( fw, plinthH + fw ), vec2( colW - fw, size.y - fw ), aa );
		pane *= 1.0 - pgRect( p, vec2( - 1.0, transomY - fw * 0.5 ), vec2( size.x + 1.0, transomY + fw * 0.5 ), aa );
		float inDoor = pgRect( p, vec2( doorX, - 1.0 ), vec2( doorX + doorW, transomY ), aa );
		float doorGlass = pgRect( p, vec2( doorX + 0.08, 0.28 ), vec2( doorX + doorW - 0.08, transomY - 0.08 ), aa );
		doorGlass *= 1.0 - pgRect( p, vec2( doorX + 0.1, 1.0 ), vec2( doorX + doorW - 0.1, 1.06 ), aa ); // push bar
		pane = mix( pane, doorGlass, inDoor );
		float plinth = ( 1.0 - inDoor ) * ( 1.0 - smoothstep( plinthH - aa.y, plinthH + aa.y, p.y ) );
		vec3 plinthCol = mix( frame * 1.5 + 0.02, vec3( 0.2, 0.19, 0.18 ), 0.55 );
		alb = mix( alb, plinthCol, plinth );
		rough = mix( rough, 0.75, plinth );
		metal *= 1.0 - plinth;
		glass = pane;
	} else if ( type < 1.5 ) {
		// ---- roller shutter: rounded metal slats ----
		vec3 base = h1 < 0.4 ? vec3( 0.36, 0.37, 0.38 ) : h1 < 0.6 ? vec3( 0.1, 0.17, 0.14 )
			: h1 < 0.8 ? vec3( 0.13, 0.17, 0.25 ) : vec3( 0.3, 0.22, 0.15 );
		float slat = fract( p.y / 0.085 );
		ridge = cos( slat * 3.14159 );
		alb = base * ( 0.8 + 0.2 * sin( slat * 3.14159 ) );
		rough = 0.48;
		metal = h1 < 0.4 ? 0.85 : 0.35;
		float flatPart = 1.0 - pgRect( p, vec2( 0.07, 0.11 ), vec2( size.x - 0.07, size.y - 0.28 ), aa );
		alb = mix( alb, base * 0.7, flatPart );
		ridge *= 1.0 - flatPart;
		// a little street dust near the bottom
		float dirt = texture2D( uPgNoise, p * vec2( 0.31, 0.07 ) + seed ).a;
		alb = mix( alb, vec3( 0.2, 0.19, 0.18 ), smoothstep( 0.55, 0.95, dirt + ( 1.0 - p.y / size.y ) * 0.3 ) * 0.3 );
	} else if ( type < 2.5 ) {
		// ---- plain door with a small window above ----
		vec3 base = h1 < 0.35 ? vec3( 0.13, 0.05, 0.04 ) : h1 < 0.6 ? vec3( 0.06, 0.09, 0.13 )
			: h1 < 0.8 ? vec3( 0.07, 0.07, 0.075 ) : vec3( 0.2, 0.16, 0.11 );
		float leafTop = min( 2.15, size.y - 0.4 );
		float leaf = pgRect( p, vec2( 0.07, - 1.0 ), vec2( size.x - 0.07, leafTop ), aa );
		alb = mix( base * 0.55, base, leaf );
		// two sunken panels
		float pnl = pgRect( p, vec2( 0.2, 0.22 ), vec2( size.x - 0.2, 0.95 ), aa * 3.0 )
			+ pgRect( p, vec2( 0.2, 1.12 ), vec2( size.x - 0.2, leafTop - 0.22 ), aa * 3.0 );
		alb *= 1.0 - 0.22 * pnl * leaf;
		float handle = pgRect( p, vec2( size.x - 0.2, 0.98 ), vec2( size.x - 0.14, 1.12 ), aa );
		alb = mix( alb, vec3( 0.55 ), handle );
		rough = mix( 0.5, 0.3, handle );
		metal = handle * 0.9;
		glass = pgRect( p, vec2( 0.12, leafTop + 0.07 ), vec2( size.x - 0.12, size.y - 0.07 ), aa );
	} else {
		// ---- garage door made of wide panels ----
		vec3 base = h1 < 0.5 ? vec3( 0.4, 0.4, 0.38 ) : h1 < 0.75 ? vec3( 0.26, 0.24, 0.2 ) : vec3( 0.12, 0.15, 0.17 );
		float seg = fract( p.y / 0.52 );
		float groove = smoothstep( 0.0, 0.05, seg ) * ( 1.0 - smoothstep( 0.95, 1.0, seg ) );
		alb = base * ( 0.72 + 0.28 * groove );
		ridge = ( 1.0 - groove ) * 0.6;
		rough = 0.55;
		metal = 0.5;
		// a row of small windows near the top
		float wy = floor( ( size.y - 0.3 ) / 0.52 ) * 0.52 - 0.52;
		float cw = size.x / max( 2.0, floor( size.x / 0.9 ) );
		vec2 q = vec2( mod( p.x, cw ), p.y );
		glass = pgRect( q, vec2( 0.12, wy + 0.12 ), vec2( cw - 0.12, wy + 0.4 ), aa );
		float dirt = texture2D( uPgNoise, p * vec2( 0.27, 0.06 ) + seed ).a;
		alb *= 1.0 - 0.35 * smoothstep( 0.55, 0.95, dirt );
	}
	alb = mix( alb, vec3( 0.012 ), glass );
	rough = mix( rough, 0.05, glass );
	metal *= 1.0 - glass;
}

// What you see through a shop window: a fake room with real depth
// ("interior mapping"). Returns the light coming out of the room.
vec3 pgShopInterior( vec2 p, vec2 size, float seed, float lit ) {
	vec3 V = normalize( cameraPosition - vPgWorld );
	vec3 N = normalize( vPgNormal );
	vec3 T = normalize( cross( vec3( 0.0, 1.0, 0.0 ), N ) );
	// view ray in wall space: x along the wall, y up, z out of the wall
	vec3 d = - vec3( dot( V, T ), V.y, dot( V, N ) );
	d.z = min( d.z, - 0.05 );
	float depth = 3.5 + 2.0 * pgHash( vec2( seed, 1.7 ) );
	float roomH = size.y + 0.35;
	float tBack = depth / ( - d.z );
	float tX = d.x > 0.0 ? ( size.x - p.x ) / max( d.x, 1e-4 ) : p.x / max( - d.x, 1e-4 );
	float tY = d.y > 0.0 ? ( roomH - p.y ) / max( d.y, 1e-4 ) : p.y / max( - d.y, 1e-4 );
	float t = min( tBack, min( tX, tY ) );
	vec3 hit = vec3( p, 0.0 ) + d * t;
	float hue = pgHash( vec2( seed, 9.3 ) );
	vec3 wall = hue < 0.33 ? vec3( 0.55, 0.5, 0.42 ) : hue < 0.66 ? vec3( 0.42, 0.5, 0.5 ) : vec3( 0.56, 0.54, 0.5 );
	vec3 col;
	if ( t == tBack ) {
		// back wall with shelves of boxes
		vec2 cell = floor( vec2( hit.x / 0.42, hit.y / 0.46 ) );
		float shelf = smoothstep( 0.0, 0.06, fract( hit.y / 0.46 ) );
		float k = pgHash( cell + seed * 7.0 );
		vec3 item = mix( wall, 0.2 + 0.5 * vec3( pgHash( cell + 1.3 ), pgHash( cell + 4.1 ), pgHash( cell + 8.7 ) ), 0.55 );
		// far away the small boxes would flicker: blend them into one calm color
		float sharp = clamp( 1.0 - fwidth( hit.x ) * 5.0, 0.0, 1.0 );
		col = mix( wall, item, step( 0.35, k ) * step( hit.y, 2.3 ) ) * ( 0.35 + 0.65 * shelf );
		col = mix( wall * 0.62, col, sharp );
	} else if ( t == tY ) {
		// ceiling with light panels, or dark floor
		float lights = smoothstep( 0.6, 0.8, sin( hit.z * 2.4 ) * 0.5 + 0.5 );
		col = d.y > 0.0 ? mix( wall * 0.8, vec3( 3.2, 3.0, 2.6 ), lights * lit ) : vec3( 0.16, 0.15, 0.13 );
	} else {
		col = wall * 0.75; // side walls
	}
	col *= exp( - t * 0.1 );
	// lit shops are brighter near the ceiling lamps
	col *= mix( 1.0, 0.55 + 0.75 * smoothstep( 0.0, roomH, hit.y ), lit );
	// warm or cool lamps inside
	vec3 lamp = pgHash( vec2( seed, 5.5 ) ) < 0.65 ? vec3( 1.0, 0.82, 0.6 ) : vec3( 0.8, 0.92, 1.0 );
	return col * mix( vec3( 1.0 ), lamp, lit );
}
#endif
`;

// Texture lookup for surfaces that repeat a lot: blend with a second, turned
// and shifted copy so the pattern never lines up in rows.
const PG_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef PG_ANTITILE
		vec4 pgAlt = texture2D( map, vMapUv.yx * 0.83 + vec2( 0.37, 0.61 ) );
		float pgSel = texture2D( uPgNoise, vPgWorld.xz * 0.029 + 0.13 ).b;
		sampledDiffuseColor = mix( sampledDiffuseColor, pgAlt, smoothstep( 0.4, 0.6, pgSel ) );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif
`;

// ---- A: color ----------------------------------------------------------------
const PG_FRAGMENT_COLOR = /* glsl */ `
	float pgPud = 0.0;     // puddle amount
	float pgDamp = 0.0;    // wetness amount
	float pgWin = 0.0;     // 1 on a window
	float pgGlass = 0.0;   // 1 on shiny glass
	float pgRidge = 0.0;   // bump for shutters and metal sheets
	float pgFlat = 0.0;    // 1 where the wall bumps are smoothed out (stone trim)
	float pgAge = 0.0;     // how old and worn this building is
	float pgRoofDist = - 1.0;
	float pgRust = 0.0;
	float pgPanelRough = 0.6;
	float pgPanelMetal = 0.0;
	vec3 pgEmitA = vec3( 0.0 );   // light that is also given off by day
	vec4 pgN1 = vec4( 0.5 );
	vec4 pgN2 = vec4( 0.5 );
	vec3 pgEmit = vec3( 0.0 );
	vec3 pgLm = vec3( 0.0 );

#if defined( PG_GROUND ) || defined( PG_DECAL )
	{
		vec2 xz = vPgWorld.xz;
		vec4 n1 = texture2D( uPgNoise, xz * 0.0113 );
		vec4 n2 = texture2D( uPgNoise, xz * 0.047 + 0.31 );
		pgLm = pgLampTexel( xz );
		#ifdef PG_GROUND
			// big soft light/dark areas and a slight warm/cool shift
			diffuseColor.rgb *= 0.8 + 0.4 * ( n1.r * 0.6 + n2.g * 0.4 );
			diffuseColor.rgb *= mix( vec3( 1.03, 1.0, 0.96 ), vec3( 0.97, 1.0, 1.04 ), n1.b );
		#endif
		float flatness = smoothstep( 0.75, 0.97, vPgNormal.y );
		float wet = uPgWet;
		#ifdef PG_BEACH
			// sand near the water line is always wet
			float shore = 1.0 - smoothstep( 1.0, 13.0 + 5.0 * n2.r, vPgWorld.z - uPgShoreZ );
			wet = max( wet, shore );
			pgPud = shore * shore * 0.55;
		#endif
		if ( wet > 0.001 ) {
			vec4 n3 = texture2D( uPgNoise, xz * 0.105 + 0.71 );
			pgDamp = wet * ( 0.7 + 0.3 * n2.g ) * flatness;
			// puddles collect in low spots; pgLm.b marks gutters along the curbs
			float low = n3.r * 0.55 + n2.b * 0.45 + pgLm.b * 0.3;
			#ifndef PG_BEACH
				pgPud = smoothstep( 0.64, 0.72, low + ( uPgWet - 1.0 ) * 0.3 ) * flatness;
			#endif
			diffuseColor.rgb *= mix( 1.0, 0.6, pgDamp );
			diffuseColor.rgb *= mix( 1.0, 0.6, pgPud );
		}
	}
#endif

#ifdef PG_WALL
	{
		// vPgData.w = age of the building: 0 = new and clean, 1 = old and worn
		#ifdef PG_WINDOWS
			pgAge = clamp( vPgData.w, 0.0, 1.0 );
			// vertex alpha of building walls = 2 + meters below the roof edge
			#ifdef USE_COLOR_ALPHA
				if ( vColor.a > 1.5 ) pgRoofDist = vColor.a - 2.0;
			#endif
		#endif
		// position on the wall: x runs along the wall (any direction), y is up
		vec2 wc = vec2( dot( vPgWorld.xz, vec2( - vPgNormal.z, vPgNormal.x ) ), vPgWorld.y );
		pgN1 = texture2D( uPgNoise, wc * 0.021 );
		pgN2 = texture2D( uPgNoise, wc * 0.113 + 0.5 );
		vec4 n1 = pgN1;
		vec4 n2 = pgN2;
		diffuseColor.rgb *= 0.84 + 0.32 * ( n1.r * 0.6 + n2.g * 0.4 );
		// old paint fades in patches: less color and a little lighter
		float fade = pgAge * smoothstep( 0.3, 0.8, n1.b * 0.55 + n2.r * 0.45 + pgAge * 0.2 );
		float lum = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( lum * 1.1 + 0.012 ), fade * 0.45 );
		// dark streaks where rain water runs down (stronger on old walls)
		float streak = smoothstep( 0.62, 0.95, n2.a ) * ( 0.4 + 0.6 * n1.b );
		diffuseColor.rgb *= 1.0 - ( 0.12 + 0.24 * pgAge ) * streak;
		// dirty stripes hanging down from the roof edge
		if ( pgRoofDist >= 0.0 ) {
			float under = exp( - pgRoofDist / ( 0.35 + 2.4 * n2.a * n2.a ) );
			diffuseColor.rgb *= 1.0 - under * ( 0.1 + 0.42 * pgAge ) * ( 0.45 + 0.55 * n2.g );
		}
		// grime near the ground, with a ragged upper edge
		float grime = smoothstep( 0.0, 1.0, ( vPgWorld.y - 0.05 ) / ( 0.6 + ( 1.0 + 2.6 * pgAge ) * n2.r ) );
		diffuseColor.rgb *= mix( vec3( 0.46, 0.44, 0.41 ), vec3( 1.0 ), grime );
		// green-black moss where old walls stay damp (low down)
		float moss = pgAge * ( 1.0 - smoothstep( 0.2, 2.8, vPgWorld.y ) ) * smoothstep( 0.5, 0.78, n1.g * 0.5 + n2.b * 0.5 );
		diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.52, 0.64, 0.4 ), moss * 0.75 );
		#ifdef PG_CRACKS
			// hairline cracks and small pits in old plaster
			vec4 dt = texture2D( uPgDetail, wc * 0.21 );
			float crackArea = smoothstep( 0.5, 0.78, n1.r * 0.5 + n2.b * 0.5 + pgAge * 0.4 - 0.22 );
			float pgClose = 1.0 - smoothstep( 25.0, 70.0, length( vPgWorld - cameraPosition ) );
			diffuseColor.rgb *= 1.0 - ( dt.r * 0.42 + dt.b * 0.1 ) * crackArea * pgAge * pgClose;
		#endif
		#ifdef PG_METAL
			// corrugated metal sheets: one rib every 19 cm
			float ribs = wc.x / 0.19;
			float fr = fract( ribs );
			float ribFade = clamp( 1.0 - fwidth( ribs ) * 1.7, 0.0, 1.0 ); // far away the ribs blend into a flat sheet
			pgRidge = cos( fr * 6.2832 ) * ribFade;
			diffuseColor.rgb *= 1.0 - 0.16 * ( 0.5 - 0.5 * sin( fr * 6.2832 ) ) * ribFade;
			// rust runs down the sheets and creeps up from the ground
			float rust = smoothstep( 0.55, 0.92, n2.a * 0.6 + n1.b * 0.4 + pgAge * 0.45 - 0.2 ) * pgAge;
			rust = max( rust, pgAge * 0.85 * ( 1.0 - smoothstep( 0.0, 0.35 + 1.6 * n2.r, vPgWorld.y ) ) );
			diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.21, 0.09, 0.045 ) * ( 0.6 + 0.8 * n2.g ), rust * 0.75 );
			pgRust = rust;
		#endif
		// rain makes walls a little darker too
		diffuseColor.rgb *= 1.0 - 0.22 * uPgWet * n1.g;
	}
#endif

#ifdef PG_WINDOWS
	{
		// vPgData.xy counts window bays across and floors up.
		// vPgData.z = style of the windows (0 none, 1 wide, 2 sash, 3 office, 4 corner stones)
		//             + 8 when every floor has a thin ledge
		float pgMode = floor( vPgData.z + 0.5 );
		float pgBand = step( 7.5, pgMode );
		float pgStyle = pgMode - pgBand * 8.0;
		vec2 g = vPgData.xy;
		vec2 cell = floor( g );
		vec2 f = g - cell;
		vec2 fwG = fwidth( g ) + 0.0005;
		if ( pgBand > 0.5 ) {
			// shaded line where the ledge is (the real ledge is added near the player)
			float d = min( f.y, 1.0 - f.y );
			diffuseColor.rgb *= 1.0 - 0.3 * ( 1.0 - smoothstep( 0.02, 0.02 + fwG.y * 1.5, d ) );
		}
		if ( pgStyle > 3.5 ) {
			// ---- corner stones (quoins): a long block, then a short one, and so on ----
			float isLong = step( 0.5, mod( cell.y, 2.0 ) );
			float limit = mix( 0.6, 2.0, isLong );
			float inBlock = 1.0 - smoothstep( limit - fwG.x, limit + fwG.x, f.x );
			float joint = smoothstep( 0.0, 0.035 + fwG.y, min( f.y, 1.0 - f.y ) );
			vec3 stone = vec3( 0.56, 0.54, 0.49 ) * ( 0.8 + 0.3 * pgHash( vec2( cell.y, 3.0 ) ) ) * ( 0.85 + 0.3 * pgN2.g );
			diffuseColor.rgb = mix( diffuseColor.rgb, stone * mix( 0.55, 1.0, joint ) * ( 1.0 - 0.3 * pgAge * pgN2.a ), inBlock * 0.94 );
			pgFlat = inBlock;
		} else if ( pgStyle > 0.5 ) {
			vec4 r = pgStyle < 1.5 ? PG_WIN1 : pgStyle < 2.5 ? PG_WIN2 : PG_WIN3;
			vec2 w = ( f - r.xy ) / r.zw;              // 0..1 inside the window
			vec2 fw = fwG / r.zw;
			vec2 edge = min( w, 1.0 - w );
			vec2 m2 = smoothstep( vec2( 0.0 ), fw * 1.2 + 0.002, edge );
			float m = m2.x * m2.y;
			#ifndef PG_METAL
			if ( pgStyle < 2.5 ) {
				// stone sill under the window (and on brick walls a stone lintel above it)
				float trim = pgRect1( f.x, r.x - 0.03, r.x + r.z + 0.03, fwG.x ) * pgRect1( f.y, r.y - 0.026, r.y, fwG.y );
				#ifdef PG_BRICK
					trim = max( trim, pgRect1( f.x, r.x - 0.045, r.x + r.z + 0.045, fwG.x ) * pgRect1( f.y, r.y + r.w, r.y + r.w + 0.066, fwG.y ) );
				#endif
				diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.56, 0.54, 0.5 ) * ( 0.8 + 0.35 * pgN2.g ), trim * 0.92 );
				pgFlat = trim;
				// dirty water marks below the window, strongest under its two corners
				float below = r.y - 0.026 - f.y;
				if ( below > 0.0 ) {
					float corners = max( exp( - abs( f.x - r.x + 0.03 ) * 30.0 ), exp( - abs( f.x - r.x - r.z - 0.03 ) * 30.0 ) );
					float under = pgRect1( f.x, r.x - 0.03, r.x + r.z + 0.03, 0.02 ) * exp( - below * 6.0 );
					float st = ( 0.3 * under + 0.7 * corners * exp( - below * 3.0 ) ) * ( 0.25 + 0.75 * pgAge ) * ( 0.5 + 0.5 * pgN2.a );
					diffuseColor.rgb *= 1.0 - st * 0.55;
				}
			}
			#endif
			if ( pgStyle > 2.5 ) {
				// office front: the glass runs up the facade in strips. Between the
				// floors the strip is a dark glass panel.
				float strip = pgRect1( f.x, r.x, r.x + r.z, fwG.x ) * ( 1.0 - m );
				vec3 panel = mix( vec3( 0.04, 0.055, 0.065 ), vec3( 0.06, 0.052, 0.04 ), step( 0.6, pgCellHash( floor( cell / 64.0 ), 7.0 ) ) );
				diffuseColor.rgb = mix( diffuseColor.rgb, panel, strip );
				pgWin = strip;
				pgGlass = strip * 0.75;
			}
			if ( m > 0.0 ) {
				vec3 col; float glass; vec3 emit;
				pgWindowLook( w, dFdx( g ) / r.zw, dFdy( g ) / r.zw, cell, pgStyle, col, glass, emit );
				// the window sits a little inside the wall: shade the top and the sides
				float reveal = smoothstep( 0.0, 0.09, 1.0 - w.y ) * smoothstep( 0.0, 0.035, edge.x );
				diffuseColor.rgb = mix( diffuseColor.rgb, col * mix( 0.5, 1.0, reveal ), m );
				pgWin = max( pgWin, m );
				pgGlass = mix( pgGlass, glass, m );
				pgEmit += emit * m;
			}
		}
	}
#endif

#ifdef PG_WINMOD
	{
		// one of the 3D windows near the player. vPgData = ( part, style, cell across, cell up )
		float part = vPgData.x;
		if ( part < 0.5 ) {
			vec3 col; float glass; vec3 emit;
			pgWindowLook( vPgUv, dFdx( vPgUv ), dFdy( vPgUv ), vPgData.zw, vPgData.y, col, glass, emit );
			// soft shadow of the wall above and beside the glass
			vec2 e = min( vPgUv, 1.0 - vPgUv );
			float sh = mix( 0.5, 1.0, smoothstep( 0.0, 0.2, 1.0 - vPgUv.y ) ) * mix( 0.72, 1.0, smoothstep( 0.0, 0.07, e.x ) );
			diffuseColor.rgb = col * sh;
			pgWin = 1.0;
			pgGlass = glass;
			pgEmit += emit;
		} else {
			float n = texture2D( uPgNoise, vPgWorld.xy * 0.37 + vPgWorld.z * 0.29 ).g;
			// sides of the opening have the wall color; sills and lintels are stone
			vec3 stone = vec3( 0.56, 0.54, 0.5 );
			vec3 base = part < 1.5 ? vPgTint : part < 3.5 ? stone : mix( stone, vPgTint * 1.3, 0.7 );
			diffuseColor.rgb *= base * ( 0.8 + 0.35 * n );
		}
	}
#endif

#ifdef PG_GLASS
	{
		// GLASS CURTAIN WALL. vPgData = ( bay number, floor number, kind, building seed )
		//   kind 0 = curtain wall,  1 = lobby (tall lit panes),  2 = veil (glass printed with fine light lines)
		vec2 g = vPgData.xy;
		vec2 cell = floor( g );
		vec2 f = g - cell;
		vec2 fw = fwidth( g ) + 0.0004;
		float kind = floor( vPgData.z + 0.5 );
		float lobby = step( 0.5, kind ) * ( 1.0 - step( 1.5, kind ) );
		float seed = vPgData.w;
		float h1 = pgCellHash( cell, 1.0 );
		float h2 = pgCellHash( cell, 2.0 );
		float h3 = pgCellHash( cell, 3.0 );
		vec3 tint = diffuseColor.rgb;
		// far away the thin lines would flicker: blend them into the glass
		float fadeX = clamp( 1.0 - fw.x * 3.0, 0.0, 1.0 );
		float fadeY = clamp( 1.0 - fw.y * 2.0, 0.0, 1.0 );
		// a thin upright bar at every bay, a floor plate at every floor
		float bar = ( 1.0 - smoothstep( 0.03, 0.03 + fw.x * 1.5, min( f.x, 1.0 - f.x ) ) ) * fadeX;
		float plateH = mix( 0.13, 0.05, lobby );
		float plate = ( 1.0 - smoothstep( plateH, plateH + fw.y * 1.5, f.y ) ) * mix( 0.45, 1.0, fadeY );
		// every pane is a little different; some have a light blind pulled down
		vec3 pane = tint * ( 0.8 + 0.4 * h1 );
		float blindH = h2 > 0.72 ? 0.2 + 0.6 * fract( h2 * 9.7 ) : 0.0;
		float blind = smoothstep( 1.0 - blindH - fw.y, 1.0 - blindH + fw.y, f.y ) * step( 0.001, blindH ) * fadeY * ( 1.0 - step( 0.5, kind ) );
		pane = mix( pane, vec3( 0.4, 0.41, 0.4 ), blind * 0.85 );
		float glassy = 1.0 - blind * 0.8;
		if ( kind > 1.5 ) {
			float lines = 0.5 + 0.5 * sin( g.x * 31.416 );
			pane = mix( pane, vec3( 0.46, 0.48, 0.5 ), 0.42 + 0.26 * lines * fadeX );
			glassy = 0.4;
		}
		// frames: light metal on most buildings, dark on some
		vec3 frame = fract( seed * 7.31 ) < 0.62 ? vec3( 0.48, 0.5, 0.52 ) : vec3( 0.045, 0.05, 0.055 );
		float fr = max( bar, plate );
		// rain leaves faint streaks on the glass too
		float streak = texture2D( uPgNoise, vec2( g.x * 0.11, vPgWorld.y * 0.012 ) ).a;
		diffuseColor.rgb = mix( pane, frame, fr ) * ( 1.0 - 0.1 * smoothstep( 0.6, 0.95, streak ) );
		pgGlass = glassy * ( 1.0 - fr );
		// rooms with the light on: most only at night, a few glow all day
		float share = 0.1 + 0.35 * fract( seed * 3.7 ) + 0.5 * lobby;
		float mine = step( h2, share );
		float room = ( 0.5 + 0.5 * smoothstep( 0.15, 0.95, f.y ) ) * ( 1.0 - blind * 0.5 ) * ( 1.0 - fr ) * ( 0.45 + 0.6 * h1 );
		vec3 warm = h1 > 0.82 ? vec3( 0.7, 0.82, 1.0 ) : vec3( 1.0, 0.78, 0.5 );
		pgEmit += warm * room * mine * step( h3, uPgWinLight ) * ( 1.0 + 0.5 * lobby );
		pgEmitA += warm * room * mine * step( h3, 0.07 + 0.3 * lobby ) * ( 0.22 + 0.3 * lobby ) * uPgDay;
	}
#endif

#ifdef PG_PANEL
	{
		// PANELS: frames, ribbons, slabs, roofs. vPgData = ( kind, roughness, metalness, glow )
		//   kind 0 smooth, 1 perforated metal, 2 upright slats, 3 standing seam metal, 4 solar cells, 5 pool water
		float kind = floor( vPgData.x + 0.5 );
		vec3 N = normalize( vPgNormal );
		float flatFace = step( 0.7, abs( N.y ) );
		// position on the surface in meters: along the wall + up, or x + z on flat faces
		vec2 wc = flatFace > 0.5 ? vPgWorld.xz : vec2( dot( vPgWorld.xz, normalize( vec2( - N.z, N.x ) + vec2( 1e-5 ) ) ), vPgWorld.y );
		vec4 n1 = texture2D( uPgNoise, wc * 0.023 );
		vec4 n2 = texture2D( uPgNoise, wc * 0.11 + 0.37 );
		pgPanelRough = vPgData.y;
		pgPanelMetal = vPgData.z;
		// nothing is perfectly clean: soft dust, and rain streaks on upright faces
		diffuseColor.rgb *= 0.9 + 0.2 * n1.r;
		diffuseColor.rgb *= 1.0 - ( 1.0 - flatFace ) * 0.17 * smoothstep( 0.6, 0.95, n2.a ) * ( 0.4 + 0.6 * n1.b );
		diffuseColor.rgb *= 1.0 - flatFace * 0.1 * n2.g;
		if ( kind > 0.5 && kind < 1.5 ) {
			// perforated metal: rows of small round holes
			vec2 p = wc / 0.12;
			float fwp = fwidth( p.x ) + fwidth( p.y );
			float hole = 1.0 - smoothstep( 0.25, 0.25 + fwp, length( fract( p ) - 0.5 ) );
			diffuseColor.rgb *= mix( 0.74, 1.0 - 0.78 * hole, clamp( 1.0 - fwp * 1.5, 0.0, 1.0 ) );
		} else if ( kind > 1.5 && kind < 2.5 ) {
			// upright slats (wood or bronze), each a slightly different tone
			float sx = wc.x / 0.15;
			float fr = fract( sx );
			float fws = fwidth( sx );
			float fade = clamp( 1.0 - fws * 1.8, 0.0, 1.0 );
			float gap = 1.0 - smoothstep( 0.06, 0.12 + fws, min( fr, 1.0 - fr ) );
			float tone = 0.82 + 0.36 * pgHash( vec2( floor( sx ), 7.0 ) );
			diffuseColor.rgb *= mix( 0.82, tone * ( 1.0 - 0.82 * gap ), fade );
			pgRidge = ( fr - 0.5 ) * 1.6 * fade * ( 1.0 - gap );
		} else if ( kind > 2.5 && kind < 3.5 ) {
			// standing seam metal: a thin raised seam every 45 cm
			float sx = wc.x / 0.45;
			float fr = fract( sx );
			float fws = fwidth( sx );
			float fade = clamp( 1.0 - fws * 1.8, 0.0, 1.0 );
			float seam = ( 1.0 - smoothstep( 0.03, 0.03 + fws, min( fr, 1.0 - fr ) ) ) * fade;
			diffuseColor.rgb *= 1.0 - 0.35 * seam;
			pgRidge = sign( fr - 0.5 ) * seam * 1.2;
		} else if ( kind > 3.5 && kind < 4.5 ) {
			// solar panels: dark blue cells, silver frame around every panel
			vec2 p = wc / vec2( 1.05, 1.75 );
			vec2 fr = fract( p );
			vec2 fwp = fwidth( p );
			vec2 e = min( fr, 1.0 - fr );
			float edge = 1.0 - smoothstep( 0.022, 0.022 + fwp.x, e.x ) * smoothstep( 0.014, 0.014 + fwp.y, e.y );
			edge *= clamp( 1.0 - ( fwp.x + fwp.y ) * 1.2, 0.0, 1.0 );
			vec2 c = fract( wc / 0.175 );
			float cells = ( 1.0 - smoothstep( 0.0, 0.08, min( c.x, c.y ) ) ) * clamp( 1.0 - fwidth( wc.x ) * 9.0, 0.0, 1.0 );
			vec3 cellCol = vec3( 0.012, 0.022, 0.065 ) * ( 0.8 + 0.5 * pgHash( floor( p ) ) ) + 0.02 * cells;
			diffuseColor.rgb = mix( cellCol, vec3( 0.46, 0.48, 0.5 ), edge );
			pgPanelRough = mix( 0.14, 0.4, edge );
			pgPanelMetal = mix( 0.55, 0.8, edge );
		} else if ( kind > 4.5 ) {
			// pool water: clear turquoise with small ripples
			vec2 r1 = texture2D( uPgNoise, wc * 0.5 + vec2( uPgTime * 0.03, uPgTime * 0.02 ) ).rg - 0.5;
			diffuseColor.rgb = vec3( 0.02, 0.2, 0.24 ) * ( 0.85 + 0.5 * n2.g );
			pgRidge = r1.x * 0.7;
			pgPanelRough = 0.05;
			pgPanelMetal = 0.0;
		}
	}
#endif

#ifdef PG_TOWER
	{
		// glass towers: some office floors stay lit at night, most are dark
		vec2 cell = floor( vPgUv * vec2( 5.0, 5.0 ) );
		float h = pgHash( cell );
		float busyFloor = step( pgHash( vec2( cell.y, 3.7 ) ), 0.22 );     // a few floors work late
		float on = step( h, 0.05 + 0.4 * busyFloor ) * step( pgHash( cell + 9.1 ), uPgWinLight * 1.2 );
		vec3 tint = pgHash( cell + 2.3 ) > 0.25 ? vec3( 1.0, 0.82, 0.56 ) : vec3( 0.75, 0.88, 1.0 );
		pgEmit += tint * on * ( 0.3 + 0.4 * h );
	}
#endif

#ifdef PG_SHOP
	vec2 pgShopSize = vPgData.zw;
	vec2 pgShopP = vPgUv * pgShopSize;
	float pgShopSeed = fract( vPgData.y );
	{
		vec3 alb; float rough; float metal;
		pgShopFront( pgShopP, pgShopSize, vPgData.x, vPgData.y, alb, rough, metal, pgGlass, pgRidge );
		// street dirt on the lower part
		float dirt = texture2D( uPgNoise, vec2( vPgWorld.x + vPgWorld.z, vPgWorld.y ) * 0.21 ).g;
		alb *= mix( 0.55 + 0.3 * dirt, 1.0, smoothstep( 0.0, 0.9, vPgWorld.y ) ) * ( 1.0 - pgGlass ) + pgGlass;
		diffuseColor.rgb = alb;
		pgWin = 1.0; // (re-used: the roughness and metal values come from the shop code)
		pgShopRough = rough;
		pgShopMetal = metal;
	}
#endif

#ifdef PG_PROP
	{
		// a little dirt so painted metal is never one flat color
		float n = texture2D( uPgNoise, vPgWorld.xz * 0.31 + vPgWorld.y * 0.17 ).g;
		diffuseColor.rgb *= 0.86 + 0.28 * n;
	}
#endif
`;

// ---- B: roughness (how shiny) ------------------------------------------------------
const PG_FRAGMENT_ROUGH = /* glsl */ `
#if defined( PG_ROUGH_FROM_NORMAL ) && defined( USE_NORMALMAP_TANGENTSPACE )
	// our normal maps keep the roughness in their alpha channel
	vec4 pgNR = texture2D( normalMap, vNormalMapUv );
	roughnessFactor *= pgNR.a;
#endif
#if defined( PG_GROUND ) || defined( PG_DECAL )
	roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.42, pgDamp );
	roughnessFactor = mix( roughnessFactor, 0.035, pgPud );
#endif
#ifdef PG_WALL
	roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.75, uPgWet );
#endif
#ifdef PG_METAL
	roughnessFactor = mix( 0.42, 0.92, pgRust );
#endif
#ifdef PG_WINDOWS
	roughnessFactor = mix( roughnessFactor, mix( 0.5, 0.07, pgGlass ), pgWin );
#endif
#ifdef PG_WINMOD
	roughnessFactor = mix( 0.86, mix( 0.5, 0.07, pgGlass ), pgWin );
#endif
#ifdef PG_SHOP
	roughnessFactor = pgShopRough;
#endif
#ifdef PG_PROP
	roughnessFactor = mix( vPgData.x, vPgData.x * 0.6, uPgWet );
#endif
#ifdef PG_GLASS
	roughnessFactor = mix( 0.5, 0.07, pgGlass );
#endif
#ifdef PG_PANEL
	roughnessFactor = mix( pgPanelRough, pgPanelRough * 0.65, uPgWet );
#endif
`;

// ---- C: metalness -----------------------------------------------------------------------
const PG_FRAGMENT_METAL = /* glsl */ `
#ifdef PG_SHOP
	metalnessFactor = pgShopMetal;
#endif
#ifdef PG_METAL
	metalnessFactor *= ( 1.0 - pgRust ) * ( 1.0 - pgWin );
#endif
#ifdef PG_GLASS
	metalnessFactor *= mix( 0.55, 1.0, pgGlass );
#endif
#ifdef PG_PANEL
	metalnessFactor = pgPanelMetal;
#endif
#ifdef PG_PROP
	metalnessFactor = vPgData.y;
#endif
`;

// ---- D: surface normal ---------------------------------------------------------------------
const PG_FRAGMENT_NORMAL = /* glsl */ `
#if defined( PG_GROUND ) || defined( PG_DECAL )
	// water fills the small bumps: wet ground is smoother, puddles are flat
	normal = normalize( mix( normal, nonPerturbedNormal, max( pgPud, pgDamp * 0.55 ) ) );
	#ifndef PG_BEACH
	if ( pgPud > 0.02 ) {
		// rain drops disturb the puddles
		vec2 xz = vPgWorld.xz;
		vec2 r1 = texture2D( uPgNoise, xz * 1.7 + vec2( uPgTime * 1.3, uPgTime * 0.9 ) ).rg - 0.5;
		vec2 r2 = texture2D( uPgNoise, xz * 2.9 - vec2( uPgTime * 1.1, uPgTime * 1.6 ) ).gb - 0.5;
		vec2 rip = ( r1 + r2 ) * 0.085 * pgPud;
		normal = normalize( normal + ( viewMatrix * vec4( rip.x, 0.0, rip.y, 0.0 ) ).xyz );
	}
	#endif
#endif
#ifdef PG_WINDOWS
	normal = normalize( mix( normal, nonPerturbedNormal, max( pgWin, pgFlat ) ) );
#endif
#ifdef PG_METAL
	{
		// ribs of the metal sheets: tilt the surface left and right
		vec3 pgT = normalize( vec3( - vPgNormal.z, 0.0, vPgNormal.x ) + vec3( 1e-5 ) );
		normal = normalize( normal + ( viewMatrix * vec4( pgT, 0.0 ) ).xyz * pgRidge * 0.42 * ( 1.0 - pgWin ) );
	}
#endif
#ifdef PG_PANEL
	{
		// slats, seams and water ripples: tilt the surface a little
		vec3 pgT = abs( vPgNormal.y ) > 0.7 ? vec3( 1.0, 0.0, 0.0 ) : normalize( vec3( - vPgNormal.z, 0.0, vPgNormal.x ) + vec3( 1e-5 ) );
		normal = normalize( normal + ( viewMatrix * vec4( pgT, 0.0 ) ).xyz * pgRidge * 0.4 );
	}
#endif
#ifdef PG_SHOP
	// shutters: tilt the normal up and down to shade the slats
	normal = normalize( normal + viewMatrix[ 1 ].xyz * pgRidge * 0.55 );
#endif
#ifdef PG_OCEAN
	{
		vec2 xz = vPgWorld.xz;
		float dist = length( vPgWorld - cameraPosition );
		vec2 t = vec2( uPgTime );
		vec3 a = texture2D( uPgWaterNormal, xz * 0.058 + t * vec2( 0.021, 0.013 ) ).xyz * 2.0 - 1.0;
		vec3 b = texture2D( uPgWaterNormal, xz * 0.023 - t * vec2( 0.009, 0.016 ) ).xyz * 2.0 - 1.0;
		vec3 c = texture2D( uPgWaterNormal, xz * 0.0057 + t * vec2( 0.004, - 0.003 ) ).xyz * 2.0 - 1.0;
		vec2 slope = a.xy * 0.5 + b.xy * 0.8 + c.xy * 1.1;
		// far away the waves are too small to see one by one
		slope *= mix( 0.42, 0.12, smoothstep( 40.0, 1200.0, dist ) );
		vec3 nw = normalize( vec3( slope.x, 1.0, slope.y ) );
		normal = normalize( ( viewMatrix * vec4( nw, 0.0 ) ).xyz );
		roughnessFactor = mix( 0.07, 0.3, smoothstep( 30.0, 1500.0, dist ) );
		// shallow water near the beach is lighter; white foam at the edge
		float off = uPgShoreZ - vPgWorld.z;      // meters out to sea
		float shallow = exp( - max( off, 0.0 ) / 22.0 );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.07, 0.19, 0.18 ), shallow * 0.8 );
		float n = texture2D( uPgNoise, xz * vec2( 0.05, 0.09 ) + t * vec2( 0.01, 0.03 ) ).r;
		float wave = sin( off * 0.42 - uPgTime * 0.9 + n * 5.0 + sin( xz.x * 0.03 ) * 2.0 );
		float foam = smoothstep( 0.55, 0.95, wave ) * ( 1.0 - smoothstep( 2.0, 26.0, off ) ) * ( 0.4 + 0.6 * n );
		foam = max( foam, 1.0 - smoothstep( 0.0, 2.5, off + n * 1.5 ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.82, 0.85, 0.85 ), foam * 0.85 );
		roughnessFactor = mix( roughnessFactor, 0.75, foam );
	}
#endif
`;

// ---- E: light that the surface gives off -----------------------------------------------------
const PG_FRAGMENT_EMISSIVE = /* glsl */ `
	totalEmissiveRadiance += pgEmit * step( 0.001, uPgWinLight + uPgNight ) + pgEmitA;
#ifdef PG_PANEL
	// glowing parts: data.w from 0..1 glows only at night, 1..2 glows always
	{
		float gl = vPgData.w;
		totalEmissiveRadiance += vColor.rgb * ( max( gl - 1.0, 0.0 ) + min( gl, 1.0 ) * step( gl, 1.0 ) * uPgNight ) * 7.0;
	}
#endif
#if defined( PG_GROUND ) || defined( PG_DECAL )
	if ( uPgNight > 0.001 ) {
		vec3 lamp = pgLampColor( pgLm, vPgWorld.xz ) * ( 1.0 - smoothstep( 1.0, 4.0, vPgWorld.y ) );
		totalEmissiveRadiance += diffuseColor.rgb * lamp * 1.9;
		// wet ground also mirrors a little of the lamp light
		totalEmissiveRadiance += lamp * ( pgDamp * 0.14 + pgPud * 0.36 );
	}
#endif
#if defined( PG_WALL ) || defined( PG_SHOP ) || defined( PG_SIGN ) || defined( PG_LAMP ) || defined( PG_WINMOD ) || defined( PG_PANEL )
	if ( uPgNight > 0.001 ) {
		// walls catch lamp light from the street in front of them, fading with height
		vec2 q = vPgWorld.xz + vPgNormal.xz * 2.2;
		vec3 lamp = pgLampColor( pgLampTexel( q ), q );
		float up = exp( - max( vPgWorld.y - 1.5, 0.0 ) * 0.23 );
		totalEmissiveRadiance += diffuseColor.rgb * lamp * up * 0.8;
	}
#endif
#if defined( PG_PROP ) || defined( PG_FOLIAGE )
	if ( uPgNight > 0.001 ) {
		vec3 lamp = pgLampColor( pgLampTexel( vPgWorld.xz ), vPgWorld.xz );
		float up = exp( - max( vPgWorld.y - 2.0, 0.0 ) * 0.2 );
		totalEmissiveRadiance += diffuseColor.rgb * lamp * up * 1.3;
	}
#endif
#ifdef PG_PROP
	// glowing parts: data.w from 0..1 glows only at night, 1..2 glows always
	{
		float gl = vPgData.w;
		float always = max( gl - 1.0, 0.0 );
		float atNight = min( gl, 1.0 ) * step( gl, 1.0 ) * uPgNight;
		totalEmissiveRadiance += vColor.rgb * ( always + atNight ) * 7.0;
	}
#endif
#ifdef PG_SIGN
	#ifdef USE_MAP
		// lit signs: data.x = brightness of this sign at night
		totalEmissiveRadiance += sampledDiffuseColor.rgb * sampledDiffuseColor.rgb * vPgData.x * uPgNight * 3.2;
	#endif
#endif
#ifdef PG_SHOP
	if ( pgGlass > 0.01 ) {
		// shops with a seed below 0.62 keep their lights on at night
		float lit = step( pgShopSeed, 0.62 ) * uPgNight;
		vec3 room = pgShopInterior( pgShopP, pgShopSize, vPgData.y, lit );
		// by day a shop is much darker inside than the street outside
		totalEmissiveRadiance += room * pgGlass * ( uPgDay * 0.07 + lit * 0.85 + 0.004 );
	}
#endif
`;

// Turn a plain three.js material into a "patched" one.
function patch(material, defs) {
  const defines = defs.map((d) => `#define ${d}`).join('\n') + '\n';
  const usesData = defs.some((d) => ['PG_WINDOWS', 'PG_SHOP', 'PG_PROP', 'PG_SIGN', 'PG_FOLIAGE', 'PG_WINMOD', 'PG_GLASS', 'PG_PANEL'].includes(d));
  const head = defines + (usesData ? '#define PG_USE_DATA\n' : '');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', '#include <common>\n' + PG_VERTEX_PARS);
    if (defs.includes('PG_PROP')) vs = vs.replace('#include <color_vertex>', PG_COLOR_VERTEX_PROP);
    vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + PG_VERTEX_WIND + PG_VERTEX_WINMOD);
    vs = vs.replace('#include <shadowmap_vertex>', PG_SHADOW_WINMOD + '\n#include <shadowmap_vertex>');
    vs = vs.replace('#include <project_vertex>', '#include <project_vertex>\n' + PG_VERTEX_MAIN);
    shader.vertexShader = head + vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', '#include <common>\n' + PG_FRAGMENT_PARS);
    fs = fs.replace('#include <map_fragment>', PG_MAP_FRAGMENT);
    fs = fs.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n\tfloat pgShopRough = 0.5;\n\tfloat pgShopMetal = 0.0;\n' + PG_FRAGMENT_COLOR
    );
    fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + PG_FRAGMENT_ROUGH);
    fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + PG_FRAGMENT_METAL);
    // re-use the normal map sample we already took for the roughness
    let normalChunk = THREE.ShaderChunk.normal_fragment_maps;
    if (defs.includes('PG_ROUGH_FROM_NORMAL')) {
      normalChunk = normalChunk.replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = pgNR.xyz * 2.0 - 1.0;'
      );
    }
    fs = fs.replace('#include <normal_fragment_maps>', normalChunk + '\n' + PG_FRAGMENT_NORMAL);
    fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + PG_FRAGMENT_EMISSIVE);
    shader.fragmentShader = head + fs;
  };
  // three.js re-uses compiled shaders between materials with the same key
  material.customProgramCacheKey = () => 'pg:' + defs.join(',');
  return material;
}

// ---------------------------------------------------------------------------
// createMaterials: load everything. Returns { mats, tex, setQuality }.
// ---------------------------------------------------------------------------
export async function createMaterials(renderer, onProgress = () => {}) {
  const T = CONFIG.textures;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ---- 1. load the pictures (a missing file gives null) ----
  const names = ['asphalt', 'sidewalk', 'brick', 'plaster', 'sand', 'glassTower', 'windowsDay', 'windowsNight'];
  let loaded = 0;
  const images = {};
  await Promise.all(
    names.map(async (n) => {
      images[n] = await TX.loadImage(T.path + T[n].file);
      if (!images[n]) console.warn(`[materials] ${T[n].file} is missing - using a generated texture instead`);
      onProgress(++loaded / names.length);
    })
  );
  const missing = names.filter((n) => !images[n]);
  const pause = () => new Promise((r) => setTimeout(r, 0)); // lets the loading bar redraw
  onProgress(1, 'Preparing surfaces');
  await pause();

  // ---- 2. color textures (photo, or a generated fallback) ----
  const fallback = {
    asphalt: TX.fallbackAsphalt, sidewalk: TX.fallbackSidewalk, brick: TX.fallbackBrick,
    plaster: TX.fallbackPlaster, sand: TX.fallbackSand, glassTower: TX.fallbackGlassTower,
  };
  const tex = {};
  const sources = {};
  // Photos repeat every few meters. Evening out their big stains hides the
  // repetition (the shaders add new, non-repeating variation instead).
  const even = { asphalt: [0.06, 0.92, 0], plaster: [0.09, 0.85, 0], brick: [0.08, 0.6, 0.75], sidewalk: [0.14, 0.45, 0], sand: [0.1, 0.7, 0] };
  for (const n of ['asphalt', 'sidewalk', 'brick', 'plaster', 'sand', 'glassTower']) {
    let src = images[n] || fallback[n]();
    if (even[n]) src = flattenImage(src, even[n][0], even[n][1], even[n][2]);
    sources[n] = src;
    const t = new THREE.Texture(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    tex[n] = t;
  }

  // Average color of the wall pictures (in the renderer's "linear" color).
  // The sides of 3D window openings and other small parts are painted with it.
  tex.avg = {};
  for (const n of ['brick', 'plaster']) {
    const px = readPixels(sources[n], 16, 16).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < 256; i++) for (let k = 0; k < 3; k++) sum[k] += Math.pow(px[i * 4 + k] / 255, 2.2);
    tex.avg[n] = sum.map((v) => v / 256);
  }
  tex.avg.metal = [1, 1, 1];

  await pause();
  // ---- 3. bumps + roughness made from the color pictures ----
  const nr = {};
  nr.asphalt = makeNormalRoughTexture(sources.asphalt, { strength: T.asphalt.normal, roughness: T.asphalt.roughness, detailRadius: 8 });
  nr.sidewalk = makeNormalRoughTexture(sources.sidewalk, { strength: T.sidewalk.normal, roughness: T.sidewalk.roughness, detailRadius: 6 });
  nr.brick = makeNormalRoughTexture(sources.brick, { strength: T.brick.normal, roughness: T.brick.roughness, mode: 'saturation', detailRadius: 10 });
  nr.plaster = makeNormalRoughTexture(sources.plaster, { strength: T.plaster.normal, roughness: T.plaster.roughness, detailRadius: 4 });
  nr.sand = makeNormalRoughTexture(sources.sand, { strength: T.sand.normal, roughness: T.sand.roughness, detailRadius: 10 });

  onProgress(1, 'Painting signs and details');
  await pause();
  // ---- 4. generated textures ----
  const win = TX.buildWindowAtlases(images.windowsDay, images.windowsNight, T.windowsDay, T.windowsNight);
  tex.noise = makeNoiseTexture(256);
  tex.markings = TX.makeMarkingsTexture();
  tex.decals = TX.makeDecalTexture();
  tex.signs = TX.makeSignTexture();
  tex.holo = TX.makeHoloTexture();
  tex.leaf = TX.makeLeafTexture();
  tex.frond = TX.makeFrondTexture();
  tex.glow = TX.makeGlowTexture();
  tex.awning = TX.makeAwningTexture();
  tex.waterNormal = TX.makeWaterNormalTexture();
  tex.skyline = TX.makeSkylineTextures();
  tex.graffiti = TX.makeGraffitiTexture();
  tex.rail = TX.makeRailTexture();
  tex.wallDetail = TX.makeWallDetailTexture();
  tex.foliage = TX.makeFoliageTexture();
  tex.winDay = win.day;
  tex.winLit = win.lit;

  shared.uPgNoise.value = tex.noise;
  shared.uPgWinAtlas.value = tex.winDay;
  shared.uPgWinLit.value = tex.winLit;
  shared.uPgWaterNormal.value = tex.waterNormal;
  shared.uPgDetail.value = tex.wallDetail;
  // a tiny black picture until the real lamp light map is drawn by the city builder
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  blank.needsUpdate = true;
  shared.uPgLightMap.value = blank;

  // ---- 5. materials ----
  const std = (opts) => new THREE.MeshStandardMaterial({ metalness: 0, roughness: 1, vertexColors: true, ...opts });
  const mats = {};

  // Road asphalt (also used for flat roofs).
  mats.asphalt = patch(std({ map: tex.asphalt, normalMap: nr.asphalt, color: 0xb9b9b9 }), ['PG_GROUND', 'PG_ANTITILE', 'PG_ROUGH_FROM_NORMAL']);
  // Sidewalk slabs and curbs.
  mats.sidewalk = patch(std({ map: tex.sidewalk, normalMap: nr.sidewalk }), ['PG_GROUND', 'PG_ROUGH_FROM_NORMAL']);
  // Beach sand.
  mats.sand = patch(std({ map: tex.sand, normalMap: nr.sand }), ['PG_GROUND', 'PG_ANTITILE', 'PG_BEACH', 'PG_ROUGH_FROM_NORMAL']);
  // Stains, cracks, manholes, soft shadows (see-through quads on the ground).
  mats.decal = patch(
    std({ map: tex.decals, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, roughness: 0.85 }),
    ['PG_DECAL']
  );
  // Painted road markings.
  mats.marking = patch(
    std({ map: tex.markings, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -10, roughness: 0.7 }),
    ['PG_DECAL']
  );
  // Building walls.
  mats.brick = patch(std({ map: tex.brick, normalMap: nr.brick }), ['PG_WALL', 'PG_WINDOWS', 'PG_BRICK', 'PG_ROUGH_FROM_NORMAL']);
  mats.plaster = patch(std({ map: tex.plaster, normalMap: nr.plaster }), ['PG_WALL', 'PG_WINDOWS', 'PG_CRACKS', 'PG_ROUGH_FROM_NORMAL']);
  // Corrugated metal sheets (warehouses, sheds, canopies). The ribs are drawn by the shader.
  mats.metal = patch(std({ roughness: 0.5, metalness: 0.4 }), ['PG_WALL', 'PG_WINDOWS', 'PG_METAL']);
  // The 3D windows near the player (see buildingKit.js).
  mats.winMod = patch(std({ roughness: 0.8 }), ['PG_WINMOD']);
  // Invisible "hole cutter": it is drawn on the wall where a 3D window is, only
  // into the depth buffer. The wall, drawn later, then leaves these pixels
  // alone and the window that sits deeper in the wall stays visible.
  mats.winMask = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aInst;
      void main() {
        vec4 p = vec4( position.xy * aInst.xy, 0.0, 1.0 );
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      void main() {
        gl_FragColor = vec4( 0.0 );
      }`,
    colorWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  // Spray paint on walls and shutters.
  mats.graffiti = patch(
    std({ map: tex.graffiti, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, roughness: 0.8 }),
    ['PG_LAMP']
  );
  // Fences and railings (see-through pictures).
  mats.rail = patch(
    std({ map: tex.rail, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.25 }),
    ['PG_LAMP']
  );
  // Standing water in alleys: a very shiny dark patch.
  mats.puddle = patch(
    std({ map: tex.decals, color: 0x1b1c20, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, roughness: 0.03 }),
    ['PG_LAMP']
  );
  // Glass curtain walls of the new buildings: dark tinted glass that mirrors
  // the sky. Floor plates, bars, blinds and lit rooms are drawn by the shader.
  mats.glass = patch(
    new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.4, ior: 1.52, reflectivity: 0.55 }),
    ['PG_GLASS']
  );
  // Frames, ribbons, slabs, roofs: one material that can look like smooth
  // concrete or metal, perforated metal, wood slats, seam metal, solar cells, pool water.
  mats.panel = patch(std({ roughness: 0.6 }), ['PG_PANEL']);
  // Green walls: a dense carpet of leaves.
  mats.greenWall = patch(std({ map: tex.foliage, roughness: 0.95 }), ['PG_LAMP']);
  // Far glass towers of The Crown (photo texture).
  mats.tower = patch(std({ map: tex.glassTower, roughness: 0.14, metalness: 0.82, color: 0x9aa4ad }), ['PG_TOWER']);
  // Ground floor shop fronts (drawn by the shader).
  mats.shop = patch(std({ roughness: 0.5 }), ['PG_SHOP']);
  // Shop signs.
  mats.sign = patch(std({ map: tex.signs, roughness: 0.55 }), ['PG_SIGN']);
  // Cloth awnings.
  mats.awning = patch(std({ map: tex.awning, roughness: 0.85, side: THREE.DoubleSide }), ['PG_LAMP']);
  // All small objects: color, roughness and metal come from the vertices.
  mats.prop = patch(std({}), ['PG_PROP']);
  mats.propDouble = patch(std({ side: THREE.DoubleSide }), ['PG_PROP']);
  // Leaves and palm fronds.
  const leafOpts = { alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92, color: 0xd8d8d8 };
  mats.leaf = patch(std({ map: tex.leaf, ...leafOpts }), ['PG_FOLIAGE']);
  mats.frond = patch(std({ map: tex.frond, ...leafOpts }), ['PG_FOLIAGE']);
  // Ocean.
  mats.ocean = patch(
    new THREE.MeshPhysicalMaterial({ color: 0x06222e, roughness: 0.1, metalness: 0, ior: 1.34, reflectivity: 0.5 }),
    ['PG_OCEAN']
  );
  // Far hills.
  mats.hills = std({ map: tex.plaster, normalMap: nr.plaster, normalScale: new THREE.Vector2(2.5, 2.5), roughness: 1 });
  // Thin wires between power poles.
  mats.wire = new THREE.LineBasicMaterial({ color: 0x101012 });

  // Remember the settings we switch with the quality level.
  const normalMapped = [
    [mats.asphalt, nr.asphalt, T.asphalt.roughness],
    [mats.sidewalk, nr.sidewalk, T.sidewalk.roughness],
    [mats.sand, nr.sand, T.sand.roughness],
    [mats.brick, nr.brick, T.brick.roughness],
    [mats.plaster, nr.plaster, T.plaster.roughness],
  ];
  const anisoTextures = [tex.asphalt, tex.sidewalk, tex.sand, tex.brick, tex.plaster, tex.markings, tex.decals, tex.glassTower, nr.asphalt, nr.sidewalk, tex.rail, tex.graffiti];

  function setQuality(q) {
    for (const [m, map, rough] of normalMapped) {
      const want = q.normalMaps ? map : null;
      if (m.normalMap !== want) {
        m.normalMap = want;
        m.needsUpdate = true;
      }
      // with the map, the roughness comes from its alpha channel
      m.roughness = q.normalMaps ? 1.0 : rough;
    }
    const a = Math.min(q.anisotropy, maxAniso);
    for (const t of anisoTextures) {
      if (t.anisotropy !== a) {
        t.anisotropy = a;
        t.needsUpdate = true;
      }
    }
  }

  // Give a material from a model file (hero buildings) the street lamp light at night.
  const lampPatch = (m) => { if (!m.userData.pgPatched) { m.userData.pgPatched = true; patch(m, ['PG_LAMP']); } };

  return { mats, tex, nr, shared, missing, setQuality, lampPatch };
}
