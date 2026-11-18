// Deterministic screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, so the frame is what a short game really looks like and the same
// seed always gives the same frame. No input is faked beyond a held key: the
// drive and chase scenes hold W, the mission scene walks toward the marker.
import { SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { GARAGE, STEP } from './config.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 9;
const CHASE_SECONDS = 7;
const MISSION_SECONDS = 4;

function dummyInput(forward) {
  return {
    takeLook() { return { x: 0, y: 0 }; },
    takeActions() { return 0; },
    move() { return { forward, strafe: 0, run: false }; },
  };
}

/**
 * Set `world` to the named scene and return the screen to show over it.
 * `render` paints the frame; the caller paints twice, then sets __shotReady.
 */
export function stageShot(name, world, render, audio) {
  const state = world.state;
  const idle = dummyInput(0);
  if (name === 'drive') {
    state.screen = SCREEN_PLAY;
    world.forceDrive();
    const drive = dummyInput(1);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) world.step(STEP, drive, audio);
    render.snapCamera(state);
    render.draw(state, STEP);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    state.screen = SCREEN_PLAY;
    world.forceDrive();
    state.heat = 55;
    state.stars = 3;
    // Floor it for a few seconds, then lift off: the police close in and ram.
    const drive = dummyInput(1);
    const coast = dummyInput(0);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      world.step(STEP, i < 2.5 / STEP ? drive : coast, audio);
    }
    // Face the camera back down the street: the police that caught up sit
    // behind the player's car, in frame.
    if (state.player.car) state.camYaw = state.player.car.heading;
    render.snapCamera(state);
    render.draw(state, STEP);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    state.screen = SCREEN_PLAY;
    // Walk into the garage to take the first job, then head for the docks.
    state.player.x = GARAGE.x;
    state.player.z = GARAGE.z;
    world.step(STEP, idle, audio);
    state.player.x = -58;
    state.player.z = -150;
    state.camYaw = Math.PI;
    const walk = dummyInput(1);
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) world.step(STEP, walk, audio);
    render.snapCamera(state);
    render.draw(state, STEP);
    return { screen: SCREEN_PLAY };
  }
  // Default: the title screen over a living city. Face the camera into the
  // city (south-west of the player, looking north-east) so the skyline fills
  // the frame instead of the sea beyond the city edge.
  state.screen = SCREEN_TITLE;
  state.camYaw = Math.PI * 1.25;
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    state.camYaw += STEP * 0.06;
    world.step(STEP, idle, audio);
  }
  render.snapCamera(state);
  render.draw(state, STEP);
  return { screen: SCREEN_TITLE };
}
