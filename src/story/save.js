// ---------------------------------------------------------------------------
// save.js - the saved game (kept in the browser's localStorage).
//
// What is stored:
//   chapter, mission, checkpoint   where the player is in the story
//   flags                          choices and things that happened (limiter_off, ticket_taken ...)
//   unlocked                       characters the player has met
//   done                           chapters that were finished
//   ended                          number of the chapter that was just finished (null while one is being played)
// The game saves by itself at every checkpoint.
// ---------------------------------------------------------------------------

const KEY = 'pg-story-save';
const VERSION = 1;

// the flags of the full game, with their values at the start
export const START_FLAGS = {
  limiter_off: false,        // Nate switched the limiter off (chapter 1)
  ticket_found: false,       // Nate saw the race ticket in Solberg's hand
  ticket_taken: false,       // ... and took it with him
  mace_kind: false,          // Nate answered Mace kindly ("Eat something.")
  wren_tracks_zero: false,   // WREN keeps watching for the black Phantom
  nate_name_known: false,    // the priority job was addressed to "N. Calloway"
  voicemail_played: false,   // Nate listened to the start of Theo's old message
  phone_read: false,         // the player read the message on Theo's phone (prologue)
};

export function createSave() {
  let data = null;
  const fresh = () => ({ version: VERSION, chapter: null, mission: 0, checkpoint: 0, flags: { ...START_FLAGS }, unlocked: [], done: [], ended: null });
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? JSON.parse(raw) : null;
      data = d && d.version === VERSION ? { ...fresh(), ...d, flags: { ...START_FLAGS, ...(d.flags || {}) } } : fresh();
    } catch (e) { data = fresh(); }      // private mode or broken data: start clean
    return data;
  }
  function write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode: the game still works, it just forgets */ } }
  load();
  return {
    get data() { return data; },
    get hasGame() { return !!data.chapter; },
    // called by the story at every checkpoint
    checkpoint(chapter, mission, checkpoint) { data.chapter = chapter; data.mission = mission; data.checkpoint = checkpoint; data.ended = null; write(); },
    // the last mission of chapter number n is over (CONTINUE then looks for the next chapter)
    finish(n) { data.ended = n; write(); },
    setFlags(flags) { Object.assign(data.flags, flags); write(); },
    flag(name) { return data.flags[name]; },
    unlock(list) { for (const who of list) if (!data.unlocked.includes(who)) data.unlocked.push(who); write(); },
    chapterDone(id) { if (!data.done.includes(id)) data.done.push(id); write(); },
    // New Game: everything back to the start
    reset() { data = fresh(); write(); },
    // (for tests and the mission list: start with the flags a normal game would have at that point)
    replaceFlags(flags) { data.flags = { ...START_FLAGS, ...flags }; write(); },
  };
}
