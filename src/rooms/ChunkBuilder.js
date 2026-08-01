import * as THREE from 'three';
import { wallTexture, ceilingTexture, carpetTexture, metalTexture } from '../scripts/TextureFactory.js';
import { Grid } from '../system/Pathfinding.js';

export const WALL_HEIGHT = 3.2;
export const CORRIDOR_WIDTH = 4;
const LIGHT_INTENSITY_SCALE = 26;

// Accumulates geometry / colliders / metadata while a chunk is being
// procedurally assembled, then bakes a navigation Grid for entity AI.
export class ChunkBuilder {
  constructor(rng) {
    this.rng = rng;
    this.group = new THREE.Group();
    this.colliders = []; // THREE.Box3
    this.floorRects = []; // {x0,z0,x1,z1}
    this.hidingSpots = [];
    this.searchables = [];
    this.items = [];
    this.doors = [];
    this.lights = [];
    this.entitySpawn = null;
    this.hazard = null;
    this.playerSpawn = { x: 0, y: 0, z: 0.5, yaw: 0 };

    this._wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(Math.floor(rng.next() * 1000)), roughness: 0.92 });
    this._ceilMat = new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 0.8 });
    this._floorMat = new THREE.MeshStandardMaterial({ map: carpetTexture(Math.floor(rng.next() * 1000)), roughness: 1 });
    this._metalMat = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: 0.6, metalness: 0.4 });
    this._baseboardMat = new THREE.MeshStandardMaterial({ color: 0x2e2712, roughness: 0.85 });
  }

  addFloor(x0, z0, x1, z1) {
    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d);
    const mat = this._floorMat.clone();
    mat.map = mat.map.clone();
    mat.map.repeat.set(w / 2, d / 2);
    mat.map.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const ceil = new THREE.Mesh(geo.clone(), this._ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((x0 + x1) / 2, WALL_HEIGHT, (z0 + z1) / 2);
    this.group.add(ceil);

    this.floorRects.push({ x0, z0, x1, z1 });
  }

  addWallBox(cx, cz, w, d, h = WALL_HEIGHT) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, this._wallMat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Baseboard trim along the floor line - a small detail that keeps the
    // wall/floor junction from looking flat and untextured up close.
    if (h === WALL_HEIGHT) {
      const baseboard = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.02, 0.11, d + 0.02),
        this._baseboardMat
      );
      baseboard.position.set(cx, 0.055, cz);
      this.group.add(baseboard);
    }

    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(cx, h / 2, cz),
      new THREE.Vector3(w, h, d)
    );
    this.colliders.push(box);
    return mesh;
  }

  addFluorescentLight(x, z, { flicker = false, intensity = 1.1, color = 0xfff6d8 } = {}) {
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.08, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 1.5 })
    );
    fixture.position.set(x, WALL_HEIGHT - 0.06, z);
    this.group.add(fixture);

    // Three.js uses physically-based light units (candela) - a raw value of
    // ~1 is barely visible a few metres away, so the "intensity" passed in
    // here is a relative 0..~1.3 knob that gets scaled up to something that
    // actually lights a room.
    const scaledIntensity = intensity * LIGHT_INTENSITY_SCALE;
    const light = new THREE.PointLight(color, scaledIntensity, 10, 1.7);
    light.position.set(x, WALL_HEIGHT - 0.3, z);
    light.castShadow = false;
    this.group.add(light);
    this.lights.push({ light, flicker, baseIntensity: scaledIntensity, fixture });
    return light;
  }

  addProp(mesh, { collider = true } = {}) {
    this.group.add(mesh);
    if (collider) {
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push(box);
    }
    return mesh;
  }

  addHidingSpot(position, kind, radius = 1.1, extra = {}) {
    this.hidingSpots.push({ position: position.clone(), kind, radius, occupied: false, ...extra });
  }

  // A searchable container (e.g. a drawer/dresser) - not a hiding spot, but
  // something the player can press E on once to roll for loot (coins or a
  // random item).
  addSearchable(position, kind, radius = 1.1) {
    const entry = { position: position.clone(), kind, radius, searched: false };
    this.searchables.push(entry);
    return entry;
  }

  addItem(position, type, extra = {}) {
    this.items.push({ position: position.clone(), type, ...extra, collected: false, id: `${type}_${this.items.length}_${Math.floor(this.rng.next() * 100000)}` });
  }

  registerDoor(doorDef) {
    this.doors.push(doorDef);
  }

  // Rasterise the accumulated floorRects (walkable) and colliders (blocked)
  // into a Grid for A* pathfinding.
  buildGrid(cellSize = 1) {
    if (this.floorRects.length === 0) {
      this.grid = new Grid(1, 1, cellSize);
      this.gridOrigin = { x: 0, z: 0 };
      return;
    }
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const r of this.floorRects) {
      minX = Math.min(minX, r.x0); maxX = Math.max(maxX, r.x1);
      minZ = Math.min(minZ, r.z0); maxZ = Math.max(maxZ, r.z1);
    }
    const pad = 1;
    minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
    const w = Math.ceil((maxX - minX) / cellSize);
    const h = Math.ceil((maxZ - minZ) / cellSize);
    const grid = new Grid(w, h, cellSize);
    this.gridOrigin = { x: minX, z: minZ };

    for (const r of this.floorRects) {
      const cx0 = Math.floor((r.x0 - minX) / cellSize);
      const cz0 = Math.floor((r.z0 - minZ) / cellSize);
      const cx1 = Math.ceil((r.x1 - minX) / cellSize);
      const cz1 = Math.ceil((r.z1 - minZ) / cellSize);
      grid.fillRect(cx0, cz0, cx1, cz1, true);
    }
    for (const box of this.colliders) {
      if (box.min.y > 2.0) continue; // ignore stuff above head height (ceiling fixtures etc.)
      const cx0 = Math.floor((box.min.x - minX) / cellSize);
      const cz0 = Math.floor((box.min.z - minZ) / cellSize);
      const cx1 = Math.ceil((box.max.x - minX) / cellSize);
      const cz1 = Math.ceil((box.max.z - minZ) / cellSize);
      grid.fillRect(cx0, cz0, cx1, cz1, false);
    }
    this.grid = grid;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  // Allows RoomGenerator to hand over an already-authored navigation Grid
  // (used while carving corridors/rooms/mazes) instead of deriving one
  // from floorRects/colliders after the fact.
  setNavGrid(grid, originX, originZ) {
    this.grid = grid;
    this.gridOrigin = { x: originX, z: originZ };
  }

  build() {
    if (!this.grid) this.buildGrid(1);
    return {
      group: this.group,
      colliders: this.colliders,
      grid: this.grid,
      gridOrigin: this.gridOrigin,
      hidingSpots: this.hidingSpots,
      searchables: this.searchables,
      items: this.items,
      doors: this.doors,
      lights: this.lights,
      entitySpawn: this.entitySpawn,
      hazard: this.hazard,
      playerSpawn: this.playerSpawn,
      dispose: () => this.dispose()
    };
  }
}
