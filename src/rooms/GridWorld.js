import { Grid } from '../system/Pathfinding.js';
import { WALL_HEIGHT } from './ChunkBuilder.js';

// Authoring-time helpers that carve a walkable footprint (corridor / room /
// maze) into a Pathfinding.Grid, then a single generic wall-emission pass
// turns the walkable/blocked boundary into actual wall geometry + colliders.
// The same Grid instance is later handed to the ChunkBuilder and reused
// directly as the entity A* navigation grid - one source of truth.

export function carveCorridor(grid, x0, y0, length, dir, width) {
  const perp = { dx: -dir.dy, dy: dir.dx };
  const half0 = Math.floor(width / 2);
  const half1 = Math.ceil(width / 2);
  for (let i = 0; i < length; i++) {
    for (let w = -half0; w < half1; w++) {
      const gx = x0 + dir.dx * i + perp.dx * w;
      const gy = y0 + dir.dy * i + perp.dy * w;
      grid.setWalkable(gx, gy, true);
    }
  }
  return { x: x0 + dir.dx * length, y: y0 + dir.dy * length };
}

export function carveRoomRect(grid, cx, cy, w, h) {
  grid.fillRect(cx, cy, cx + w, cy + h, true);
}

export function carveMaze(grid, rng, { originX, originY, cols, rows, pitch = 3, roomSize = 3 }) {
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const roomOrigin = (mx, my) => ({ x: originX + mx * pitch, y: originY + my * pitch });
  const carveRoomCell = (mx, my) => {
    const o = roomOrigin(mx, my);
    grid.fillRect(o.x, o.y, o.x + roomSize, o.y + roomSize, true);
  };
  const gap = pitch - roomSize;
  const carvePassage = (mx, my, dx, dy) => {
    const o1 = roomOrigin(mx, my);
    if (dx === 1) grid.fillRect(o1.x + roomSize, o1.y, o1.x + roomSize + gap, o1.y + roomSize, true);
    else if (dx === -1) { const o2 = roomOrigin(mx - 1, my); grid.fillRect(o2.x + roomSize, o2.y, o2.x + roomSize + gap, o2.y + roomSize, true); }
    else if (dy === 1) grid.fillRect(o1.x, o1.y + roomSize, o1.x + roomSize, o1.y + roomSize + gap, true);
    else if (dy === -1) { const o2 = roomOrigin(mx, my - 1); grid.fillRect(o2.x, o2.y + roomSize, o2.x + roomSize, o2.y + roomSize + gap, true); }
  };

  const stack = [[0, 0]];
  visited[0][0] = true;
  carveRoomCell(0, 0);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const deadEnds = [];

  while (stack.length) {
    const [mx, my] = stack[stack.length - 1];
    const options = dirs
      .map(([dx, dy]) => [mx + dx, my + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !visited[ny][nx]);
    if (options.length === 0) {
      if (stack.length > 1) deadEnds.push([mx, my]);
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = rng.pick(options);
    visited[ny][nx] = true;
    carveRoomCell(nx, ny);
    carvePassage(mx, my, dx, dy);
    stack.push([nx, ny]);
  }

  return { cols, rows, pitch, roomSize, originX, originY, roomOrigin, deadEnds };
}

// Turns every walkable/blocked boundary edge of `grid` into wall geometry,
// except where it falls inside a registered door gap (a short run of cells
// intentionally left open so a door frame can sit there instead of a wall).
export function emitWallsFromGrid(builder, grid, originX, originZ, doorGaps = []) {
  const cellSize = grid.cellSize;
  const isHGap = (bz, cx) => doorGaps.some((g) => g.axis === 'h' && g.index === bz && cx >= g.from && cx < g.to);
  const isVGap = (bx, cz) => doorGaps.some((g) => g.axis === 'v' && g.index === bx && cz >= g.from && cz < g.to);

  const wallThickness = 0.2;

  // Horizontal boundaries (walls running along X, separating rows)
  for (let bz = 0; bz <= grid.height; bz++) {
    let runStart = null;
    for (let cx = 0; cx <= grid.width; cx++) {
      const below = cx < grid.width ? grid.isWalkable(cx, bz - 1) : false;
      const above = cx < grid.width ? grid.isWalkable(cx, bz) : false;
      const needsWall = cx < grid.width && below !== above && !isHGap(bz, cx);
      if (needsWall) {
        if (runStart === null) runStart = cx;
      } else if (runStart !== null) {
        emitHWall(builder, originX, originZ, cellSize, runStart, cx, bz, wallThickness);
        runStart = null;
      }
    }
    if (runStart !== null) emitHWall(builder, originX, originZ, cellSize, runStart, grid.width, bz, wallThickness);
  }

  // Vertical boundaries (walls running along Z, separating columns)
  for (let bx = 0; bx <= grid.width; bx++) {
    let runStart = null;
    for (let cz = 0; cz <= grid.height; cz++) {
      const left = cz < grid.height ? grid.isWalkable(bx - 1, cz) : false;
      const right = cz < grid.height ? grid.isWalkable(bx, cz) : false;
      const needsWall = cz < grid.height && left !== right && !isVGap(bx, cz);
      if (needsWall) {
        if (runStart === null) runStart = cz;
      } else if (runStart !== null) {
        emitVWall(builder, originX, originZ, cellSize, runStart, cz, bx, wallThickness);
        runStart = null;
      }
    }
    if (runStart !== null) emitVWall(builder, originX, originZ, cellSize, runStart, grid.height, bx, wallThickness);
  }

  // One big floor + ceiling slab across the whole footprint bounding box.
  builder.addFloor(originX, originZ, originX + grid.width * cellSize, originZ + grid.height * cellSize);
  builder.setNavGrid(grid, originX, originZ);
}

function emitHWall(builder, originX, originZ, cellSize, cx0, cx1, bz, thickness) {
  const width = (cx1 - cx0) * cellSize;
  const cx = originX + ((cx0 + cx1) / 2) * cellSize;
  const cz = originZ + bz * cellSize;
  builder.addWallBox(cx, cz, width, thickness, WALL_HEIGHT);
}

function emitVWall(builder, originX, originZ, cellSize, cz0, cz1, bx, thickness) {
  const depth = (cz1 - cz0) * cellSize;
  const cx = originX + bx * cellSize;
  const cz = originZ + ((cz0 + cz1) / 2) * cellSize;
  builder.addWallBox(cx, cz, thickness, depth, WALL_HEIGHT);
}

export function cellCenterWorld(cx, cz, originX, originZ, cellSize) {
  return { x: originX + (cx + 0.5) * cellSize, z: originZ + (cz + 0.5) * cellSize };
}
