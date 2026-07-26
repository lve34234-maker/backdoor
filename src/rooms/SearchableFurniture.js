import * as THREE from 'three';

// A chest of drawers ("서랍장") the player can search once for loot -
// distinct from hiding-spot furniture (HidingSpots.js): this isn't
// somewhere to hide, it's a container to rummage through.
export function createDrawer(builder, x, z, rotY = 0) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4f3c28, roughness: 0.82 });
  const frontMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.7 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xb7a06a, metalness: 0.65, roughness: 0.35 });

  const width = 0.9, height = 0.95, depth = 0.5;

  const carcass = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
  carcass.position.y = height / 2;
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  group.add(carcass);

  // Three stacked drawer fronts, each with a small handle.
  const drawerCount = 3;
  const drawerH = (height - 0.1) / drawerCount;
  for (let i = 0; i < drawerCount; i++) {
    const front = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, drawerH - 0.03, 0.03), frontMat);
    const y = drawerH * i + drawerH / 2 + 0.05;
    front.position.set(0, y, depth / 2 + 0.015);
    group.add(front);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, y, depth / 2 + 0.05);
    group.add(handle);
  }

  // Small feet
  const footGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x2e2115, roughness: 0.9 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(fx * (width / 2 - 0.06), 0.03, fz * (depth / 2 - 0.06));
    group.add(foot);
  });

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  builder.addProp(group);

  const facing = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
  const spotPos = new THREE.Vector3(x, 0.8, z).add(facing.clone().multiplyScalar(0.55));
  builder.addSearchable(spotPos, 'drawer', 1.15);
  return group;
}
