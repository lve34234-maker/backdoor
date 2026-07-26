import * as THREE from 'three';

const WALK_SPEED = 2.6;
const SPRINT_SPEED = 5.2;
const CROUCH_SPEED = 1.3;
const STAND_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.32;
const GRAVITY = 18;
const JUMP_SPEED = 5.2;
const STAMINA_MAX = 100;

export class PlayerController {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;

    this.height = STAND_HEIGHT;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isGrounded = true;
    this.isHidden = false;
    this.noiseLevel = 0; // 0..1 used by entity hearing checks

    this.health = 100;
    this.stamina = STAMINA_MAX;

    this.colliders = []; // THREE.Box3[] for current chunk
    this.mouseSensitivity = 0.0022;

    this._footstepTimer = 0;
    this.onFootstep = null; // callback(running, crouching)
  }

  setColliders(colliders) {
    this.colliders = colliders;
  }

  teleport(x, y, z, yaw = 0) {
    this.position.set(x, y, z);
    this.velocityY = 0;
    this.yaw = yaw;
    this.pitch = 0;
  }

  setSensitivity(v) { this.mouseSensitivity = 0.0012 + v * 0.003; }

  update(dt) {
    if (this.isHidden) {
      this._updateLook(dt);
      this._syncCamera();
      return;
    }

    this._updateLook(dt);

    const wantsCrouch = this.input.crouch;
    this.isCrouching = wantsCrouch;
    const targetHeight = wantsCrouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    this.height += (targetHeight - this.height) * Math.min(1, dt * 8);

    const moving = this.input.forward || this.input.backward || this.input.left || this.input.right;
    this.isSprinting = this.input.sprint && moving && !wantsCrouch && this.stamina > 0.5;

    let speed = wantsCrouch ? CROUCH_SPEED : this.isSprinting ? SPRINT_SPEED : WALK_SPEED;

    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 18);
    } else {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + dt * (wantsCrouch ? 6 : 12));
    }

    // noise level feeds entity hearing: crouch is near-silent, sprint is loud
    this.noiseLevel = wantsCrouch ? 0.15 : this.isSprinting ? 1.0 : moving ? 0.5 : 0.0;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // Must match the camera's actual world-space right vector (see the
    // +PI reconciliation in _syncCamera) or A/D strafe backwards.
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.input.forward) move.add(forward);
    if (this.input.backward) move.sub(forward);
    if (this.input.right) move.add(right);
    if (this.input.left) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

    this._moveWithCollision(move);

    // gravity / jump
    if (this.isGrounded && this.input.jump && !wantsCrouch) {
      this.velocityY = JUMP_SPEED;
      this.isGrounded = false;
    }
    this.velocityY -= GRAVITY * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // footsteps
    if (moving && this.isGrounded) {
      this._footstepTimer -= dt;
      const interval = wantsCrouch ? 0.55 : this.isSprinting ? 0.28 : 0.42;
      if (this._footstepTimer <= 0) {
        this._footstepTimer = interval;
        if (this.onFootstep) this.onFootstep(this.isSprinting, wantsCrouch);
      }
    } else {
      this._footstepTimer = 0;
    }

    this._syncCamera();
  }

  _updateLook(dt) {
    const d = this.input.consumeMouseDelta();
    this.yaw -= d.x * this.mouseSensitivity;
    this.pitch -= d.y * this.mouseSensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  }

  _syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + this.height, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    // Three.js cameras face -Z at identity rotation, but this controller's
    // forward vector (used for movement) is (sin(yaw), 0, cos(yaw)) i.e. +Z
    // at yaw=0. Adding PI here reconciles the two so "yaw=0" visually faces
    // the same direction the player actually walks toward.
    this.camera.rotateY(this.yaw + Math.PI);
    this.camera.rotateX(this.pitch);
  }

  _moveWithCollision(delta) {
    // Resolve X and Z independently against AABB colliders for stable sliding.
    const tryAxis = (axis) => {
      const next = this.position.clone();
      next[axis] += delta[axis];
      const px = next.x, pz = next.z;
      for (const box of this.colliders) {
        const closestX = Math.max(box.min.x, Math.min(px, box.max.x));
        const closestZ = Math.max(box.min.z, Math.min(pz, box.max.z));
        const dx = px - closestX;
        const dz = pz - closestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
          return; // blocked on this axis, skip movement
        }
      }
      this.position[axis] = next[axis];
    };
    tryAxis('x');
    tryAxis('z');
  }

  getForwardVector() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }
}
