import * as THREE from 'three';
import { findPath } from '../system/Pathfinding.js';
import { buildEntityMesh, ENTITY_DEFS } from './EntityDefinitions.js';

const REPATH_INTERVAL = 0.5;

function worldToCell(pos, origin, cellSize) {
  return { x: Math.floor((pos.x - origin.x) / cellSize), y: Math.floor((pos.z - origin.z) / cellSize) };
}

function cellToWorld(cell, origin, cellSize) {
  return new THREE.Vector3(origin.x + (cell.x + 0.5) * cellSize, 0, origin.z + (cell.y + 0.5) * cellSize);
}

function lineOfSightClear(grid, origin, cellSize, fromPos, toPos) {
  const a = worldToCell(fromPos, origin, cellSize);
  const b = worldToCell(toPos, origin, cellSize);
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let guard = 0;
  while (guard++ < 200) {
    if (!grid.isWalkable(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return true;
}

export class Entity {
  constructor(type, position) {
    this.type = type;
    this.def = ENTITY_DEFS[type];
    this.mesh = buildEntityMesh(this.def);
    this.mesh.position.copy(position);
    this.dead = false;
    this.state = this.def.behavior === 'rush' ? 'dormant' : this.def.behavior === 'fakehuman' ? 'disguised' : 'patrol';
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = Math.random() * 0.3;
    this.loseTrackTimer = 0;
    this.stateTimer = this.def.behavior === 'rush' ? 3 + Math.random() * 5 : Math.random() * 3;
    this.patrolTarget = null;
    this.lastKnownPlayerPos = null;
    this.contactCooldown = 0;
    this.hasScared = false;
    this.rushDir = null;
    this.rushTraveled = 0;
  }

  update(dt, ctx) {
    if (this.dead) return;
    if (this.contactCooldown > 0) this.contactCooldown -= dt;

    switch (this.def.behavior) {
      case 'chaser': this._updateChaser(dt, ctx); break;
      case 'fakehuman': this._updateFakeHuman(dt, ctx); break;
      case 'rush': this._updateRush(dt, ctx); break;
      case 'shadow': this._updateShadow(dt, ctx); break;
      case 'scare_once': this._updateScareOnce(dt, ctx); break;
      default: break;
    }
  }

  // ---------- perception ----------

  _canDetect(ctx, { requireFov = true } = {}) {
    const player = ctx.player;
    if (player.isHidden) return false;
    const entPos = this.mesh.position;
    const playerPos = player.position;
    const dist = entPos.distanceTo(playerPos);
    if (dist > this.def.detectionRadius) return false;

    const hearScore = player.noiseLevel * (this.def.hearingMultiplier || 0);
    const heard = dist < this.def.detectionRadius * (0.35 + hearScore * 0.5) && hearScore > 0.2;

    if (heard) return true;
    if (!requireFov) return dist < this.def.detectionRadius;

    const toPlayer = new THREE.Vector3(playerPos.x - entPos.x, 0, playerPos.z - entPos.z).normalize();
    const forward = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
    const angle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(forward.dot(toPlayer), -1, 1)));
    if (angle > this.def.fovDeg / 2) return false;

    if (ctx.grid) return lineOfSightClear(ctx.grid, ctx.gridOrigin, ctx.grid.cellSize, entPos, playerPos);
    return true;
  }

  _checkContact(ctx) {
    const player = ctx.player;
    if (player.isHidden || this.contactCooldown > 0) return;
    const dist = this.mesh.position.distanceTo(player.position);
    if (dist <= this.def.contactRadius) {
      this.contactCooldown = 1.2;
      ctx.onDamage(this.def.damage, this.def.instaKill, this.type);
      ctx.onEntityContact?.(this.type);
    }
  }

  // ---------- movement helpers ----------

  _repath(ctx, targetPos) {
    if (!ctx.grid) return;
    const start = worldToCell(this.mesh.position, ctx.gridOrigin, ctx.grid.cellSize);
    const goal = worldToCell(targetPos, ctx.gridOrigin, ctx.grid.cellSize);
    const path = findPath(ctx.grid, start, goal, 1500);
    this.path = path ? path.map((c) => cellToWorld(c, ctx.gridOrigin, ctx.grid.cellSize)) : [];
    this.pathIndex = 0;
  }

  _followPath(dt, speed) {
    if (!this.path.length || this.pathIndex >= this.path.length) return false;
    const target = this.path[this.pathIndex];
    const pos = this.mesh.position;
    const dx = target.x - pos.x, dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) {
      this.pathIndex++;
      return this.pathIndex < this.path.length;
    }
    const step = Math.min(dist, speed * dt);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
    const targetYaw = Math.atan2(dx, dz);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, targetYaw, Math.min(1, dt * 6));
    return true;
  }

  _pickPatrolTarget(ctx) {
    if (!ctx.grid) return null;
    for (let i = 0; i < 15; i++) {
      const cx = Math.floor(Math.random() * ctx.grid.width);
      const cz = Math.floor(Math.random() * ctx.grid.height);
      if (ctx.grid.isWalkable(cx, cz)) return cellToWorld({ x: cx, y: cz }, ctx.gridOrigin, ctx.grid.cellSize);
    }
    return null;
  }

  // ---------- behaviors ----------

  _updateChaser(dt, ctx) {
    this.repathTimer -= dt;

    if (this.state === 'patrol') {
      if (!this.patrolTarget || this.mesh.position.distanceTo(this.patrolTarget) < 0.3) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.patrolTarget = this._pickPatrolTarget(ctx);
          this.stateTimer = 2 + Math.random() * 3;
          if (this.patrolTarget) this._repath(ctx, this.patrolTarget);
        }
      } else if (this.repathTimer <= 0) {
        this.repathTimer = REPATH_INTERVAL;
        this._repath(ctx, this.patrolTarget);
      }
      this._followPath(dt, this.def.speedPatrol);

      if (this._canDetect(ctx)) {
        this.state = 'chase';
        this.loseTrackTimer = this.def.giveUpTime;
        ctx.audio?.entityGrowl(this.mesh, 1 + Math.random() * 0.3);
      }
    } else if (this.state === 'chase') {
      this.lastKnownPlayerPos = ctx.player.position.clone();
      if (this.repathTimer <= 0) {
        this.repathTimer = REPATH_INTERVAL;
        this._repath(ctx, ctx.player.position);
      }
      this._followPath(dt, this.def.speedChase);
      this._checkContact(ctx);

      if (this._canDetect(ctx)) {
        this.loseTrackTimer = this.def.giveUpTime;
      } else {
        this.loseTrackTimer -= dt;
        if (this.loseTrackTimer <= 0) {
          this.state = 'search';
          this.stateTimer = 4;
          this._repath(ctx, this.lastKnownPlayerPos);
        }
      }
    } else if (this.state === 'search') {
      this.stateTimer -= dt;
      this._followPath(dt, this.def.speedPatrol * 1.3);
      if (this._canDetect(ctx)) {
        this.state = 'chase';
        this.loseTrackTimer = this.def.giveUpTime;
      } else if (this.stateTimer <= 0 || (this.path.length && this.pathIndex >= this.path.length)) {
        this.state = 'patrol';
        this.patrolTarget = null;
        this.stateTimer = 1;
      }
    }
  }

  _updateFakeHuman(dt, ctx) {
    if (this.state === 'disguised') {
      if (!this.patrolTarget || this.mesh.position.distanceTo(this.patrolTarget) < 0.3) {
        this.patrolTarget = this._pickPatrolTarget(ctx);
        if (this.patrolTarget) this._repath(ctx, this.patrolTarget);
      }
      this._followPath(dt, this.def.speedPatrol);

      const dist = this.mesh.position.distanceTo(ctx.player.position);
      if (dist < this.def.revealRadius && !ctx.player.isHidden) {
        this.state = 'revealed';
        this.mesh.userData.bodyMat.color.setHex(this.def.revealColor);
        this.mesh.userData.bodyMat.emissive?.setHex?.(0x330000);
        this.stateTimer = 7;
        ctx.audio?.jumpscareSting();
        ctx.onJumpscare?.('fakehuman');
      }
    } else if (this.state === 'revealed') {
      this.stateTimer -= dt;
      this.repathTimer -= dt;
      if (this.repathTimer <= 0) {
        this.repathTimer = REPATH_INTERVAL;
        this._repath(ctx, ctx.player.position);
      }
      this._followPath(dt, this.def.speedChase);
      this._checkContact(ctx);
      if (this.stateTimer <= 0) this.dead = true;
    }
  }

  _updateRush(dt, ctx) {
    if (this.state === 'dormant') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'telegraph';
        this.stateTimer = this.def.telegraphTime;
        ctx.audio?.entityScream(this.mesh);
        ctx.notify?.('...무언가 다가오고 있다.');
      }
    } else if (this.state === 'telegraph') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'charging';
        const dir = new THREE.Vector3(ctx.player.position.x - this.mesh.position.x, 0, ctx.player.position.z - this.mesh.position.z);
        if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
        this.rushDir = dir.normalize();
        this.mesh.rotation.y = Math.atan2(this.rushDir.x, this.rushDir.z);
      }
    } else if (this.state === 'charging') {
      const step = this.def.speedChase * dt;
      this.mesh.position.addScaledVector(this.rushDir, step);
      this.rushTraveled += step;
      this._checkContact(ctx);
      if (this.rushTraveled > 40) this.dead = true;
    }
  }

  _updateShadow(dt, ctx) {
    const dark = ctx.isDark ? ctx.isDark(this.mesh.position) : false;
    this.mesh.visible = dark;
    if (!dark) {
      this.state = 'patrol';
      this.path = [];
      return;
    }
    this._updateChaser(dt, ctx);
  }

  _updateScareOnce(dt, ctx) {
    if (this.hasScared) return;
    const dist = this.mesh.position.distanceTo(ctx.player.position);
    if (dist < this.def.contactRadius && !ctx.player.isHidden) {
      this.hasScared = true;
      ctx.audio?.jumpscareSting();
      ctx.onJumpscare?.('unknown');
      ctx.onEntityContact?.(this.type);
      this.dead = true;
    }
  }
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
