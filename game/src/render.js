// Rendering for Port Solano: the three.js scene (sky, sun, fog), the third-person
// camera that follows the player on foot and in cars, the DOM HUD (health, money,
// wanted stars, objective, message, prompts) and the live 2D minimap.
import * as THREE from 'three';
import { CITY_HALF, GARAGE, HEALTH_MAX, PITCH, ROAD_HALF } from './config.js';
import { missionTarget } from './missions.js';

export function createRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9ab8cc, 120, 420);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.0);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  const camPos = new THREE.Vector3(0, 10, 20);
  const camLook = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // HUD elements, looked up once.
  const el = {
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    money: document.getElementById('money'),
    stars: document.getElementById('stars'),
    objective: document.getElementById('objective'),
    message: document.getElementById('message'),
    prompt: document.getElementById('prompt'),
    speed: document.getElementById('speed'),
    minimap: document.getElementById('minimap'),
    title: document.getElementById('screen-title'),
    pause: document.getElementById('screen-pause'),
    busted: document.getElementById('screen-busted'),
    wasted: document.getElementById('screen-wasted'),
  };
  const mapCtx = el.minimap.getContext('2d');

  /** Draw the top-down minimap: roads, player, cars, police, mission marker. */
  function drawMinimap(state) {
    const size = el.minimap.width;
    const scale = size / (CITY_HALF * 2 + 40);
    const toMap = (x, z) => [(x + CITY_HALF + 20) * scale, (z + CITY_HALF + 20) * scale];
    mapCtx.fillStyle = '#20262e';
    mapCtx.fillRect(0, 0, size, size);
    mapCtx.strokeStyle = '#5a636e';
    mapCtx.lineWidth = Math.max(2, ROAD_HALF * 2 * scale);
    for (let i = -3; i <= 3; i += 1) {
      const [x1, y1] = toMap(i * PITCH, -CITY_HALF - 20);
      const [x2, y2] = toMap(i * PITCH, CITY_HALF + 20);
      mapCtx.beginPath();
      mapCtx.moveTo(x1, y1);
      mapCtx.lineTo(x2, y2);
      mapCtx.stroke();
      const [x3, y3] = toMap(-CITY_HALF - 20, i * PITCH);
      const [x4, y4] = toMap(CITY_HALF + 20, i * PITCH);
      mapCtx.beginPath();
      mapCtx.moveTo(x3, y3);
      mapCtx.lineTo(x4, y4);
      mapCtx.stroke();
    }
    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    for (const car of state.traffic) dot(car.x, car.z, '#cfd6de', 2);
    for (const car of state.parked) dot(car.x, car.z, '#8a929c', 2);
    for (const car of state.policeCars) dot(car.x, car.z, '#3a7bff', 3);
    for (const cop of state.cops) dot(cop.x, cop.z, '#3a7bff', 2);
    // The garage, where jobs start, and the mission marker, pulsing.
    dot(GARAGE.x, GARAGE.z, '#3ad86a', 3);
    const target = missionTarget(state.missions);
    if (target) {
      const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
      dot(target.x, target.z, '#ffd23a', pulse);
    }
    const [px, py] = toMap(state.player.x, state.player.z);
    mapCtx.fillStyle = '#2ad8a8';
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(-state.player.yaw + Math.PI);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4.5, 5);
    mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  /** Update every HUD field from the current state. */
  function updateHud(state, objective, nearestCarDist) {
    const p = state.player;
    el.healthFill.style.width = `${Math.max(0, (p.health / HEALTH_MAX) * 100)}%`;
    el.healthFill.style.background = p.health > 50 ? '#3ad86a' : p.health > 25 ? '#e0b93a' : '#d83a3a';
    el.healthText.textContent = `${Math.ceil(p.health)}`;
    el.money.textContent = `$${p.money.toLocaleString('en-US')}`;
    el.stars.textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
    el.stars.style.color = state.stars > 0 ? '#ffd23a' : '#8a929c';
    el.objective.textContent = objective;
    if (state.message && state.missions.messageTimer > 0) {
      el.message.textContent = state.message;
      el.message.style.opacity = '1';
    } else {
      el.message.style.opacity = '0';
    }
    if (!p.inCar && nearestCarDist !== null && nearestCarDist < 4) {
      el.prompt.textContent = 'Press E to steal the car';
      el.prompt.style.opacity = '1';
    } else if (p.inCar) {
      el.prompt.textContent = 'Press E to leave the car';
      el.prompt.style.opacity = '1';
    } else {
      el.prompt.style.opacity = '0';
    }
    el.speed.textContent = p.inCar && p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
    const show = (node, on) => { if (node) node.style.display = on ? 'flex' : 'none'; };
    show(el.title, state.screen === 'title');
    show(el.pause, state.screen === 'paused');
    show(el.busted, state.screen === 'busted');
    show(el.wasted, state.screen === 'wasted');
    drawMinimap(state);
  }

  /** Where the camera wants to be and look, from the current state. */
  function cameraTarget(state) {
    const p = state.player;
    if (state.screen === 'title') {
      // Cinematic orbit around the city centre for the title backdrop: the
      // camera circles high above the streets and always looks into the city.
      return {
        pos: new THREE.Vector3(Math.sin(state.camYaw) * 55, 72, Math.cos(state.camYaw) * 55),
        look: new THREE.Vector3(0, 8, 0),
      };
    }
    let dist = 8;
    let height = 3.6;
    let lookAhead = 4;
    let lookY = 1.6;
    if (p.inCar && p.car) {
      dist = 11;
      height = 4.4;
      lookAhead = 8;
    }
    const backX = Math.sin(state.camYaw);
    const backZ = Math.cos(state.camYaw);
    return {
      pos: new THREE.Vector3(p.x + backX * dist, height + Math.sin(state.camPitch) * 4, p.z + backZ * dist),
      look: new THREE.Vector3(p.x - backX * lookAhead, lookY, p.z - backZ * lookAhead),
    };
  }

  /** Move the camera behind the player (or the car) and render the scene. */
  function draw(state, dt) {
    const target = cameraTarget(state);
    const k = 1 - Math.pow(0.0001, dt);
    camPos.x += (target.pos.x - camPos.x) * k;
    camPos.y += (target.pos.y - camPos.y) * k;
    camPos.z += (target.pos.z - camPos.z) * k;
    camera.position.copy(camPos);
    camLook.copy(target.look);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }

  /** Put the camera exactly on its target (used by the screenshot scenes). */
  function snapCamera(state) {
    const target = cameraTarget(state);
    camPos.copy(target.pos);
    camera.position.copy(camPos);
    camera.lookAt(target.look);
  }

  return { scene, camera, renderer, draw, snapCamera, updateHud, resize };
}
