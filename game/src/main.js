// Boot and the one loop for Port Solano: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between title, play,
// paused, busted and wasted screens, all driven by world.state.screen.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const render = createRenderer(canvas);
const world = createWorld(seed, render.scene);
const state = world.state;

/** Input that presses nothing: the title screen's living backdrop. */
const idleInput = {
  takeLook() { return { x: 0, y: 0 }; },
  takeActions() { return 0; },
  move() { return { forward: 0, strafe: 0, run: false }; },
};

function runShot(name) {
  const scene = stageShot(name, world, render, audio);
  let painted = 0;
  function paint() {
    render.draw(state, STEP);
    render.updateHud(state, world.objective(), null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  void scene;
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function nearestCarDist() {
    const p = state.player;
    let best = null;
    for (const car of [...state.traffic, ...state.parked]) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  function startGame(fromSave) {
    if (fromSave) world.load();
    audio.unlock();
    input.lockPointer();
    state.screen = SCREEN_PLAY;
    announce('Playing. Steal a car with E, follow the marker to Marta’s garage.');
  }

  document.getElementById('start-btn').addEventListener('click', () => startGame(false));
  const continueBtn = document.getElementById('continue-btn');
  if (world.hasSave()) {
    continueBtn.style.display = 'inline-block';
    continueBtn.addEventListener('click', () => startGame(true));
  }
  document.getElementById('resume-btn').addEventListener('click', () => {
    state.screen = SCREEN_PLAY;
  });
  canvas.addEventListener('click', () => {
    if (state.screen === SCREEN_PLAY) input.lockPointer();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    if (state.screen === SCREEN_TITLE) {
      state.camYaw += dt * 0.05;
      while (accumulator >= STEP) {
        world.step(STEP, idleInput, audio);
        accumulator -= STEP;
      }
    } else {
      while (accumulator >= STEP) {
        world.step(STEP, input, audio);
        accumulator -= STEP;
      }
    }
    render.draw(state, dt);
    render.updateHud(state, world.objective(), nearestCarDist());
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Port Solano. Press Start to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
