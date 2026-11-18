// Cars: a box-built car mesh, traffic that drives the road grid, parked cars to
// steal, and the arcade driving model for the player's car. No physics library:
// a car is a position, a heading and a speed, with building and car-car checks
// from the city's collision model.
import * as THREE from 'three';
import { CAR_LENGTH, CAR_WIDTH, CITY_HALF, DRIVE_ACCEL, DRIVE_BRAKE, DRIVE_TOP_SPEED, PITCH, ROAD_HALF, TRAFFIC_SPEED } from './config.js';
import { floatBetween, pick } from './random.js';

const PAINT = [0xc23a2e, 0x2e6ac2, 0xe0b93a, 0x3aa84f, 0xd8d8d8, 0x2a2a2e, 0x7a4a9a, 0xc27a2e, 0x4a9a9a];
const POLICE_PAINT = 0x1a1a22;

/** Build a simple car from boxes: body, cabin, wheels, lights. Returns a Group. */
export function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? POLICE_PAINT : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH, 0.75, CAR_LENGTH), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(CAR_WIDTH - 0.3, 0.65, CAR_LENGTH * 0.45),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(x, 0.6, CAR_LENGTH / 2 + 0.02);
    group.add(light);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar.position.set(0, 1.62, -0.2);
    group.add(bar);
    const barRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barRed.position.set(-0.55, 1.62, -0.2);
    group.add(barRed);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH + 0.02, 0.3, CAR_LENGTH + 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.55;
    stripe.scale.set(1, 1, 0.28);
    group.add(stripe);
  }
  return group;
}

/** A car in the world: mesh plus its driving state. */
function makeCar(mesh, x, z, heading, speed) {
  return { mesh, x, z, heading, speed, targetSpeed: speed, damaged: 0 };
}

function syncMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

/** Spawn traffic cars on random roads, each following a road line. */
export function spawnTraffic(scene, rng, city) {
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const horizontal = rng() < 0.5;
    const line = pick(rng, city.roadLines);
    const lane = (rng() < 0.5 ? -1 : 1) * 3;
    const along = floatBetween(rng, -CITY_HALF, CITY_HALF);
    const mesh = makeCarMesh(pick(rng, PAINT), false);
    const car = makeCar(mesh, horizontal ? along : line + lane, horizontal ? line + lane : along, horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : lane > 0 ? Math.PI : 0, TRAFFIC_SPEED);
    car.horizontal = horizontal;
    car.line = line;
    car.lane = lane;
    car.dir = rng() < 0.5 ? 1 : -1;
    if (horizontal && car.dir < 0) car.heading = -Math.PI / 2;
    if (!horizontal && car.dir < 0) car.heading = 0;
    if (!horizontal && car.dir > 0) car.heading = Math.PI;
    if (horizontal && car.dir > 0) car.heading = Math.PI / 2;
    scene.add(mesh);
    syncMesh(car);
    cars.push(car);
  }
  return cars;
}

/** Parked cars along road edges; the player can steal any of them with E. */
export function spawnParked(scene, rng, city) {
  const cars = [];
  for (let i = 0; i < 10; i += 1) {
    const horizontal = rng() < 0.5;
    const line = pick(rng, city.roadLines);
    const side = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 0.6);
    const along = floatBetween(rng, -CITY_HALF + 20, CITY_HALF - 20);
    const mesh = makeCarMesh(pick(rng, PAINT), false);
    const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : rng() < 0.5 ? 0 : Math.PI;
    const car = makeCar(mesh, horizontal ? along : line + side, horizontal ? line + side : along, heading, 0);
    car.parked = true;
    scene.add(mesh);
    syncMesh(car);
    cars.push(car);
  }
  return cars;
}

/** Advance traffic: drive along the road, turn at intersections sometimes. */
export function updateTraffic(cars, dt, rng, city) {
  for (const car of cars) {
    if (car.parked || car.police) continue;
    const stepLen = car.speed * dt;
    if (car.horizontal) car.x += car.dir * stepLen;
    else car.z += car.dir * stepLen;
    // At an intersection, sometimes turn onto the crossing road.
    const pos = car.horizontal ? car.x : car.z;
    const nearest = Math.round(pos / PITCH) * PITCH;
    if (Math.abs(pos - nearest) < stepLen && rng() < 0.012) {
      car.horizontal = !car.horizontal;
      car.line = nearest;
      const lane = (rng() < 0.5 ? -1 : 1) * 3;
      car.lane = lane;
      car.dir = rng() < 0.5 ? 1 : -1;
      if (car.horizontal) {
        car.z = car.line + lane;
        car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = car.line + lane;
        car.heading = car.dir > 0 ? Math.PI : 0;
      }
    }
    // Wrap around the city edge so traffic never runs out.
    if (car.x > CITY_HALF + 10) car.x = -CITY_HALF - 10;
    if (car.x < -CITY_HALF - 10) car.x = CITY_HALF + 10;
    if (car.z > CITY_HALF + 10) car.z = -CITY_HALF - 10;
    if (car.z < -CITY_HALF - 10) car.z = CITY_HALF + 10;
    syncMesh(car);
  }
}

/** Arcade driving for the player's car: accelerate, brake, steer, collide. */
export function drivePlayerCar(car, move, dt, city, others) {
  const forward = move.forward;
  if (forward > 0) car.speed += DRIVE_ACCEL * dt;
  else if (forward < 0) car.speed -= (car.speed > 0.5 ? DRIVE_BRAKE : DRIVE_ACCEL * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-12, Math.min(DRIVE_TOP_SPEED, car.speed));
  const steer = move.strafe * (car.speed >= 0 ? 1 : -1);
  car.heading += steer * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8);
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  const nx = car.x + dx;
  const nz = car.z + dz;
  // Buildings stop the car; it slides along them instead of passing through.
  if (!city.blocked(nx, car.z, 1.6)) car.x = nx;
  else car.speed *= 0.4;
  if (!city.blocked(car.x, nz, 1.6)) car.z = nz;
  else car.speed *= 0.4;
  // Soft collision with other cars: push apart and lose speed.
  for (const other of others) {
    if (other === car || other.parked) continue;
    const ox = car.x - other.x;
    const oz = car.z - other.z;
    const d2 = ox * ox + oz * oz;
    if (d2 < 16 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      car.x = other.x + (ox / d) * 4;
      car.z = other.z + (oz / d) * 4;
      car.speed *= 0.7;
    }
  }
  car.x = Math.max(-CITY_HALF - 8, Math.min(CITY_HALF + 8, car.x));
  car.z = Math.max(-CITY_HALF - 8, Math.min(CITY_HALF + 8, car.z));
  syncMesh(car);
}

/** Create a police car that chases the player. */
export function spawnPoliceCar(scene, x, z) {
  const mesh = makeCarMesh(POLICE_PAINT, true);
  const car = makeCar(mesh, x, z, 0, 0);
  car.police = true;
  scene.add(mesh);
  syncMesh(car);
  return car;
}

/** Police chase: steer toward the player along the roads, ram on contact. */
export function updatePoliceCar(car, target, dt, city) {
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const speed = Math.min(26, 8 + dist * 0.25);
  car.speed = speed;
  const nx = car.x + Math.sin(car.heading) * speed * dt;
  const nz = car.z + Math.cos(car.heading) * speed * dt;
  if (!city.blocked(nx, car.z, 1.6)) car.x = nx;
  if (!city.blocked(car.x, nz, 1.6)) car.z = nz;
  syncMesh(car);
  return dist;
}
