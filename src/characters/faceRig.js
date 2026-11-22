// ---------------------------------------------------------------------------
// faceRig.js - small bones for a face that was scanned as one stiff piece.
//
// The models have no bones in the face: the mouth, the eyes and the eyebrows
// are only PAINTED on the head. To let a face change, this file adds seven
// small bones under the head bone and says which points of the head follow
// them:
//
//   jaw                 turns around a hinge in front of the ears: the lower lip
//                       and the chin go down, the mouth opens
//   lid_L, lid_R        slide the upper eyelids down over the eyes (a blink)
//   brow_L, brow_R      lift, lower and tilt the eyebrows
//   mouth_L, mouth_R    pull the corners of the mouth up, down or outward
//
// Where these things are comes from faceClean.js (readFace): the nose, the
// eyes, the mouth and the eyebrows were found on the flat face. How much a
// point follows a bone depends only on WHERE the point is (smooth hills around
// each place), not on how the triangles of the model happen to run, so the
// skin moves softly on every model. The frame of glasses and loose strands of
// hair stand out in front of the bare face: they follow nothing but the head.
//
// faceAnim.js moves these bones. Nothing here imports three.js.
// ---------------------------------------------------------------------------

import { bareAt, lipAt } from './faceClean.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// how far the upper eyelid travels to close an eye, and where the two lid lines are (meters at 1.8 m, from the eye line)
export const LID_TRAVEL = 0.009, LID_LOW = -0.0045, LID_HIGH = 0.0045;

