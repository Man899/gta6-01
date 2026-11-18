// Port Solano itself: a sun-soaked grid city built from boxes, with procedural
// facade textures painted on canvas at boot (no image files). It also owns the
// collision model: a list of building footprints the world tests against, and
// helpers that say whether a point is on a road or inside a building.
import * as THREE from 'three';
import { CITY_HALF, GRID, PITCH, ROAD_HALF } from './config.js';
import { floatBetween, intBetween, pick } from './random.js';

const WALL_COLORS = [0xd9c9a8, 0xc9b18c, 0xb7a6c9, 0x9fb8c8, 0xd8a08c, 0xa8c8a0, 0xe0d4c0, 0x8fa8b8];
const ROOF_COLORS = [0x7a6a58, 0x5a6a7a, 0x8a5a4a, 0x6a7a5a];

/** Paint a lit-window facade onto a canvas and return it as a texture. */
function facadeTexture(rng, base, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 256);
  const cellW = 128 / cols;
  const cellH = 256 / floors;
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng() < 0.55;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3a4a';
      g.fillRect(c * cellW + 4, f * cellH + 5, cellW - 8, cellH - 10);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A small palm tree: trunk cylinder and a fan of flat leaves. */
function makePalm(rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 4.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  trunk.position.y = 2.1;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a8a4a, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    leaf.position.set(Math.cos(a) * 1.1, 4.4, Math.sin(a) * 1.1);
    leaf.rotation.set(-0.5, -a + Math.PI / 2, 0);
    leaf.rotation.order = 'YXZ';
    group.add(leaf);
  }
  return group;
}

/**
 * Build the city into `scene`. Returns the collision model and the road lines:
 * { blocked(x, z, r), onRoad(x, z), roadLines, buildings, bounds }.
 * `blocked` is true when a circle of radius r at (x, z) overlaps a building.
 */
export function buildCity(scene, rng) {
  const buildings = []; // { minX, maxX, minZ, maxZ }
  const group = new THREE.Group();
  group.name = 'city';

  // Ground: warm sand-coloured slab for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 80, CITY_HALF * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0xcbb98f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: dark asphalt strips along every grid line, both directions.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const roadLen = CITY_HALF * 2 + ROAD_HALF * 2;
  for (let i = -GRID; i <= GRID; i += 1) {
    const c = i * PITCH;
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_HALF * 2), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.02, c);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, roadLen), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.02, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    // Centre dashes.
    for (let d = -CITY_HALF; d < CITY_HALF; d += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.35), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.04, c);
      group.add(dash);
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(c, 0.04, d);
      group.add(dashV);
    }
  }

  // Blocks: between the roads, 1-4 buildings each, plus sidewalks and palms.
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  for (let bx = -GRID; bx < GRID; bx += 1) {
    for (let bz = -GRID; bz < GRID; bz += 1) {
      const minX = bx * PITCH + ROAD_HALF;
      const maxX = (bx + 1) * PITCH - ROAD_HALF;
      const minZ = bz * PITCH + ROAD_HALF;
      const maxZ = (bz + 1) * PITCH - ROAD_HALF;
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX + 4, maxZ - minZ + 4), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set((minX + maxX) / 2, 0.01, (minZ + maxZ) / 2);
      walk.receiveShadow = true;
      group.add(walk);

      const count = intBetween(rng, 1, 4);
      if (count === 1) {
        addBuilding(group, buildings, rng, minX + 4, maxX - 4, minZ + 4, maxZ - 4, true);
      } else {
        const midX = (minX + maxX) / 2;
        const midZ = (minZ + maxZ) / 2;
        addBuilding(group, buildings, rng, minX + 2, midX - 2, minZ + 2, midZ - 2, false);
        addBuilding(group, buildings, rng, midX + 2, maxX - 2, minZ + 2, midZ - 2, false);
        addBuilding(group, buildings, rng, minX + 2, midX - 2, midZ + 2, maxZ - 2, false);
        addBuilding(group, buildings, rng, midX + 2, maxX - 2, midZ + 2, maxZ - 2, false);
      }

      // A palm or two on the block corners.
      for (let p = 0; p < 2; p += 1) {
        const palm = makePalm(rng);
        palm.position.set(
          floatBetween(rng, minX + 2, maxX - 2),
          0,
          pick(rng, [minZ + 2, maxZ - 2]),
        );
        group.add(palm);
      }
    }
  }

  // Street lamps along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let d = -CITY_HALF + 20; d < CITY_HALF; d += 58) {
      for (const [x, z] of [[i * PITCH + ROAD_HALF + 0.8, d], [d, i * PITCH + ROAD_HALF + 0.8]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6), poleMat);
        pole.position.set(x, 2.75, z);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(x, 5.6, z);
        group.add(lamp);
      }
    }
  }

  // The sea to the south: a blue plane beyond the city edge, for the skyline.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.MeshLambertMaterial({ color: 0x2a6a9a }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.1, CITY_HALF + 160);
  group.add(sea);

  scene.add(group);

  const roadLines = [];
  for (let i = -GRID; i <= GRID; i += 1) roadLines.push(i * PITCH);

  function blocked(x, z, r) {
    if (Math.abs(x) > CITY_HALF + 30 || Math.abs(z) > CITY_HALF + 30) return true;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
    }
    return false;
  }

  function onRoad(x, z) {
    for (const c of roadLines) {
      if (Math.abs(x - c) < ROAD_HALF + 1 || Math.abs(z - c) < ROAD_HALF + 1) return true;
    }
    return false;
  }

  return { blocked, onRoad, roadLines, buildings, bounds: CITY_HALF };
}

function addBuilding(group, buildings, rng, minX, maxX, minZ, maxZ, landmark) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 6 || d < 6) return;
  const height = landmark ? floatBetween(rng, 34, 58) : floatBetween(rng, 10, 30);
  const base = pick(rng, WALL_COLORS);
  const floors = Math.max(2, Math.round(height / 4));
  const cols = Math.max(2, Math.round(w / 5));
  const tex = facadeTexture(rng, base, floors, cols);
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mat);
  mesh.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
    new THREE.MeshLambertMaterial({ color: pick(rng, ROOF_COLORS) }),
  );
  roof.position.set((minX + maxX) / 2, height + 0.4, (minZ + maxZ) / 2);
  group.add(roof);
  // Rooftop box (AC unit / stair house) so the skyline is not flat.
  if (rng() < 0.6) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: 0x6a6a6a }),
    );
    box.position.set((minX + maxX) / 2 + floatBetween(rng, -w / 4, w / 4), height + 1.6, (minZ + maxZ) / 2);
    group.add(box);
  }
  buildings.push({ minX, maxX, minZ, maxZ });
}
