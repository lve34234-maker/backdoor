import * as THREE from 'three';

const MIN_DIM = 0.2;
const MAX_DIM = 4;
const PLACE_RANGE = 6;
const MIN_HIT_DIST = 0.35;

// A lightweight Minecraft-style block placement system: the player aims
// with the camera, picks a block size (width/height/depth, entirely their
// choice), and places/removes axis-aligned blocks. Placed blocks are real
// colliders and also carve the entity navigation grid, so a barricade
// genuinely blocks pursuers - not just the player.
export class BuildSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.active = false;
    this.width = 1;
    this.height = 1;
    this.depth = 1;
    this.material = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8, metalness: 0.05 });
    this.previewMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x8ad6ff, transparent: true, opacity: 0.35 })
    );
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
    this.placed = []; // { mesh, box, cells, grid }
    this._lastPlacePos = null;
    this._hasValidTarget = false;
  }

  setDimensions(w, h, d) {
    this.width = THREE.MathUtils.clamp(w, MIN_DIM, MAX_DIM);
    this.height = THREE.MathUtils.clamp(h, MIN_DIM, MAX_DIM);
    this.depth = THREE.MathUtils.clamp(d, MIN_DIM, MAX_DIM);
  }

  toggle(force) {
    this.active = force != null ? force : !this.active;
    this.previewMesh.visible = false;
    return this.active;
  }

  // Called whenever the chunk changes - placed blocks live inside the old
  // chunk's group, which is already being disposed, so just forget them.
  reset() {
    this.placed = [];
    this.previewMesh.visible = false;
  }

  _computeHit(chunkGroup) {
    if (!chunkGroup) return null;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this.raycaster.set(this.camera.position, dir);
    this.raycaster.far = PLACE_RANGE;
    const targets = [chunkGroup, ...this.placed.map((p) => p.mesh)];
    const hits = this.raycaster.intersectObjects(targets, true);
    return hits.find((h) => h.distance > MIN_HIT_DIST) || null;
  }

  update(chunk) {
    if (!this.active) return;
    const hit = chunk ? this._computeHit(chunk.group) : null;
    if (!hit) {
      this._hasValidTarget = false;
      this.previewMesh.visible = false;
      return;
    }
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);
    const halfExtent = 0.5 * (Math.abs(normal.x) * this.width + Math.abs(normal.y) * this.height + Math.abs(normal.z) * this.depth);
    const pos = hit.point.clone().addScaledVector(normal, halfExtent + 0.005);

    if (this.previewMesh.geometry.parameters.width !== this.width ||
        this.previewMesh.geometry.parameters.height !== this.height ||
        this.previewMesh.geometry.parameters.depth !== this.depth) {
      this.previewMesh.geometry.dispose();
      this.previewMesh.geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
    }
    this.previewMesh.position.copy(pos);
    this.previewMesh.visible = true;
    this._lastPlacePos = pos;
    this._hasValidTarget = true;
  }

  place(chunk) {
    if (!this.active || !this._hasValidTarget || !chunk) return false;
    const pos = this._lastPlacePos.clone();
    const geo = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const mesh = new THREE.Mesh(geo, this.material.clone());
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chunk.group.add(mesh);

    const box = new THREE.Box3().setFromCenterAndSize(pos, new THREE.Vector3(this.width, this.height, this.depth));
    chunk.colliders.push(box);

    const cells = [];
    if (chunk.grid && chunk.gridOrigin) {
      const cs = chunk.grid.cellSize;
      const cx0 = Math.floor((box.min.x - chunk.gridOrigin.x) / cs);
      const cz0 = Math.floor((box.min.z - chunk.gridOrigin.z) / cs);
      const cx1 = Math.ceil((box.max.x - chunk.gridOrigin.x) / cs);
      const cz1 = Math.ceil((box.max.z - chunk.gridOrigin.z) / cs);
      for (let z = cz0; z < cz1; z++) {
        for (let x = cx0; x < cx1; x++) {
          cells.push({ x, z });
          chunk.grid.setWalkable(x, z, false);
        }
      }
    }
    this.placed.push({ mesh, box, cells, grid: chunk.grid });
    return true;
  }

  removeTargeted(chunk) {
    if (!chunk || !this.placed.length) return false;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this.raycaster.set(this.camera.position, dir);
    this.raycaster.far = PLACE_RANGE;
    const hits = this.raycaster.intersectObjects(this.placed.map((p) => p.mesh), false);
    if (!hits.length) return false;
    const idx = this.placed.findIndex((p) => p.mesh === hits[0].object);
    return this._removeAt(chunk, idx);
  }

  // Undo the most recently placed block regardless of where the camera is
  // aiming - a plain Ctrl/Z-style "oops" key rather than an aimed removal.
  undoLast(chunk) {
    if (!chunk || !this.placed.length) return false;
    return this._removeAt(chunk, this.placed.length - 1);
  }

  _removeAt(chunk, idx) {
    if (idx === -1 || idx == null || !this.placed[idx]) return false;
    const entry = this.placed[idx];
    chunk.group.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
    const colliderIdx = chunk.colliders.indexOf(entry.box);
    if (colliderIdx !== -1) chunk.colliders.splice(colliderIdx, 1);
    if (entry.grid) entry.cells.forEach(({ x, z }) => entry.grid.setWalkable(x, z, true));
    this.placed.splice(idx, 1);
    return true;
  }
}
