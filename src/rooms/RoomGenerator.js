import * as THREE from 'three';
import { ChunkBuilder, CORRIDOR_WIDTH } from './ChunkBuilder.js';
import { carveCorridor, carveRoomRect, carveMaze, emitWallsFromGrid, cellCenterWorld } from './GridWorld.js';
import { Grid } from '../system/Pathfinding.js';
import { createDoor, createFakeDoorPair } from './DoorSystem.js';
import { scatterHidingSpots, createWardrobe, createBoxStack } from './HidingSpots.js';
import { createDrawer } from './SearchableFurniture.js';
import { pickHazard } from './Traps.js';

// Doors 1 and 2 are always entity-free so a new player can learn the
// controls (movement, doors, hiding) before anything starts hunting them.
const SAFE_DOORS = 3;

const ENTITY_WEIGHTS_BY_DANGER = (danger) => [
  { value: null, weight: Math.max(0.4, 3.2 - danger * 2.4) },
  { value: 'crawler', weight: 1.4 },
  { value: 'watcher', weight: 1.3 },
  { value: 'monster', weight: 1.1 },
  { value: 'fakehuman', weight: 0.8 + danger * 0.6 },
  { value: 'rush', weight: 0.4 + danger * 1.2 },
  { value: 'shadow', weight: 0.5 + danger * 0.8 },
  { value: 'unknown', weight: 0.08 + danger * 0.12 }
];

function chooseChunkType(rng, doorIndex) {
  const danger = Math.min(1, doorIndex / 70);
  if (doorIndex === 99) return 'finale';
  return rng.weightedPick([
    { value: 'corridor', weight: 4 },
    { value: 'room', weight: 2.6 },
    { value: 'maze', weight: 1.2 + danger * 1.8 },
    { value: 'deadend_fake', weight: 0.9 + danger * 1.4 },
    { value: 'hiding_room', weight: 1.0 + danger * 1.0 }
  ]);
}

function randomWalkableFarCell(grid, avoidX, avoidZ, minDist = 6, rng) {
  let best = null, bestDist = -1;
  const rand = rng ? () => rng.next() : Math.random;
  for (let tries = 0; tries < 40; tries++) {
    const cx = Math.floor(rand() * grid.width);
    const cz = Math.floor(rand() * grid.height);
    if (!grid.isWalkable(cx, cz)) continue;
    const d = Math.hypot(cx - avoidX, cz - avoidZ);
    if (d > bestDist) { bestDist = d; best = { cx, cz }; }
    if (d >= minDist && tries > 8) return { cx, cz };
  }
  return best;
}

function placeItemsAndEntity(builder, grid, originX, originZ, rng, doorIndex, opts = {}) {
  const danger = Math.min(1, doorIndex / 70);
  const entryCell = { x: Math.floor((0 - originX) / grid.cellSize), z: Math.floor((0.5 - originZ) / grid.cellSize) };

  // Items: battery / health pack / key, chance scales mildly with danger.
  const itemRolls = [
    { type: 'battery', chance: 0.28 },
    { type: 'health', chance: 0.18 + danger * 0.1 }
  ];
  itemRolls.forEach(({ type, chance }) => {
    if (rng.bool(chance)) {
      const cell = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 3, rng);
      if (cell) {
        const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
        addPickupMesh(builder, world.x, world.z, type);
      }
    }
  });

  let lockedExit = false;
  if (opts.allowLock && rng.bool(0.06 + danger * 0.08)) {
    lockedExit = true;
    const cell = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 3, rng);
    if (cell) {
      const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
      addPickupMesh(builder, world.x, world.z, 'key');
    }
  }

  // Entity spawn - the first couple of doors are kept safe so new players
  // get a feel for movement/doors before anything starts hunting them.
  const entitiesAllowed = doorIndex >= SAFE_DOORS;
  const entityType = entitiesAllowed ? rng.weightedPick(ENTITY_WEIGHTS_BY_DANGER(danger)) : null;
  if (entitiesAllowed && entityType && !opts.forceNoEntity) {
    const cell = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 5, rng);
    if (cell) {
      const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
      builder.entitySpawn = { type: entityType, position: new THREE.Vector3(world.x, 0, world.z) };
    }
  } else if (entitiesAllowed && opts.forceEntity) {
    const cell = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 5, rng);
    if (cell) {
      const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
      builder.entitySpawn = { type: opts.forceEntity, position: new THREE.Vector3(world.x, 0, world.z) };
    }
  }

  return { lockedExit };
}

