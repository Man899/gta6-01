// Missions and the short story of Port Solano. Danny Cole, a driver fresh out of
// the marina district, runs jobs for Marta Reyes while the city police watch.
// A mission is a list of steps; a step is "go to a place" or "lose the police".
// The module only tracks progress — the world owns the player and the wanted level.
import { MISSIONS } from './config.js';

export function createMissions() {
  return {
    index: 0, // which mission is active
    step: 0, // which step of it
    active: false,
    done: [], // ids of finished missions
    timeLeft: 0,
    message: '',
    messageTimer: 0,
  };
}

/** Start the next mission, or report that the story is finished. */
export function startNextMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  const def = MISSIONS[missions.index];
  missions.active = true;
  missions.step = 0;
  missions.timeLeft = def.timeLimit || 0;
  setMessage(missions, def.intro, 9);
  return def;
}

export function currentMission(missions) {
  if (!missions.active || missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const def = currentMission(missions);
  if (!def) return null;
  return def.steps[missions.step] || null;
}

export function setMessage(missions, text, seconds) {
  missions.message = text;
  missions.messageTimer = seconds;
}

/** Where the mission marker should stand right now, or null when none. */
export function missionTarget(missions) {
  const step = currentStep(missions);
  if (!step || step.kind !== 'goto') return null;
  return step.target;
}

/**
 * Advance the mission state one step. `pos` is the player's position, `stars`
 * the current wanted level, `dt` the step. Returns 'step', 'done', 'failed' or ''.
 */
export function updateMissions(missions, pos, stars, dt) {
  if (missions.messageTimer > 0) missions.messageTimer -= dt;
  if (!missions.active) return '';
  const def = currentMission(missions);
  if (!def) return '';
  if (def.timeLimit) {
    missions.timeLeft -= dt;
    if (missions.timeLeft <= 0) {
      missions.active = false;
      setMessage(missions, `Too slow — "${def.title}" failed. Talk to Marta to try again.`, 6);
      return 'failed';
    }
  }
  const step = currentStep(missions);
  if (!step) return '';
  if (step.kind === 'goto') {
    const dx = pos.x - step.target.x;
    const dz = pos.z - step.target.z;
    if (dx * dx + dz * dz < 64) {
      missions.step += 1;
      if (missions.step >= def.steps.length) {
        missions.done.push(def.id);
        missions.active = false;
        missions.index += 1;
        setMessage(missions, `Job done: "${def.title}" — $${def.reward} paid.`, 6);
        return 'done';
      }
      return 'step';
    }
  } else if (step.kind === 'lose') {
    if (stars === 0) {
      missions.step += 1;
      return 'step';
    }
  }
  return '';
}

/** The objective line the HUD shows. */
export function objectiveText(missions) {
  if (!missions.active) {
    if (missions.index >= MISSIONS.length) return 'Story complete — free roam. Earn cash, explore Port Solano.';
    return 'Go to Marta’s garage to start your next job.';
  }
  const def = currentMission(missions);
  const step = currentStep(missions);
  let text = `${def.title}: ${step ? step.label : ''}`;
  if (def.timeLimit) text += ` — ${Math.max(0, Math.ceil(missions.timeLeft))}s left`;
  return text;
}
