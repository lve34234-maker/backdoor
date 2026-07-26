import * as THREE from 'three';

// Factory helpers that add a piece of hideable furniture (mesh + collider)
// to a ChunkBuilder and register the interaction point players walk up to
// and press E on.

function woodMat() {
  return new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 });
}

export function createLocker(builder, x, z, rotY = 0) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.6), builder._metalMat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.0, 0.62), new THREE.MeshStandardMaterial({ color: 0x222 }));
  group.add(seam);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  builder.addProp(group);

  const facing = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const spotPos = new THREE.Vector3(x, 1.0, z).add(facing.clone().multiplyScalar(0.5));
  builder.addHidingSpot(spotPos, 'locker', 1.1);
  return group;
}

// The primary hiding spot: a tall wooden wardrobe with two visible doors,
// a cornice on top and small feet - the classic "closet you hide in".
export function createWardrobe(builder, x, z, rotY = 0) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.8 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2e1f14, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc9b98a, metalness: 0.6, roughness: 0.35 });

  const width = 1.0, height = 2.05, depth = 0.58;

  const carcass = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
  carcass.position.y = height / 2;
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  group.add(carcass);

  // Cornice (top trim, slightly overhanging)
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.08, depth + 0.08), trimMat);
  cornice.position.y = height + 0.04;
  group.add(cornice);

  // Two door panels with a visible centre seam
  const doorW = width / 2 - 0.02;
  const doorH = height - 0.16;
  [-1, 1].forEach((side) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.04), doorMat);
    door.position.set((side * doorW) / 2 + side * 0.01, height / 2, depth / 2 + 0.02);
    group.add(door);

    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), metalMat);
    handle.position.set(side * 0.06, height / 2, depth / 2 + 0.06);
    group.add(handle);
  });

  // Small feet
  const footGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(footGeo, trimMat);
    foot.position.set(fx * (width / 2 - 0.08), 0.04, fz * (depth / 2 - 0.08));
    group.add(foot);
  });

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  builder.addProp(group);

  const facing = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const spotPos = new THREE.Vector3(x, 1.0, z).add(facing.clone().multiplyScalar(0.55));
  builder.addHidingSpot(spotPos, 'wardrobe', 1.15);
  return group;
}

export function createCabinet(builder, x, z, rotY = 0) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.55), woodMat());
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  builder.addProp(group);

  const facing = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const spotPos = new THREE.Vector3(x, 0.8, z).add(facing.clone().multiplyScalar(0.5));
  builder.addHidingSpot(spotPos, 'cabinet', 1.1);
  return group;
}

export function createDeskHide(builder, x, z, rotY = 0) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), woodMat());
  top.position.y = 0.75;
  top.castShadow = true;
  group.add(top);
  const legGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
  [[-0.72, -0.4], [0.72, -0.4], [-0.72, 0.4], [0.72, 0.4]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat());
    leg.position.set(lx, 0.375, lz);
    group.add(leg);
  });
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  builder.addProp(group, { collider: false });

  // A slim collider only for the desk top's legs footprint isn't essential;
  // the desk is walk-under, so no full-box collider is added.
  builder.addHidingSpot(new THREE.Vector3(x, 0.4, z), 'desk', 1.2);
  return group;
}

export function createBoxStack(builder, x, z) {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xa9895a, roughness: 1 });
  const positions = [[0, 0.3, 0], [0.35, 0.3, 0.1], [0.1, 0.9, 0.05]];
  positions.forEach(([bx, by, bz]) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), boxMat);
    box.position.set(bx, by, bz);
    box.castShadow = true;
    group.add(box);
  });
  group.position.set(x, 0, z);
  builder.addProp(group);
  builder.addHidingSpot(new THREE.Vector3(x - 0.6, 0.5, z), 'boxes', 1.1);
  return group;
}

export function createBedHide(builder, x, z, rotY = 0) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 2.0), woodMat());
  frame.position.y = 0.2;
  frame.castShadow = true;
  group.add(frame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 1.95), new THREE.MeshStandardMaterial({ color: 0xdedad0 }));
  mattress.position.y = 0.5;
  group.add(mattress);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  builder.addProp(group, { collider: false });
  builder.addHidingSpot(new THREE.Vector3(x, 0.15, z), 'bed', 1.3);
  return group;
}

export function createVent(builder, x, z, rotY = 0) {
  const grate = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x333, metalness: 0.6, roughness: 0.4 })
  );
  grate.position.set(x, 1.2, z);
  grate.rotation.y = rotY;
  builder.addProp(grate, { collider: false });
  const facing = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  builder.addHidingSpot(new THREE.Vector3(x, 1.2, z).add(facing.clone().multiplyScalar(0.4)), 'vent', 1.0);
  return grate;
}

export const HIDING_FACTORIES = [createLocker, createCabinet, createDeskHide, createBoxStack, createBedHide, createVent, createWardrobe];

// The wardrobe ("옷장") is the signature hiding spot - it appears far more
// often than the other furniture, which just adds variety.
const WEIGHTED_HIDING_FACTORIES = [
  { value: createWardrobe, weight: 5 },
  { value: createLocker, weight: 1.2 },
  { value: createCabinet, weight: 1 },
  { value: createDeskHide, weight: 0.8 },
  { value: createBoxStack, weight: 0.8 },
  { value: createBedHide, weight: 0.6 },
  { value: createVent, weight: 0.6 }
];

export function scatterHidingSpots(builder, rng, spots) {
  // spots: [{x,z,rotY}]
  spots.forEach(({ x, z, rotY = 0 }) => {
    const factory = rng.weightedPick(WEIGHTED_HIDING_FACTORIES);
    factory(builder, x, z, rotY);
  });
}