// Rejection-sampling helper so furniture placed in the same room doesn't
// end up stacked on top of / overlapping each other.
function pickSpacedPoint(rng, x0, z0, w, h, margin, minDist, placed) {
  let best = null;
  for (let tries = 0; tries < 20; tries++) {
    const rx = x0 + rng.range(margin, Math.max(margin + 0.01, w - margin));
    const rz = z0 + rng.range(margin, Math.max(margin + 0.01, h - margin));
    if (placed.every((p) => Math.hypot(rx - p.x, rz - p.z) >= minDist)) {
      best = { rx, rz };
      break;
    }
    best = { rx, rz };
  }
  placed.push({ x: best.rx, z: best.rz });
  return best;
}

function addPickupMesh(builder, x, z, type) {
  const colors = { battery: 0x2fbf4f, health: 0xd63b3b, key: 0xd6c34b };
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({ color: colors[type] || 0xffffff, emissive: colors[type] || 0x222222, emissiveIntensity: 0.6 })
  );
  mesh.position.set(x, 0.5, z);
  mesh.userData.spin = true;
  builder.addProp(mesh, { collider: false });
  builder.addItem(new THREE.Vector3(x, 0.5, z), type, { mesh });
}

// ---------------- Chunk type builders ----------------

function buildCorridorChunk(rng, doorIndex) {
  const builder = new ChunkBuilder(rng);
  const width = 40, height = 50;
  const grid = new Grid(width, height, 1);
  const marginX = Math.floor(width / 2);
  const originX = -marginX;
  const originZ = 0;

  const length1 = rng.int(12, 22);
  let end = carveCorridor(grid, marginX, 0, length1, { dx: 0, dy: 1 }, CORRIDOR_WIDTH);
  let exitDir = { dx: 0, dy: 1 };

  if (rng.bool(0.32)) {
    const turnDx = rng.bool(0.5) ? 1 : -1;
    const length2 = rng.int(8, 16);
    end = carveCorridor(grid, end.x, end.y, length2, { dx: turnDx, dy: 0 }, CORRIDOR_WIDTH);
    exitDir = { dx: turnDx, dy: 0 };
  }

  const exitWorld = cellCenterWorld(end.x, end.y, originX, originZ, 1);
  const exitYaw = exitDir.dx === 1 ? Math.PI / 2 : exitDir.dx === -1 ? -Math.PI / 2 : 0;

  const gapAxis = exitDir.dy !== 0 ? 'h' : 'v';
  const gapIndex = exitDir.dy !== 0 ? end.y : end.x;
  const gapCenterCell = exitDir.dy !== 0 ? end.x : end.y;
  const doorGaps = [{ axis: gapAxis, index: gapIndex, from: gapCenterCell - Math.ceil(CORRIDOR_WIDTH / 2) + 1, to: gapCenterCell + Math.floor(CORRIDOR_WIDTH / 2) }];

  emitWallsFromGrid(builder, grid, originX, originZ, doorGaps);

  // Lights along the path every ~6 cells
  const lightSpacing = 6;
  for (let i = 3; i < length1; i += lightSpacing) {
    const c = cellCenterWorld(marginX, i, originX, originZ, 1);
    builder.addFluorescentLight(c.x, c.z);
  }

  // Occasional wall-mounted hiding spot along the corridor
  if (rng.bool(0.45)) {
    const spotZ = rng.range(4, Math.max(5, length1 - 3));
    const side = rng.bool(0.5) ? -1 : 1;
    const c = cellCenterWorld(marginX + side * (CORRIDOR_WIDTH / 2 - 0.5), spotZ, originX, originZ, 1);
    createWardrobe(builder, c.x, c.z, side === 1 ? -Math.PI / 2 : Math.PI / 2);
  }

  // Occasional searchable drawer along the corridor, on its own wall spot
  if (rng.bool(0.35)) {
    const spotZ = rng.range(4, Math.max(5, length1 - 3));
    const side = rng.bool(0.5) ? -1 : 1;
    const c = cellCenterWorld(marginX + side * (CORRIDOR_WIDTH / 2 - 0.4), spotZ, originX, originZ, 1);
    createDrawer(builder, c.x, c.z, side === 1 ? -Math.PI / 2 : Math.PI / 2);
  }

  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  const { lockedExit } = placeItemsAndEntity(builder, grid, originX, originZ, rng, doorIndex, { allowLock: true });
  createDoor(builder, exitWorld.x, exitWorld.z, exitYaw, { doorNumber: doorIndex, locked: lockedExit });

  builder.hazard = pickHazard(rng, doorIndex);
  return builder.build();
}

