import * as THREE from 'three';
import { ChunkBuilder, CORRIDOR_WIDTH, WALL_HEIGHT } from './ChunkBuilder.js';
import { carveCorridor, carveRoomRect, carveMaze, emitWallsFromGrid, cellCenterWorld } from './GridWorld.js';
import { Grid } from '../system/Pathfinding.js';
import { createDoor, createFakeDoorPair } from './DoorSystem.js';
import { scatterHidingSpots, createWardrobe, createBoxStack } from './HidingSpots.js';
import { createDrawer } from './SearchableFurniture.js';
import { pickHazard } from './Traps.js';
import { TOTAL_DOORS, FINAL_DOOR_INDEX, dangerFactor, doorDisplayNumber } from './Difficulty.js';

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
  { value: 'ceiling', weight: 0.3 + danger * 0.9 },
  { value: 'unknown', weight: 0.08 + danger * 0.12 }
];

// The ceiling ambusher hangs near the ceiling rather than standing on the
// floor - everywhere else builds an entitySpawn position at y=0.
function entitySpawnPosition(type, world) {
  return type === 'ceiling'
    ? new THREE.Vector3(world.x, WALL_HEIGHT - 0.4, world.z)
    : new THREE.Vector3(world.x, 0, world.z);
}

function chooseChunkType(rng, doorIndex) {
  const danger = dangerFactor(doorIndex, 70);
  if (doorIndex === TOTAL_DOORS || doorIndex === FINAL_DOOR_INDEX) return 'finale';
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
  const danger = dangerFactor(doorIndex, 70);
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
    // Hide the key inside a drawer rather than leaving it out in plain
    // sight - tag one of this chunk's drawers (making one first if it
    // doesn't have any yet) to guarantee a search there turns it up.
    let keyDrawer = builder.searchables.length
      ? rng.pick(builder.searchables)
      : null;
    if (!keyDrawer) {
      // This drawer isn't run through pickSpacedPoint like the room's own
      // furniture, so without a check here it could land right on top of
      // a wardrobe/locker/etc already placed in the room - keep retrying
      // until a cell clear of everything already there turns up.
      const existingSpots = [...builder.hidingSpots, ...builder.searchables];
      let cell = null;
      for (let tries = 0; tries < 15; tries++) {
        const candidate = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 3, rng);
        if (!candidate) break;
        const world = cellCenterWorld(candidate.cx, candidate.cz, originX, originZ, grid.cellSize);
        const clear = existingSpots.every((s) => Math.hypot(world.x - s.position.x, world.z - s.position.z) >= 2.4);
        if (clear || tries === 14) { cell = candidate; break; }
      }
      if (cell) {
        const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
        createDrawer(builder, world.x, world.z, rng.range(0, Math.PI * 2));
        keyDrawer = builder.searchables[builder.searchables.length - 1];
      }
    }
    if (keyDrawer) keyDrawer.guaranteedLoot = 'key';
  }

  // Entity spawn - the first couple of doors are kept safe so new players
  // get a feel for movement/doors before anything starts hunting them.
  const entitiesAllowed = doorIndex >= SAFE_DOORS;
  const entityType = entitiesAllowed ? rng.weightedPick(ENTITY_WEIGHTS_BY_DANGER(danger)) : null;
  if (entitiesAllowed && entityType && !opts.forceNoEntity) {
    const cell = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 5, rng);
    if (cell) {
      const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
      builder.entitySpawn = { type: entityType, position: entitySpawnPosition(entityType, world) };
    }
  } else if (entitiesAllowed && opts.forceEntity) {
    const cell = randomWalkableFarCell(grid, entryCell.x, entryCell.z, 5, rng);
    if (cell) {
      const world = cellCenterWorld(cell.cx, cell.cz, originX, originZ, grid.cellSize);
      builder.entitySpawn = { type: opts.forceEntity, position: entitySpawnPosition(opts.forceEntity, world) };
    }
  }

  return { lockedExit };
}

