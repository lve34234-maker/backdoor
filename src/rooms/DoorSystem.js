import * as THREE from 'three';
import { doorTexture } from '../scripts/TextureFactory.js';
import { WALL_HEIGHT } from './ChunkBuilder.js';

const DOOR_WIDTH = 1.1;
const DOOR_HEIGHT = 2.3;

let doorIdCounter = 0;

// Creates a single door: a frame + a panel that pivots open, plus metadata
// consumed by Game.js for interaction / transition logic.
export function createDoor(builder, x, z, rotY, opts = {}) {
  const {
    isReal = true,
    isExit = true,
    locked = false,
    doorNumber = null,
    color = '#7a5a2e'
  } = opts;

  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3220, roughness: 0.9 });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH + 0.3, 0.18, 0.22), frameMat);
  frameTop.position.set(0, DOOR_HEIGHT + 0.1, 0);
  group.add(frameTop);
  const frameSideGeo = new THREE.BoxGeometry(0.12, DOOR_HEIGHT + 0.2, 0.22);
  const frameL = new THREE.Mesh(frameSideGeo, frameMat);
  frameL.position.set(-DOOR_WIDTH / 2 - 0.06, DOOR_HEIGHT / 2, 0);
  group.add(frameL);
  const frameR = frameL.clone();
  frameR.position.set(DOOR_WIDTH / 2 + 0.06, DOOR_HEIGHT / 2, 0);
  group.add(frameR);

  // Pivot at hinge (left edge) so the panel swings open realistically
  const pivot = new THREE.Object3D();
  pivot.position.set(-DOOR_WIDTH / 2, 0, 0);
  group.add(pivot);

  const panelMat = new THREE.MeshStandardMaterial({ map: doorTexture(locked ? '#4a4038' : color), roughness: 0.7 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.08), panelMat);
  panel.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
  panel.castShadow = true;
  pivot.add(panel);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4c48a, metalness: 0.7, roughness: 0.3 })
  );
  handle.position.set(DOOR_WIDTH - 0.1, DOOR_HEIGHT / 2, 0.06);
  pivot.add(handle);

  if (doorNumber != null) {
    const plate = makeNumberPlate(doorNumber);
    plate.position.set(0, DOOR_HEIGHT - 0.25, 0.12);
    pivot.add(plate);
  }

  builder.group.add(group);

  // Static closed-door collider (removed once the transition begins).
  const colliderBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, DOOR_HEIGHT / 2, z),
    new THREE.Vector3(DOOR_WIDTH + 0.2, DOOR_HEIGHT, 0.3)
  );
  builder.colliders.push(colliderBox);

  const forward = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const interactPoint = new THREE.Vector3(x, 1.4, z).add(forward.clone().multiplyScalar(0.9));

  const doorDef = {
    id: `door_${doorIdCounter++}`,
    group,
    pivot,
    isReal,
    isExit,
    locked,
    doorNumber,
    opened: false,
    swinging: false,
    targetAngle: 0,
    currentAngle: 0,
    colliderBox,
    interactPoint,
    position: new THREE.Vector3(x, 0, z),
    rotY
  };
  builder.registerDoor(doorDef);
  return doorDef;
}

function makeNumberPlate(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a12';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#d6c34b';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 120, 56);
  ctx.fillStyle = '#d6c34b';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number).padStart(2, '0'), 64, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.18), mat);
  return mesh;
}

export function swingDoorOpen(doorDef, angle = Math.PI * 0.62) {
  doorDef.swinging = true;
  doorDef.targetAngle = angle;
  doorDef.opened = true;
}

export function markDoorFake(doorDef) {
  // Visually flags a door as a known trap (small red glow / X) once revealed.
  const cross = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.85 })
  );
  cross.position.set(0, 1.3, 0.09);
  doorDef.pivot.parent.add(cross);
  doorDef.knownFake = true;
}

export function updateDoors(doors, dt) {
  for (const d of doors) {
    if (d.swinging) {
      const diff = d.targetAngle - d.currentAngle;
      d.currentAngle += diff * Math.min(1, dt * 4);
      d.pivot.rotation.y = -d.currentAngle;
      if (Math.abs(diff) < 0.02) d.swinging = false;
    }
  }
}

export function createFakeDoorPair(builder, centerX, z, rotY, rng, doorNumber) {
  const spacing = 1.9;
  const right = new THREE.Vector3(Math.sin(rotY + Math.PI / 2), 0, Math.cos(rotY + Math.PI / 2));
  const leftPos = new THREE.Vector3(centerX, 0, z).addScaledVector(right, -spacing / 2);
  const rightPos = new THREE.Vector3(centerX, 0, z).addScaledVector(right, spacing / 2);

  const realIsLeft = rng.bool(0.5);
  // Both doors show the same number plate - visually indistinguishable,
  // the player has no way to tell which is real without opening one.
  const doorLeft = createDoor(builder, leftPos.x, leftPos.z, rotY, { isReal: realIsLeft, doorNumber });
  const doorRight = createDoor(builder, rightPos.x, rightPos.z, rotY, { isReal: !realIsLeft, doorNumber });
  return [doorLeft, doorRight];
}