function buildRoomChunk(rng, doorIndex, { hiding = false } = {}) {
  const builder = new ChunkBuilder(rng);
  const width = 44, height = 44;
  const grid = new Grid(width, height, 1);
  const marginX = Math.floor(width / 2);
  const originX = -marginX;
  const originZ = 0;

  const stub1 = rng.int(3, 5);
  let end = carveCorridor(grid, marginX, 0, stub1, { dx: 0, dy: 1 }, CORRIDOR_WIDTH);

  const roomW = hiding ? rng.int(12, 16) : rng.int(9, 13);
  const roomH = hiding ? rng.int(12, 16) : rng.int(9, 13);
  const roomX0 = end.x - Math.floor(roomW / 2);
  const roomZ0 = end.y;
  carveRoomRect(grid, roomX0, roomZ0, roomW, roomH);
  // connect stub end into room (ensure overlap even if centering differs)
  carveCorridor(grid, end.x, end.y, 1, { dx: 0, dy: 1 }, CORRIDOR_WIDTH);

  const exitZ = roomZ0 + roomH;
  const exitX = roomX0 + Math.floor(roomW / 2);
  const stub2 = rng.int(2, 3);
  const end2 = carveCorridor(grid, exitX, exitZ, stub2, { dx: 0, dy: 1 }, Math.min(CORRIDOR_WIDTH, 3));

  const exitWorld = cellCenterWorld(exitX, end2.y, originX, originZ, 1);
  const doorGaps = [{ axis: 'h', index: end2.y, from: exitX - 1, to: exitX + 2 }];
  emitWallsFromGrid(builder, grid, originX, originZ, doorGaps);

  // Lighting: a few fixtures across the room
  const count = hiding ? 4 : 3;
  for (let i = 0; i < count; i++) {
    const rx = roomX0 + rng.range(1.5, roomW - 1.5);
    const rz = roomZ0 + rng.range(1.5, roomH - 1.5);
    const c = cellCenterWorld(rx, rz, originX, originZ, 1);
    builder.addFluorescentLight(c.x, c.z, { intensity: hiding ? 0.85 : 1.0 });
  }

  // Furniture / hiding spots scattered inside the room, spaced apart so
  // they never overlap or crowd into a cluttered pile.
  const furnitureMinDist = 2.4;
  const placedFurniture = [];
  const spotCount = hiding ? rng.int(3, 5) : rng.int(1, 2);
  const spots = [];
  for (let i = 0; i < spotCount; i++) {
    const { rx, rz } = pickSpacedPoint(rng, roomX0, roomZ0, roomW, roomH, 1.4, furnitureMinDist, placedFurniture);
    const c = cellCenterWorld(rx, rz, originX, originZ, 1);
    spots.push({ x: c.x, z: c.z, rotY: rng.range(0, Math.PI * 2) });
  }
  scatterHidingSpots(builder, rng, spots);

  if (rng.bool(0.5)) {
    const { rx, rz } = pickSpacedPoint(rng, roomX0, roomZ0, roomW, roomH, 1.2, furnitureMinDist, placedFurniture);
    const c = cellCenterWorld(rx, rz, originX, originZ, 1);
    createBoxStack(builder, c.x, c.z);
  }

  // Searchable drawers - one or two per room, loot for coins/items
  const drawerCount = hiding ? rng.int(1, 2) : rng.bool(0.6) ? 1 : 0;
  for (let i = 0; i < drawerCount; i++) {
    const { rx, rz } = pickSpacedPoint(rng, roomX0, roomZ0, roomW, roomH, 1.2, furnitureMinDist, placedFurniture);
    const c = cellCenterWorld(rx, rz, originX, originZ, 1);
    createDrawer(builder, c.x, c.z, rng.range(0, Math.PI * 2));
  }

  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  const { lockedExit } = placeItemsAndEntity(builder, grid, originX, originZ, rng, doorIndex, { allowLock: true, forceEntity: hiding ? rng.pick(['watcher', 'crawler', 'shadow']) : undefined });
  createDoor(builder, exitWorld.x, exitWorld.z, 0, { doorNumber: doorIndex, locked: lockedExit });

  builder.hazard = pickHazard(rng, doorIndex);
  return builder.build();
}

