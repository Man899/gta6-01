// Pedestrians and on-foot police. Pedestrians stroll the sidewalks on fixed
// routes, panic and run when a car comes at them or a shot is fired, and fall
// when hit. Police officers on foot chase the player when the wanted level is
// high and try to arrest him on contact.
import * as THREE from 'three';
import { CITY_HALF, PED_COUNT, PED_SPEED, PITCH, ROAD_HALF } from './config.js';
import { floatBetween, pick } from './random.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c94a, 0xd84ad0, 0x7a4ad8, 0xe0e0e0, 0x4ad8c9];
const SKINS = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

/** A simple person: capsule body, head, legs that swing while walking. */
export function makePersonMesh(shirt, skin, police) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: police ? 0x1a2a4a : shirt }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  if (police) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x0a1a3a }),
    );
    cap.position.y = 1.98;
    group.add(cap);
  }
  const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  const legMat = new THREE.MeshLambertMaterial({ color: police ? 0x1a2a4a : 0x2a2a33 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.14, 0.28, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.14, 0.28, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

/** Spawn pedestrians walking the sidewalk edges of random blocks. */
export function spawnPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const bx = Math.floor(rng() * 7) - 3;
    const bz = Math.floor(rng() * 7) - 3;
    const edge = Math.floor(rng() * 4);
    const t = floatBetween(rng, 0, 1);
    let x;
    let z;
    if (edge === 0) { x = bx * PITCH + ROAD_HALF + t * (PITCH - ROAD_HALF * 2); z = bz * PITCH + ROAD_HALF + 1.2; }
    else if (edge === 1) { x = bx * PITCH + ROAD_HALF + t * (PITCH - ROAD_HALF * 2); z = (bz + 1) * PITCH - ROAD_HALF - 1.2; }
    else if (edge === 2) { x = bx * PITCH + ROAD_HALF + 1.2; z = bz * PITCH + ROAD_HALF + t * (PITCH - ROAD_HALF * 2); }
    else { x = (bx + 1) * PITCH - ROAD_HALF - 1.2; z = bz * PITCH + ROAD_HALF + t * (PITCH - ROAD_HALF * 2); }
    const mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, SKINS), false);
    const ped = {
      mesh, x, z, heading: rng() * Math.PI * 2, speed: PED_SPEED * floatBetween(rng, 0.7, 1.3),
      state: 'walk', panic: 0, down: 0, walkPhase: rng() * 6, bx, bz, edge,
      dir: rng() < 0.5 ? 1 : -1,
    };
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push(ped);
  }
  return peds;
}

/** Walk a pedestrian along its sidewalk edge; panic makes it run away. */
export function updatePedestrians(peds, dt, playerPos, danger) {
  for (const ped of peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
        ped.state = 'walk';
      }
      continue;
    }
    const dx = ped.x - playerPos.x;
    const dz = ped.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    if (danger || dist < 6) {
      ped.state = 'panic';
      ped.panic = 2;
    }
    if (ped.panic > 0) ped.panic -= dt;
    if (ped.state === 'panic' && ped.panic <= 0) {
      ped.state = 'walk';
      // Step back onto the sidewalk edge after fleeing.
      if (ped.edge === 0) ped.z = ped.bz * PITCH + ROAD_HALF + 1.2;
      if (ped.edge === 1) ped.z = (ped.bz + 1) * PITCH - ROAD_HALF - 1.2;
      if (ped.edge === 2) ped.x = ped.bx * PITCH + ROAD_HALF + 1.2;
      if (ped.edge === 3) ped.x = (ped.bx + 1) * PITCH - ROAD_HALF - 1.2;
    }
    let speed = ped.speed;
    let heading = ped.heading;
    if (ped.state === 'panic') {
      speed = ped.speed * 3.2;
      heading = Math.atan2(dx, dz);
    } else {
      // Stroll along the sidewalk edge; turn around at the block corner.
      const along = ped.edge < 2 ? ped.x : ped.z;
      const lo = ped.edge < 2 ? ped.bx * PITCH + ROAD_HALF + 1 : ped.bz * PITCH + ROAD_HALF + 1;
      const hi = ped.edge < 2 ? (ped.bx + 1) * PITCH - ROAD_HALF - 1 : (ped.bz + 1) * PITCH - ROAD_HALF - 1;
      if (along >= hi) ped.dir = -1;
      if (along <= lo) ped.dir = 1;
      if (ped.edge === 0 || ped.edge === 1) heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      else heading = ped.dir > 0 ? 0 : Math.PI;
    }
    ped.heading = heading;
    ped.x += Math.sin(heading) * speed * dt;
    ped.z += Math.cos(heading) * speed * dt;
    ped.x = Math.max(-CITY_HALF, Math.min(CITY_HALF, ped.x));
    ped.z = Math.max(-CITY_HALF, Math.min(CITY_HALF, ped.z));
    ped.walkPhase += dt * speed * 2.4;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = heading;
  }
}

/** Knock a pedestrian down: it lies flat for a while, then gets up. */
export function knockDown(ped, seconds) {
  ped.down = seconds;
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.3;
}

/** Spawn one on-foot police officer near the player. */
export function spawnCop(scene, rng, x, z) {
  const mesh = makePersonMesh(0x1a2a4a, pick(rng, SKINS), true);
  const cop = { mesh, x, z, heading: 0, speed: 5.2, walkPhase: 0, bust: 0 };
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return cop;
}

/** A cop runs at the player; touching the player starts an arrest. */
export function updateCop(cop, dt, playerPos) {
  const dx = playerPos.x - cop.x;
  const dz = playerPos.z - cop.z;
  const dist = Math.hypot(dx, dz);
  const heading = Math.atan2(dx, dz);
  cop.heading = heading;
  cop.x += Math.sin(heading) * cop.speed * dt;
  cop.z += Math.cos(heading) * cop.speed * dt;
  cop.walkPhase += dt * 12;
  const swing = Math.sin(cop.walkPhase) * 0.6;
  cop.mesh.userData.legL.rotation.x = swing;
  cop.mesh.userData.legR.rotation.x = -swing;
  cop.mesh.position.set(cop.x, 0, cop.z);
  cop.mesh.rotation.y = heading;
  if (dist < 1.4) cop.bust += dt;
  else cop.bust = Math.max(0, cop.bust - dt * 2);
  return cop.bust;
}
