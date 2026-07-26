// Lightweight grid-based A* used by entity AI to navigate a chunk.
// Each chunk exposes a Grid (walkable boolean cells); entities request a
// path from their current cell to the player's last-known cell.

export class Grid {
  constructor(width, height, cellSize = 1) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cells = new Uint8Array(width * height); // 1 = walkable
  }

  idx(x, y) { return y * this.width + x; }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  setWalkable(x, y, walkable) {
    if (!this.inBounds(x, y)) return;
    this.cells[this.idx(x, y)] = walkable ? 1 : 0;
  }

  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.cells[this.idx(x, y)] === 1;
  }

  fillRect(x0, y0, x1, y1, walkable) {
    for (let y = Math.max(0, y0); y < Math.min(this.height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.width, x1); x++) {
        this.setWalkable(x, y, walkable);
      }
    }
  }

  worldToCell(x, z, originX, originZ) {
    return {
      x: Math.floor((x - originX) / this.cellSize),
      y: Math.floor((z - originZ) / this.cellSize)
    };
  }

  cellToWorld(cx, cy, originX, originZ) {
    return {
      x: originX + (cx + 0.5) * this.cellSize,
      z: originZ + (cy + 0.5) * this.cellSize
    };
  }
}

const NEIGHBORS = [
  { dx: 1, dy: 0, cost: 1 }, { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 }, { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 }, { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 }, { dx: -1, dy: -1, cost: Math.SQRT2 }
];

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].f <= this.items[i].f) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }
  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        let l = i * 2 + 1, r = i * 2 + 2, smallest = i;
        if (l < this.items.length && this.items[l].f < this.items[smallest].f) smallest = l;
        if (r < this.items.length && this.items[r].f < this.items[smallest].f) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// Returns an array of {x,y} grid cells from start to goal (inclusive), or null.
export function findPath(grid, start, goal, maxIterations = 2000) {
  if (!grid.inBounds(goal.x, goal.y) || !grid.isWalkable(goal.x, goal.y)) return null;
  if (!grid.inBounds(start.x, start.y)) return null;

  const startKey = grid.idx(start.x, start.y);
  const goalKey = grid.idx(goal.x, goal.y);

  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const open = new MinHeap();
  open.push({ x: start.x, y: start.y, f: heuristic(start, goal) });
  const visited = new Set();

  let iterations = 0;
  while (open.size > 0 && iterations < maxIterations) {
    iterations++;
    const current = open.pop();
    const currentKey = grid.idx(current.x, current.y);
    if (currentKey === goalKey) {
      return reconstruct(cameFrom, current, grid);
    }
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    for (const n of NEIGHBORS) {
      const nx = current.x + n.dx;
      const ny = current.y + n.dy;
      if (!grid.isWalkable(nx, ny)) continue;
      // prevent cutting diagonally through a solid corner
      if (n.dx !== 0 && n.dy !== 0) {
        if (!grid.isWalkable(current.x + n.dx, current.y) || !grid.isWalkable(current.x, current.y + n.dy)) continue;
      }
      const nKey = grid.idx(nx, ny);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + n.cost;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, { x: current.x, y: current.y });
        open.push({ x: nx, y: ny, f: tentativeG + heuristic({ x: nx, y: ny }, goal) });
      }
    }
  }
  return null;
}

function heuristic(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function reconstruct(cameFrom, current, grid) {
  const path = [{ x: current.x, y: current.y }];
  let key = grid.idx(current.x, current.y);
  while (cameFrom.has(key)) {
    current = cameFrom.get(key);
    path.push(current);
    key = grid.idx(current.x, current.y);
  }
  path.reverse();
  return path;
}