function buildMazeChunk(rng, doorIndex) {
  const builder = new ChunkBuilder(rng);
  const cols = rng.int(4, 6), rows = rng.int(4, 6);
  const pitch = 4, roomSize = 3;
  const marginCells = 6;
  const entryStubLen = 4;
  const exitStubLen = 3;

  const width = cols * pitch + marginCells * 2;
  const height = entryStubLen + rows * pitch + exitStubLen + marginCells;
  const grid = new Grid(width, height, 1);

  const mazeOriginX = marginCells;
  const mazeOriginY = entryStubLen;

  const entryCenterX = Math.round(mazeOriginX + roomSize / 2);
  const entryWidth = Math.min(CORRIDOR_WIDTH, roomSize);
  let end = carveCorridor(grid, entryCenterX, 0, mazeOriginY, { dx: 0, dy: 1 }, entryWidth);

  const maze = carveMaze(grid, rng, { originX: mazeOriginX, originY: mazeOriginY, cols, rows, pitch, roomSize });
  // connect entry stub to maze cell (0,0)
  carveCorridor(grid, end.x, end.y, 1, { dx: 0, dy: 1 }, roomSize);

  const farCell = maze.deadEnds.length ? maze.deadEnds[maze.deadEnds.length - 1] : [cols - 1, rows - 1];
  const farOrigin = maze.roomOrigin(farCell[0], farCell[1]);
  const exitX = Math.round(farOrigin.x + roomSize / 2);
  const exitZ = farOrigin.y + roomSize;
  const end2 = carveCorridor(grid, exitX, exitZ, exitStubLen, { dx: 0, dy: 1 }, roomSize);

  // Origin is chosen so the entry stub (where the player spawns) sits at world x=0.
  const originX = -entryCenterX;
  const originZ = 0;
  const exitWorld = cellCenterWorld(exitX, end2.y, originX, originZ, 1);
  const doorGaps = [{ axis: 'h', index: end2.y, from: exitX - 1, to: exitX + 2 }];
  emitWallsFromGrid(builder, grid, originX, originZ, doorGaps);

  // Sparse, dimmer lighting throughout the maze rooms for tension
  for (let my = 0; my < rows; my++) {
    for (let mx = 0; mx < cols; mx++) {
      if (!rng.bool(0.6)) continue;
      const o = maze.roomOrigin(mx, my);
      const c = cellCenterWorld(o.x + roomSize / 2, o.y + roomSize / 2, originX, originZ, 1);
      builder.addFluorescentLight(c.x, c.z, { intensity: 0.7 });
    }
  }

  // A hiding spot in ~half the dead ends
  maze.deadEnds.slice(0, -1).forEach((cell) => {
    if (!rng.bool(0.5)) return;
    const o = maze.roomOrigin(cell[0], cell[1]);
    const c = cellCenterWorld(o.x + roomSize / 2, o.y + roomSize / 2, originX, originZ, 1);
    createWardrobe(builder, c.x, c.z, rng.range(0, Math.PI * 2));
  });

  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  const { lockedExit } = placeItemsAndEntity(builder, grid, originX, originZ, rng, doorIndex, { allowLock: true, forceEntity: rng.bool(0.7) ? undefined : rng.pick(['crawler', 'watcher', 'monster']) });
  createDoor(builder, exitWorld.x, exitWorld.z, 0, { doorNumber: doorIndex, locked: lockedExit });

  builder.hazard = pickHazard(rng, doorIndex);
  return builder.build();
}

