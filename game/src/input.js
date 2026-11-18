// Keyboard and mouse input for Port Solano. Held keys are read every frame;
// one-shot presses (enter car, punch, pause, confirm) are queued as flags and
// taken once by the loop, so a press between two frames is never lost or double
// counted. Mouse movement steers the camera while the pointer is locked.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_SHOOT = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    lookX += event.movementX;
    lookY += event.movementY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) actions |= ACTION_SHOOT;
  });

  return {
    /** Request pointer lock for mouse look (call from a user gesture). */
    lockPointer() {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can be refused (headless, iframes): mouse look then stays off.
      }
    },
    /** -1..1 forward/back and left/right from the held movement keys. */
    move() {
      const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const s = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, run: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    /** Mouse look accumulated since the last call, in pixels. */
    takeLook() {
      const look = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return look;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    isLocked() {
      return locked;
    },
  };
}