// Furniture placement helper so pieces placed in the same room don't end
// up stacked on top of / overlapping each other. Pure random rejection
// sampling gets unreliable once a room fills up (a crowded "hiding_room"
// can ask for up to ~8 pieces) - by the last item or two, most of the
// room is already within minDist of something, and random guessing can
// easily burn its whole try budget without ever landing in the shrinking
// valid area. Sampling a jittered grid instead guarantees the search
// actually covers the room, so a valid spot gets found whenever one
// geometrically exists instead of depending on random luck.
function pickSpacedPoint(rng, x0, z0, w, h, margin, minDist, placed) {
  const maxX = Math.max(margin + 0.01, w - margin);
  const maxZ = Math.max(margin + 0.01, h - margin);
  const step = 0.6;
  const candidates = [];
  for (let cx = margin; cx <= maxX; cx += step) {
    for (let cz = margin; cz <= maxZ; cz += step) {
      candidates.push({
        rx: x0 + cx + rng.range(-step * 0.3, step * 0.3),
        rz: z0 + cz + rng.range(-step * 0.3, step * 0.3)
      });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let best = null;
  let bestNearest = -Infinity;
  for (const { rx, rz } of candidates) {
    const nearest = placed.length ? Math.min(...placed.map((p) => Math.hypot(rx - p.x, rz - p.z))) : Infinity;
    if (nearest >= minDist) {
      best = { rx, rz };
      bestNearest = nearest;
      break;
    }
    if (nearest > bestNearest) {
      bestNearest = nearest;
      best = { rx, rz };
    }
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

  // Occasional wall-mounted hiding spot + searchable drawer along the
  // corridor. Both used to roll their (side, Z) independently, so roughly
  // 1 in 6 corridors ended up with the wardrobe and drawer landing at
  // overlapping/adjacent spots on the same wall - track what's already
  // placed here and keep the drawer clear of it.
  const MIN_WALL_SPOT_SEP = 2.6;
  const wallSpotZMin = 4, wallSpotZMax = Math.max(5, length1 - 3);
  const placedWallSpots = [];

  const pickWallSpot = () => {
    let best = null;
    for (let tries = 0; tries < 12; tries++) {
      const side = rng.bool(0.5) ? -1 : 1;
      const spotZ = rng.range(wallSpotZMin, wallSpotZMax);
      const clear = placedWallSpots.every((p) => p.side !== side || Math.abs(p.spotZ - spotZ) >= MIN_WALL_SPOT_SEP);
      if (clear) { best = { side, spotZ }; break; }
      best = { side, spotZ };
    }
    placedWallSpots.push(best);
    return best;
  };

  if (rng.bool(0.45)) {
    const { side, spotZ } = pickWallSpot();
    const c = cellCenterWorld(marginX + side * (CORRIDOR_WIDTH / 2 - 0.5), spotZ, originX, originZ, 1);
    createWardrobe(builder, c.x, c.z, side === 1 ? -Math.PI / 2 : Math.PI / 2);
  }

  if (rng.bool(0.35)) {
    const { side, spotZ } = pickWallSpot();
    const c = cellCenterWorld(marginX + side * (CORRIDOR_WIDTH / 2 - 0.4), spotZ, originX, originZ, 1);
    createDrawer(builder, c.x, c.z, side === 1 ? -Math.PI / 2 : Math.PI / 2);
  }

  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  const { lockedExit } = placeItemsAndEntity(builder, grid, originX, originZ, rng, doorIndex, { allowLock: true });
  createDoor(builder, exitWorld.x, exitWorld.z, exitYaw, { doorNumber: doorDisplayNumber(doorIndex), locked: lockedExit });

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

  // Sized with enough headroom for furnitureMinDist(2.4)-spaced pieces
  // below to actually fit reliably - the previous 9-16 range packed a
  // "hiding_room" (up to ~8 pieces) tightly enough that pickSpacedPoint
  // regularly had to fall back to a too-close spot just to place them all.
  const roomW = hiding ? rng.int(14, 18) : rng.int(10, 14);
  const roomH = hiding ? rng.int(14, 18) : rng.int(10, 14);
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
  const spotCount = hiding ? rng.int(3, 4) : rng.int(1, 2);
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
  createDoor(builder, exitWorld.x, exitWorld.z, 0, { doorNumber: doorDisplayNumber(doorIndex), locked: lockedExit });

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

  // Math.round(x + roomSize/2) rounds the exact ".5" case (odd roomSize)
  // up, shifting the stub's centre a full column off from the room it's
  // supposed to align with - carveCorridor's own width math instead uses
  // floor()/ceil() around the centre, so matching that here with
  // Math.floor keeps the stub's columns exactly inside the room's columns
  // instead of jogging over by one and leaving a wall sliver at the door.
  const entryCenterX = mazeOriginX + Math.floor(roomSize / 2);
  const entryWidth = Math.min(CORRIDOR_WIDTH, roomSize);
  let end = carveCorridor(grid, entryCenterX, 0, mazeOriginY, { dx: 0, dy: 1 }, entryWidth);

  const maze = carveMaze(grid, rng, { originX: mazeOriginX, originY: mazeOriginY, cols, rows, pitch, roomSize });
  // connect entry stub to maze cell (0,0)
  carveCorridor(grid, end.x, end.y, 1, { dx: 0, dy: 1 }, roomSize);

  const farCell = maze.deadEnds.length ? maze.deadEnds[maze.deadEnds.length - 1] : [cols - 1, rows - 1];
  const farOrigin = maze.roomOrigin(farCell[0], farCell[1]);
  const exitX = farOrigin.x + Math.floor(roomSize / 2);
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

  // A hiding spot in ~half the dead ends. The exit door's stub can run a
  // couple of cells past its own room and into the footprint of a
  // neighbouring maze room that's unrelated in the maze graph but close in
  // world space, so a wardrobe centred there (plus its arbitrary rotation
  // widening its bounding box) could reach far enough to clip the door -
  // skip any dead end whose centre lands too close to the door itself.
  const DOOR_CLEARANCE = 2.6;
  maze.deadEnds.slice(0, -1).forEach((cell) => {
    if (!rng.bool(0.5)) return;
    const o = maze.roomOrigin(cell[0], cell[1]);
    const c = cellCenterWorld(o.x + roomSize / 2, o.y + roomSize / 2, originX, originZ, 1);
    if (Math.hypot(c.x - exitWorld.x, c.z - exitWorld.z) < DOOR_CLEARANCE) return;
    createWardrobe(builder, c.x, c.z, rng.range(0, Math.PI * 2));
  });

  builder.playerSpawn = { x: 0, y: 0, z: 0.6, yaw: 0 };
  const { lockedExit } = placeItemsAndEntity(builder, grid, originX, originZ, rng, doorIndex, { allowLock: true, forceEntity: rng.bool(0.7) ? undefined : rng.pick(['crawler', 'watcher', 'monster']) });
  createDoor(builder, exitWorld.x, exitWorld.z, 0, { doorNumber: doorDisplayNumber(doorIndex), locked: lockedExit });

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
  createFakeDoorPair(builder, doorCenterWorld.x, doorCenterWorld.z, 0, rng, doorDisplayNumber(doorIndex));

  placeItemsAndEntity(builder, grid, originXFinal, originZFinal, rng, doorIndex, { allowLock: false });
  builder.hazard = pickHazard(rng, doorIndex);
  builder.isFakeDoorRoom = true;
  return builder.build();
}

function buildFinaleChunk(rng, doorIndex) {
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
  const finalDoor = createDoor(builder, exitWorld.x, exitWorld.z, 0, { doorNumber: doorDisplayNumber(doorIndex), color: '#d6c34b' });
  finalDoor.isFinal = true;

  // The basement's final floor is far more dangerous than the surface finale.
  const danger = dangerFactor(doorIndex, 70);
  const rushChance = Math.min(0.9, 0.5 + danger * 0.15);
  builder.entitySpawn = rng.bool(rushChance) ? { type: 'rush', position: new THREE.Vector3(0, 0, length * 0.4) } : null;
  builder.hazard = doorIndex > TOTAL_DOORS ? 'blackout' : 'flicker';
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
  else chunk = buildFinaleChunk(chunkRng, doorIndex);
  chunk.type = type;
  chunk.doorIndex = doorIndex;
  return chunk;
}
