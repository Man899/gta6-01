// The simulation of Port Solano: the player on foot and in cars, traffic,
// pedestrians, police and the wanted level, combat, missions, health and money.
// No drawing here except the few meshes the simulation itself owns (the player,
// the mission marker, the shot tracer); the renderer paints the scene and HUD.
import * as THREE from 'three';
import {
  BUST_FINE, CITY_HALF, GARAGE, HEALTH_MAX, HEAT_ATTACK_COP, HEAT_DECAY, HEAT_HIT_PED,
  HEAT_MAX, HEAT_PER_STAR, HEAT_SHOOT, HEAT_STEAL_CAR, MAX_POLICE_CARS, MISSIONS, MONEY_START,
  PLAYER_RADIUS, RUN_SPEED, SAVE_KEY, SPAWN, WALK_SPEED,
} from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import {
  drivePlayerCar, spawnParked, spawnPoliceCar, spawnTraffic,
  updatePoliceCar, updateTraffic,
} from './vehicles.js';
import {
  knockDown, makePersonMesh, spawnCop, spawnPedestrians, updateCop, updatePedestrians,
} from './people.js';
import {
  createMissions, missionTarget, objectiveText, startNextMission,
  updateMissions,
} from './missions.js';
import { ACTION_ENTER, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT } from './input.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createWorld(seed, scene) {
  const rng = createRandom(seed);
  const city = buildCity(scene, rng);
  const traffic = spawnTraffic(scene, rng, city);
  const parked = spawnParked(scene, rng, city);
  const peds = spawnPedestrians(scene, rng);

  // The player, on foot: a person mesh in a teal jacket.
  const playerMesh = makePersonMesh(0x2a8a8a, 0xe8b98a, false);
  scene.add(playerMesh);

  // Mission marker: a glowing column plus a floating diamond above the target.
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35 });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true), markerMat);
  marker.position.y = 20;
  scene.add(marker);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  scene.add(gem);

  // Garage marker: a green column showing where the next job starts.
  const garageMat = new THREE.MeshBasicMaterial({ color: 0x3ad86a, transparent: true, opacity: 0.3 });
  const garageMarker = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true), garageMat);
  garageMarker.position.set(GARAGE.x, 20, GARAGE.z);
  scene.add(garageMarker);

  // Shot tracer: a short-lived line from the muzzle to the hit point.
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
  tracer.visible = false;
  scene.add(tracer);

  const missions = createMissions();
  const state = {
    screen: SCREEN_TITLE,
    elapsed: 0,
    player: {
      x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, pitch: -0.15,
      health: HEALTH_MAX, money: MONEY_START, inCar: false, car: null,
      walkPhase: 0, hurtTimer: 0, speed: 0,
    },
    heat: 0,
    stars: 0,
    missions,
    traffic,
    parked,
    peds,
    policeCars: [],
    cops: [],
    camYaw: SPAWN.yaw,
    camPitch: -0.15,
    downTimer: 0, // busted / wasted overlay timer
    tracerTimer: 0,
    danger: false,
    message: '',
  };

  function starsFromHeat(heat) {
    return Math.min(5, Math.ceil(heat / HEAT_PER_STAR));
  }

  function addHeat(amount) {
    state.heat = clamp(state.heat + amount, 0, HEAT_MAX);
    state.stars = starsFromHeat(state.heat);
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.player.money,
        health: state.player.health,
        missionsDone: missions.done,
        missionIndex: missions.index,
      }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') state.player.money = data.money;
      if (typeof data.health === 'number') state.player.health = clamp(data.health, 1, HEALTH_MAX);
      if (Array.isArray(data.missionsDone)) missions.done = data.missionsDone;
      if (typeof data.missionIndex === 'number') missions.index = data.missionIndex;
      return true;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try {
      return window.localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  function respawn(fine) {
    const p = state.player;
    if (p.inCar && p.car) {
      p.car.parked = true;
      p.car.speed = 0;
      parked.push(p.car);
      p.car = null;
    }
    p.inCar = false;
    p.x = SPAWN.x;
    p.z = SPAWN.z;
    p.yaw = SPAWN.yaw;
    p.health = HEALTH_MAX;
    if (fine) p.money = Math.max(0, p.money - BUST_FINE);
    state.heat = 0;
    state.stars = 0;
    for (const car of state.policeCars) scene.remove(car.mesh);
    state.policeCars = [];
    for (const cop of state.cops) scene.remove(cop.mesh);
    state.cops = [];
    state.camYaw = SPAWN.yaw;
    state.camPitch = -0.15;
    state.downTimer = 0;
    state.screen = SCREEN_PLAY;
  }

  function nearestCar(maxDist) {
    const p = state.player;
    let best = null;
    let bestD = maxDist;
    for (const car of [...traffic, ...parked]) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car, audio) {
    const p = state.player;
    const i = traffic.indexOf(car);
    if (i >= 0) traffic.splice(i, 1);
    const j = parked.indexOf(car);
    if (j >= 0) parked.splice(j, 1);
    p.inCar = true;
    p.car = car;
    car.parked = false;
    state.camYaw = car.heading + Math.PI;
    addHeat(HEAT_STEAL_CAR);
    if (audio) audio.blip();
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    car.speed = 0;
    car.parked = true;
    parked.push(car);
    p.inCar = false;
    p.car = null;
    // Step out beside the car, on the driver's side.
    p.x = car.x + Math.cos(car.heading) * 2.2;
    p.z = car.z - Math.sin(car.heading) * 2.2;
    if (city.blocked(p.x, p.z, PLAYER_RADIUS)) {
      p.x = car.x - Math.cos(car.heading) * 2.2;
      p.z = car.z + Math.sin(car.heading) * 2.2;
    }
  }

  function punch(audio) {
    const p = state.player;
    let best = null;
    let bestD = 2.6;
    for (const ped of peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    let bestCop = null;
    for (const cop of state.cops) {
      const d = Math.hypot(cop.x - p.x, cop.z - p.z);
      if (d < bestD) { bestD = d; bestCop = cop; best = null; }
    }
    if (audio) audio.punch();
    if (best) {
      knockDown(best, 4);
      addHeat(HEAT_HIT_PED);
    } else if (bestCop) {
      knockDown(bestCop, 4);
      addHeat(HEAT_ATTACK_COP);
    }
  }

  function shoot(audio) {
    const p = state.player;
    if (audio) audio.shoot();
    const from = new THREE.Vector3(p.x, 1.4, p.z);
    const dir = new THREE.Vector3(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw)).normalize();
    // Nearest person roughly in front of the camera.
    let best = null;
    let bestD = 40;
    let bestIsCop = false;
    for (const ped of peds) {
      if (ped.down > 0) continue;
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * dir.x + dz * dir.z) / (d || 1);
      if (dot > 0.92) { bestD = d; best = ped; bestIsCop = false; }
    }
    for (const cop of state.cops) {
      const dx = cop.x - p.x;
      const dz = cop.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * dir.x + dz * dir.z) / (d || 1);
      if (dot > 0.92) { bestD = d; best = cop; bestIsCop = true; }
    }
    const to = best
      ? new THREE.Vector3(best.x, 1.2, best.z)
      : from.clone().add(dir.clone().multiplyScalar(30));
    tracerGeo.setFromPoints([from, to]);
    tracer.visible = true;
    state.tracerTimer = 0.09;
    if (best) {
      knockDown(best, 5);
      addHeat(bestIsCop ? HEAT_ATTACK_COP : HEAT_SHOOT);
    }
    state.danger = true;
  }

  function maintainPolice(dt, audio) {
    const wantCars = Math.min(MAX_POLICE_CARS, state.stars);
    while (state.policeCars.length < wantCars) {
      const a = rng() * Math.PI * 2;
      const x = clamp(state.player.x + Math.cos(a) * 45, -CITY_HALF, CITY_HALF);
      const z = clamp(state.player.z + Math.sin(a) * 45, -CITY_HALF, CITY_HALF);
      state.policeCars.push(spawnPoliceCar(scene, x, z));
    }
    while (state.policeCars.length > wantCars) {
      const car = state.policeCars.pop();
      scene.remove(car.mesh);
    }
    const wantCops = state.stars >= 2 ? Math.min(3, state.stars - 1) : 0;
    while (state.cops.length < wantCops) {
      const a = rng() * Math.PI * 2;
      state.cops.push(spawnCop(scene, rng,
        clamp(state.player.x + Math.cos(a) * 25, -CITY_HALF, CITY_HALF),
        clamp(state.player.z + Math.sin(a) * 25, -CITY_HALF, CITY_HALF)));
    }
    while (state.cops.length > wantCops) {
      const cop = state.cops.pop();
      scene.remove(cop.mesh);
    }
    for (const car of state.policeCars) {
      const dist = updatePoliceCar(car, state.player, dt, city);
      if (audio && state.stars > 0) audio.siren();
      // A police ram hurts the player.
      if (dist < 3.6 && state.player.hurtTimer <= 0) {
        state.player.health -= 8;
        state.player.hurtTimer = 0.8;
        if (state.player.inCar && state.player.car) state.player.car.speed *= 0.5;
        if (audio) audio.crash();
      }
    }
    for (const cop of state.cops) {
      const bust = updateCop(cop, dt, state.player);
      if (bust > 1.2) {
        state.screen = SCREEN_BUSTED;
        state.downTimer = 2.5;
        if (audio) audio.busted();
        return;
      }
    }
  }

  function step(dt, input, audio) {
    const p = state.player;
    if (state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED) {
      state.downTimer -= dt;
      if (state.downTimer <= 0) respawn(state.screen === SCREEN_BUSTED);
      return;
    }
    state.elapsed += dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    if (state.tracerTimer > 0) {
      state.tracerTimer -= dt;
      if (state.tracerTimer <= 0) tracer.visible = false;
    }
    state.danger = false;

    const look = input.takeLook();
    const looked = look.x !== 0 || look.y !== 0;
    state.camYaw -= look.x * 0.0032;
    state.camPitch = clamp(state.camPitch - look.y * 0.0024, -0.6, 0.5);
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      state.screen = state.screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
      return;
    }
    if (state.screen === SCREEN_PAUSED) return;

    const move = input.move();
    if (p.inCar && p.car) {
      drivePlayerCar(p.car, move, dt, city, [...traffic, ...parked, ...state.policeCars]);
      p.x = p.car.x;
      p.z = p.car.z;
      p.yaw = p.car.heading;
      // Chase camera: ease back behind the car when the mouse is still.
      if (!looked) {
        const want = p.car.heading + Math.PI;
        let diff = want - state.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        state.camYaw += diff * Math.min(1, 1.6 * dt);
      }
      if (audio) audio.engine(Math.abs(p.car.speed) / 34);
      // Running over a pedestrian is a crime.
      for (const ped of peds) {
        if (ped.down > 0) continue;
        const d = Math.hypot(ped.x - p.x, ped.z - p.z);
        if (d < 2.2 && Math.abs(p.car.speed) > 3) {
          knockDown(ped, 5);
          addHeat(HEAT_HIT_PED);
          if (audio) audio.crash();
        }
      }
    } else {
      if (audio) audio.engine(0);
      const speed = move.run ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(state.camYaw);
      const cos = Math.cos(state.camYaw);
      const fx = -sin * move.forward + cos * move.strafe;
      const fz = -cos * move.forward - sin * move.strafe;
      const len = Math.hypot(fx, fz);
      if (len > 0.01) {
        const nx = p.x + (fx / len) * speed * dt;
        const nz = p.z + (fz / len) * speed * dt;
        if (!city.blocked(nx, p.z, PLAYER_RADIUS)) p.x = nx;
        if (!city.blocked(p.x, nz, PLAYER_RADIUS)) p.z = nz;
        p.yaw = Math.atan2(fx, fz);
        p.walkPhase += dt * speed * 1.6;
        p.speed = speed;
      } else {
        p.speed = 0;
      }
      p.x = clamp(p.x, -CITY_HALF - 8, CITY_HALF + 8);
      p.z = clamp(p.z, -CITY_HALF - 8, CITY_HALF + 8);
      // Traffic can hit the player on foot.
      for (const car of traffic) {
        const d = Math.hypot(car.x - p.x, car.z - p.z);
        if (d < 2 && p.hurtTimer <= 0) {
          p.health -= 18;
          p.hurtTimer = 1;
          p.x += (p.x - car.x) * 0.6;
          p.z += (p.z - car.z) * 0.6;
          if (audio) audio.crash();
        }
      }
    }

    if (actions & ACTION_ENTER) {
      if (p.inCar) exitCar();
      else {
        const car = nearestCar(4);
        if (car) enterCar(car, audio);
      }
    }
    if (actions & ACTION_PUNCH && !p.inCar) punch(audio);
    if (actions & ACTION_SHOOT && !p.inCar) shoot(audio);

    // Heat decays while the player lays low.
    if (state.heat > 0) {
      state.heat = Math.max(0, state.heat - HEAT_DECAY * dt);
      state.stars = starsFromHeat(state.heat);
    }

    updateTraffic(traffic, dt, rng, city);
    updatePedestrians(peds, dt, p, state.danger || (p.inCar && Math.abs(p.car?.speed || 0) > 15));
    maintainPolice(dt, audio);

    // Traffic accidents: a traffic car that clips a pedestrian knocks them down.
    for (const car of traffic) {
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (Math.hypot(car.x - ped.x, car.z - ped.z) < 1.6) knockDown(ped, 3);
      }
    }

    // Missions: walk into the garage to start the next job.
    if (!missions.active && missions.index < 3) {
      const dx = p.x - GARAGE.x;
      const dz = p.z - GARAGE.z;
      if (dx * dx + dz * dz < 100) {
        const def = startNextMission(missions);
        if (def && def.id === 'heat') addHeat(65);
        if (audio && def) audio.blip();
      }
    }
    const result = updateMissions(missions, p, state.stars, dt);
    if (result === 'done') {
      // The reward belongs to the mission that just finished.
      const finished = missions.done[missions.done.length - 1];
      const def = MISSIONS.find((m) => m.id === finished);
      if (def) p.money += def.reward;
      if (audio) audio.missionDone();
      save();
    } else if (result === 'failed') {
      if (audio) audio.busted();
    }

    // Health: slow recovery when the player is safe, death when it runs out.
    if (p.health < HEALTH_MAX && state.stars === 0 && p.hurtTimer <= 0) {
      p.health = Math.min(HEALTH_MAX, p.health + 2 * dt);
    }
    if (p.health <= 0) {
      state.screen = SCREEN_WASTED;
      state.downTimer = 2.5;
      if (audio) audio.busted();
      return;
    }

    // Move the markers and the player mesh.
    const target = missionTarget(missions);
    if (target) {
      marker.visible = true;
      gem.visible = true;
      marker.position.set(target.x, 20, target.z);
      gem.position.set(target.x, 7 + Math.sin(state.elapsed * 2) * 0.5, target.z);
      gem.rotation.y += dt * 2;
      garageMarker.visible = false;
    } else {
      marker.visible = false;
      gem.visible = false;
      garageMarker.visible = missions.index < 3;
    }
    playerMesh.visible = !p.inCar;
    playerMesh.position.set(p.x, 0, p.z);
    playerMesh.rotation.y = p.yaw;
    const swing = Math.sin(p.walkPhase) * (p.speed > 0 ? 0.5 : 0);
    playerMesh.userData.legL.rotation.x = swing;
    playerMesh.userData.legR.rotation.x = -swing;

    state.message = missions.message;
  }

  return {
    state, step, save, load, hasSave,
    objective() {
      return objectiveText(missions);
    },
    /** Put the player in a car instantly (used by the screenshot scenes). */
    forceDrive() {
      const car = parked[0] || traffic[0];
      if (car) enterCar(car, null);
    },
  };
}
