/* WebGL Hintergrund: kühle Meeresfarben, stilisierte Fischschwärme, die leuchtenden Kugeln folgen. */

const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x021015, 0.018);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4, 36);

const ambient = new THREE.AmbientLight(0x224455, 1.2);
scene.add(ambient);

// ---------- Glowing orbs (Lichtkugeln) ----------
const ORB_COUNT = 4;
const orbColors = [0x6ff0e0, 0x2fae8b, 0x4fc3d9, 0xc9a86a];
const orbs = [];

const orbGeo = new THREE.SphereGeometry(0.6, 24, 24);
for (let i = 0; i < ORB_COUNT; i++) {
  const color = orbColors[i % orbColors.length];
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(orbGeo, mat);

  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(color),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(9, 9, 1);
  mesh.add(glow);

  const point = new THREE.PointLight(color, 6, 25, 2);
  mesh.add(point);

  scene.add(mesh);

  orbs.push({
    mesh,
    phase: Math.random() * Math.PI * 2,
    speed: 0.15 + Math.random() * 0.1,
    radiusX: 12 + Math.random() * 8,
    radiusZ: 8 + Math.random() * 8,
    yBase: (Math.random() - 0.5) * 8,
    yAmp: 3 + Math.random() * 2,
    offset: new THREE.Vector3(Math.random() * 20 - 10, 0, Math.random() * 20 - 10),
  });
}

function makeGlowTexture(hexColor) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const color = new THREE.Color(hexColor);
  const r = Math.floor(color.r * 255), g = Math.floor(color.g * 255), b = Math.floor(color.b * 255);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
  gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// ---------- Stylized fish (Boids) ----------
function createFishGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.25);
  shape.quadraticCurveTo(0.6, 0.22, 1.1, 0);
  shape.quadraticCurveTo(0.6, -0.22, 0, -0.25);
  shape.quadraticCurveTo(-0.3, -0.05, -0.45, -0.4);
  shape.lineTo(-0.25, 0);
  shape.lineTo(-0.45, 0.4);
  shape.quadraticCurveTo(-0.3, 0.05, 0, 0.25);
  return new THREE.ShapeGeometry(shape);
}

const fishGeo = createFishGeometry();
const fishMat = new THREE.MeshBasicMaterial({
  color: 0x9fe8e0,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
});

const FISH_COUNT = 220;
const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, FISH_COUNT);
fishMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FISH_COUNT * 3), 3);
scene.add(fishMesh);

const fishPalette = [
  new THREE.Color(0x6ff0e0),
  new THREE.Color(0x2fae8b),
  new THREE.Color(0x4fc3d9),
  new THREE.Color(0xbfeee8),
];

const bounds = { x: 26, y: 12, z: 18 };

class Fish {
  constructor() {
    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * bounds.x * 2,
      (Math.random() - 0.5) * bounds.y * 2,
      (Math.random() - 0.5) * bounds.z * 2
    );
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5),
      (Math.random() - 0.5),
      (Math.random() - 0.5)
    ).multiplyScalar(0.5);
    this.targetIndex = Math.floor(Math.random() * ORB_COUNT);
    this.scale = 0.6 + Math.random() * 0.8;
  }
}

const fish = Array.from({ length: FISH_COUNT }, () => new Fish());
const dummy = new THREE.Object3D();

const MAX_SPEED = 0.085;
const NEIGHBOR_DIST = 4.5;
const SEPARATION_DIST = 1.4;

function updateFish(delta) {
  for (let i = 0; i < FISH_COUNT; i++) {
    const f = fish[i];

    let cohesion = new THREE.Vector3();
    let separation = new THREE.Vector3();
    let alignment = new THREE.Vector3();
    let count = 0;

    for (let j = 0; j < FISH_COUNT; j += 4) {
      if (i === j) continue;
      const other = fish[j];
      const d = f.position.distanceTo(other.position);
      if (d < NEIGHBOR_DIST) {
        cohesion.add(other.position);
        alignment.add(other.velocity);
        count++;
        if (d < SEPARATION_DIST) {
          const away = new THREE.Vector3().subVectors(f.position, other.position).normalize().divideScalar(Math.max(d, 0.1));
          separation.add(away);
        }
      }
    }

    const target = orbs[f.targetIndex].mesh.position;
    const toTarget = new THREE.Vector3().subVectors(target, f.position);
    const distToTarget = toTarget.length();
    toTarget.normalize();

    if (count > 0) {
      cohesion.divideScalar(count).sub(f.position).normalize().multiplyScalar(0.018);
      alignment.divideScalar(count).normalize().multiplyScalar(0.03);
    }
    separation.normalize().multiplyScalar(0.05);
    const seek = toTarget.multiplyScalar(THREE.MathUtils.clamp(distToTarget * 0.01, 0.01, 0.05));

    f.velocity.add(cohesion).add(separation).add(alignment).add(seek);

    if (f.velocity.length() > MAX_SPEED) {
      f.velocity.setLength(MAX_SPEED);
    }
    f.velocity.multiplyScalar(0.995);

    f.position.add(f.velocity.clone().multiplyScalar(delta * 60));

    if (Math.abs(f.position.x) > bounds.x) f.velocity.x -= Math.sign(f.position.x) * 0.01;
    if (Math.abs(f.position.y) > bounds.y) f.velocity.y -= Math.sign(f.position.y) * 0.01;
    if (Math.abs(f.position.z) > bounds.z) f.velocity.z -= Math.sign(f.position.z) * 0.01;

    dummy.position.copy(f.position);
    if (f.velocity.lengthSq() > 0.0001) {
      const dir = f.velocity.clone().normalize();
      const angleY = Math.atan2(dir.x, dir.z);
      dummy.rotation.set(0, angleY + Math.PI / 2, -dir.y * 0.6);
    }
    dummy.scale.setScalar(f.scale);
    dummy.updateMatrix();
    fishMesh.setMatrixAt(i, dummy.matrix);

    if (Math.random() < 0.002) {
      f.targetIndex = Math.floor(Math.random() * ORB_COUNT);
    }
  }
  fishMesh.instanceMatrix.needsUpdate = true;
}

// color each fish once
for (let i = 0; i < FISH_COUNT; i++) {
  fishMesh.setColorAt(i, fishPalette[i % fishPalette.length]);
}
fishMesh.instanceColor.needsUpdate = true;

// ---------- Particle dust (Plankton) ----------
const DUST_COUNT = 300;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_COUNT * 3);
for (let i = 0; i < DUST_COUNT; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 60;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 30;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0x6ff0e0,
  size: 0.06,
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending,
});
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Mouse parallax ----------
let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  orbs.forEach((o) => {
    const a = t * o.speed + o.phase;
    o.mesh.position.set(
      Math.cos(a) * o.radiusX + o.offset.x * 0.2,
      o.yBase + Math.sin(a * 1.3) * o.yAmp,
      Math.sin(a) * o.radiusZ + o.offset.z * 0.2
    );
  });

  updateFish(delta);

  dust.rotation.y += delta * 0.01;

  camera.position.x += (mouseX * 5 - camera.position.x) * 0.02;
  camera.position.y += (4 - mouseY * 3 - camera.position.y) * 0.02;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