// A: the analysis of autoRig.js (bones, skin). face: what readFace found.
// Adds the bones to A and gives the points of the head their new weights. Returns true when it did.
export function addFaceBones(A, face) {
  const headBone = A.boneIndex.head;
  if (headBone === undefined || A.boneIndex.jaw !== undefined) return false;
  const { k, chin, zFace, noseX, eyeX, eyeY, mouthY, mouthHalf, browY } = face;
  // a place on the flat face -> a place in the model
  const at = (x, y, z) => [x * k, chin + y * k, zFace + z * k];
  // the jaw hinge: in front of the ear, a little under the eye line, well behind the face
  const hingeY = eyeY - 0.03, hingeZ = -0.085;
  const bones = [
    ['jaw', at(noseX, hingeY, hingeZ)],
    ['lid_L', at(noseX + eyeX, eyeY, -0.02)], ['lid_R', at(noseX - eyeX, eyeY, -0.02)],
    ['brow_L', at(noseX + eyeX, browY, -0.015)], ['brow_R', at(noseX - eyeX, browY, -0.015)],
    ['mouth_L', at(noseX + mouthHalf, mouthY, -0.025)], ['mouth_R', at(noseX - mouthHalf, mouthY, -0.025)],
  ];
  const index = {};
  for (const [name, head] of bones) {
    index[name] = A.boneIndex[name] = A.bones.length;
    // (axes like the model itself: X to the character's left, Y up, Z forward. helper: the body animation leaves them alone)
    A.bones.push({ name, parent: 'head', head, tail: [head[0], head[1] + 0.03 * k, head[2]], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], length: 0.03 * k, helper: 'face' });
  }

  // ---- which points follow which bone ----
  const pos = A.positions, si = A.skinIndex, sw = A.skinWeight, count = pos.length / 3;
  // for the picture of an open mouth (characterLook.js): per point [which side of the lips (0 above, 1 below), how much it is the mouth]
  const lip = new Float32Array(count * 2);
  const lowBrow = Math.min(eyeY + 0.0075, browY - 0.006);       // where the eyebrow's pull ends, above the eye
  const names = ['jaw', 'lid', 'brow', 'mouth'], w = [0, 0, 0, 0];
  let moved = 0;
  for (let v = 0; v < count; v++) {
    // only points that belong to the head alone (the rigid head of autoRig.js)
    if (si[v * 4] !== headBone || sw[v * 4] < 0.999) continue;
    const x = pos[v * 3] / k - noseX, y = (pos[v * 3 + 1] - chin) / k, z = (pos[v * 3 + 2] - zFace) / k;
    const u = Math.abs(x), back = -z;
    if (back > 0.135 || y < -0.02 || y > browY + 0.04 || u > 0.1) continue;
    // not the frame of glasses, not a strand of hair: those stand out in front of the bare face
    const skin = 1 - smooth(0.002, 0.0045, z - bareAt(face, pos[v * 3] / k, y));
    if (skin < 0.01) continue;

    // the jaw: everything under a line that runs from the mouth back and up to the hinge. In the mouth that line is
    // where the lips meet, and it is sharp: the lower lip goes with the jaw, the upper lip stays - the mouth opens.
    // (in the mouth = beside the middle no further than the corners, and on the front skin: the lips are 2 cm behind
    //  the tip of the nose, so "front" is measured from the bare face at that place, not from the nose)
    const front = bareAt(face, pos[v * 3] / k, y) - z;
    const t = smooth(0.03, 0.095, back), inMouth = (1 - smooth(mouthHalf - 0.004, mouthHalf + 0.003, u)) * (1 - smooth(0.006, 0.016, front));
    const lineY = lipAt(face, pos[v * 3] / k), edge = mouthY + (hingeY - mouthY) * t + (lineY - mouthY) * inMouth;
    const softUp = (0.002 + 0.006 * t) * (1 - inMouth) + 0.0008 * inMouth, softDown = (0.006 + 0.018 * t) * (1 - inMouth) + 0.0008 * inMouth;
    w[0] = smooth(edge + softUp, edge - softDown, y) * (1 - smooth(0.1, 0.13, back));
    if (inMouth > 0.01) { lip[v * 2] = smooth(lineY + 0.0008, lineY - 0.0008, y); lip[v * 2 + 1] = inMouth * (1 - smooth(0.006, 0.011, Math.abs(y - lineY))); }
    // an eyelid: nothing at the lower lid, everything at the upper lid, fading out toward the eyebrow
    const dv = y - eyeY, du = u - eyeX;
    const lid = dv <= LID_LOW ? 0 : dv < LID_HIGH ? (dv - LID_LOW) / (LID_HIGH - LID_LOW) : clamp01(1 - (dv - LID_HIGH) / 0.011);
    w[1] = lid * (1 - smooth(0.0145, 0.0215, Math.abs(du))) * (1 - smooth(0.06, 0.08, back));
    // an eyebrow: a band from just above the eye to the forehead, not across the middle of the face
    const db = y - browY;
    const band = db < 0 ? smooth(lowBrow - browY, -0.003, db) : 1 - smooth(0.006, 0.032, db);
    w[2] = band * smooth(0.002, 0.012, u) * (1 - smooth(0.052, 0.068, u)) * (1 - smooth(0.05, 0.075, back));
    // a corner of the mouth: a round hill around it
    const r = Math.hypot(u - mouthHalf, y - mouthY);
    w[3] = (1 - smooth(0.005, 0.027, r)) * (1 - smooth(0.045, 0.075, back));

    let sum = 0;
    for (let i = 0; i < 4; i++) { w[i] *= skin; if (w[i] < 0.01) w[i] = 0; sum += w[i]; }
    if (sum <= 0) continue;
    // at most three bones beside the head: the weakest of four is dropped
    if (w[0] && w[1] && w[2] && w[3]) { let m = 0; for (let i = 1; i < 4; i++) if (w[i] < w[m]) m = i; sum -= w[m]; w[m] = 0; }
    const scale = sum > 1 ? 1 / sum : 1, side = x >= 0 ? '_L' : '_R';
    let slot = 1;
    si[v * 4 + 1] = si[v * 4 + 2] = si[v * 4 + 3] = headBone; sw[v * 4 + 1] = sw[v * 4 + 2] = sw[v * 4 + 3] = 0;
    for (let i = 0; i < 4; i++) {
      if (!w[i]) continue;
      si[v * 4 + slot] = index[i === 0 ? 'jaw' : names[i] + side]; sw[v * 4 + slot] = w[i] * scale; slot++;
    }
    sw[v * 4] = Math.max(0, 1 - sum * scale);
    moved++;
  }
  // what the animation needs to know (lengths in meters of this model)
  A.face = {
    bones: bones.map((b) => b[0]), points: moved, eyesFound: face.eyesFound,
    lidTravel: LID_TRAVEL * k,
    jawArm: Math.hypot(hingeZ + 0.015, hingeY - mouthY) * k,       // from the hinge to the lips
    // the model was made smiling: millimeters the corners of the mouth are higher than its middle
    restSmile: face.restSmile,
    // for the picture of an open mouth: the middle of the lower lip (model space), and the two bones
    lipPoint: at(noseX, lipAt(face, noseX) - 0.004, -0.004), jawBone: index.jaw, headBone: headBone,
    at: { noseX, eyeX, eyeY, mouthY, mouthHalf, browY, tipY: face.tipY },
  };
  A.lip = lip;
  return true;
}
