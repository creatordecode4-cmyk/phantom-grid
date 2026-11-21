// ---------------------------------------------------------------------------
// rigWorker.js - runs the automatic rigging (autoRig.js) in the background.
//
// Finding joints and skin weights takes about a second on a phone. Done here,
// in a "worker", the game keeps running smoothly while a story character is
// being prepared.
// ---------------------------------------------------------------------------

import { analyzeCharacter } from './autoRig.js';

self.onmessage = (e) => {
  const { id, positions, index, height } = e.data;
  try {
    const A = analyzeCharacter(positions, index, { height });
    // only plain numbers and lists can be sent back (no functions)
    const out = { positions: A.positions, scale: A.scale, flip: A.flip, height: A.height, joints: A.joints, bones: A.bones, boneIndex: A.boneIndex, skinIndex: A.skinIndex, skinWeight: A.skinWeight, gains: A.gains, info: A.info, report: A.report };
    self.postMessage({ id, ok: true, A: out }, [A.positions.buffer, A.skinIndex.buffer, A.skinWeight.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