function buildFakeDoorChunk(rng, doorIndex) {
  const builder = new ChunkBuilder(rng);
  const width = 30, height = 26;
  const grid = new Grid(width, height, 1);
  const marginX = Math.floor(width / 2);
  const originX = -marginX;
  const originZ = 0;

  const stub1 = rng.int(3, 5);
  let end = carveCorridor(grid, marginX, 0, stub1, { dx: 0, dy: 1 }, CORRIDOR_WIDTH);

  const roomW = 10, roomH = 8;
  const roomX0 = end.x - Math.floor(roomW / 2);
  const roomZ0 = end.y;
  carveRoomRect(grid, roomX0, roomZ0, roomW, roomH);
  carveCorridor(grid, end.x, end.y, 1, { dx: 0, dy: 1 }, CORRIDOR_WIDTH);

  const exitZ = roomZ0 + roomH;
  const centerX = roomX0 + Math.floor(roomW / 2);

  const originXFinal = originX, originZFinal = originZ;
  const doorGaps = [{ axis: 'h', index: exitZ, from: centerX - 3, to: centerX + 3 }];
  emitWallsFromGrid(builder, grid, originXFinal, originZFinal, doorGaps);

  for (let i = 0; i < 3; i++) {
    const rx = roomX0 + rng.range(1.5, roomW - 1.5);
    const rz = roomZ0 + rng.range(1.5, roomH - 1.5);
    const c = cellCenterWorld(rx, rz, originXFinal, originZFinal, 1);
    builder.addFluorescentLight(c.x, c.z, { intensity: 0.95 });
  }

  const doorCenterWorld = cellCenterWorld(centerX, exitZ, originXFinal, originZFinal, 1);
  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  createFakeDoorPair(builder, doorCenterWorld.x, doorCenterWorld.z, 0, rng, doorIndex);

  placeItemsAndEntity(builder, grid, originXFinal, originZFinal, rng, doorIndex, { allowLock: false });
  builder.hazard = pickHazard(rng, doorIndex);
  builder.isFakeDoorRoom = true;
  return builder.build();
}

function buildFinaleChunk(rng) {
  const builder = new ChunkBuilder(rng);
  const width = 30, height = 34;
  const grid = new Grid(width, height, 1);
  const marginX = Math.floor(width / 2);
  const originX = -marginX;
  const originZ = 0;

  const length = 22;
  const end = carveCorridor(grid, marginX, 0, length, { dx: 0, dy: 1 }, CORRIDOR_WIDTH + 1);
  const exitWorld = cellCenterWorld(marginX, end.y, originX, originZ, 1);
  const doorGaps = [{ axis: 'h', index: end.y, from: marginX - 2, to: marginX + 3 }];
  emitWallsFromGrid(builder, grid, originX, originZ, doorGaps);

  for (let i = 3; i < length; i += 5) {
    const c = cellCenterWorld(marginX, i, originX, originZ, 1);
    builder.addFluorescentLight(c.x, c.z, { intensity: 1.3 });
  }

  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  const finalDoor = createDoor(builder, exitWorld.x, exitWorld.z, 0, { doorNumber: 99, color: '#d6c34b' });
  finalDoor.isFinal = true;

  builder.entitySpawn = rng.bool(0.5) ? { type: 'rush', position: new THREE.Vector3(0, 0, length * 0.4) } : null;
  builder.hazard = 'flicker';
  return builder.build();
}

export function generateChunk(doorIndex, rng) {
  const chunkRng = rng.child(`chunk_${doorIndex}`);
  const type = chooseChunkType(chunkRng, doorIndex);
  let chunk;
  if (type === 'corridor') chunk = buildCorridorChunk(chunkRng, doorIndex);
  else if (type === 'room') chunk = buildRoomChunk(chunkRng, doorIndex);
  else if (type === 'maze') chunk = buildMazeChunk(chunkRng, doorIndex);
  else if (type === 'deadend_fake') chunk = buildFakeDoorChunk(chunkRng, doorIndex);
  else if (type === 'hiding_room') chunk = buildRoomChunk(chunkRng, doorIndex, { hiding: true });
  else chunk = buildFinaleChunk(chunkRng);
  chunk.type = type;
  chunk.doorIndex = doorIndex;
  return chunk;
}
