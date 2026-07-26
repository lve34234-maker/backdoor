import * as THREE from 'three';

// Ambient hazards / random events that can occur once a chunk is entered.
// These are atmospheric (lights, fog, sound, jump-scare flashes) rather
// than the entity AI itself, which lives in src/entities.

export function pickHazard(rng, doorIndex) {
  const danger = Math.min(1, doorIndex / 60);
  const entries = [
    { value: null, weight: Math.max(1, 6 - danger * 3) },
    { value: 'flicker', weight: 3 },
    { value: 'blackout', weight: 1 + danger * 2 },
    { value: 'explode_light', weight: 1 + danger },
    { value: 'ceiling_noise', weight: 2 },
    { value: 'fog_surge', weight: 1.5 },
    { value: 'distant_scream', weight: 2 },
    { value: 'wall_scratch', weight: 1.5 },
    { value: 'shadow_flash', weight: 1 + danger }
  ];
  return rng.weightedPick(entries);
}

const BASE_FOG_DENSITY = 0.045;

export class HazardRunner {
  constructor(type, chunk, rng) {
    this.type = type;
    this.chunk = chunk;
    this.rng = rng;
    this.time = 0;
    this.done = type == null;
    this._targets = [];
    this._started = false;
  }

  start(ctx) {
    this._started = true;
    const { audio, sceneManager, camera, notify } = ctx;
    switch (this.type) {
      case 'flicker': {
        const count = Math.min(this.chunk.lights.length, this.rng.int(1, 2));
        this._targets = this.rng ? shuffle(this.chunk.lights, this.rng).slice(0, count) : [];
        this.duration = this.rng.range(3, 6);
        notify?.('조명이 깜빡인다...');
        break;
      }
      case 'blackout': {
        this.duration = this.rng.range(4, 8);
        this.chunk.lights.forEach((l) => { l._savedIntensity = l.light.intensity; l.light.intensity = 0; });
        notify?.('불이 꺼졌다!');
        audio?.entityGrowl(camera, 0.8);
        break;
      }
      case 'explode_light': {
        const target = this.rng.pick(this.chunk.lights);
        if (target) {
          target.light.intensity = target.baseIntensity * 6;
          target._explodeTimer = 0.12;
          target._exploded = true;
        }
        audio?.playOneShot2D(audio.noiseBuffer(0.3, { decay: 2 }), 0.8);
        notify?.('형광등이 터졌다!');
        break;
      }
      case 'ceiling_noise': {
        audio?.playOneShot2D(audio.toneBuffer(70, 0.5, { type: 'square', decay: 2 }), 0.4);
        notify?.('천장에서 소리가 들린다...');
        this.done = true;
        break;
      }
      case 'fog_surge': {
        this.duration = this.rng.range(5, 9);
        if (sceneManager) sceneManager.scene.fog.density = BASE_FOG_DENSITY * 3.2;
        notify?.('갑자기 안개가 짙어진다...');
        break;
      }
      case 'distant_scream': {
        const far = new THREE.Object3D();
        far.position.set(camera.position.x + this.rng.range(-15, 15), 1.6, camera.position.z + this.rng.range(-15, 15));
        sceneManager?.scene.add(far);
        audio?.entityScream(far);
        setTimeout(() => sceneManager?.scene.remove(far), 2000);
        notify?.('멀리서 비명이 들렸다...');
        this.done = true;
        break;
      }
      case 'wall_scratch': {
        const near = new THREE.Object3D();
        near.position.copy(camera.position).add(new THREE.Vector3(this.rng.range(-2, 2), 0, this.rng.range(-2, 2)));
        sceneManager?.scene.add(near);
        audio?.playPositional(near, audio.noiseBuffer(0.8, { decay: 1.5 }), { volume: 0.4, refDistance: 2 });
        setTimeout(() => sceneManager?.scene.remove(near), 1500);
        notify?.('벽을 긁는 소리...');
        this.done = true;
        break;
      }
      case 'shadow_flash': {
        this._flashCb = ctx.onShadowFlash;
        if (this._flashCb) this._flashCb();
        this.done = true;
        break;
      }
      default:
        this.done = true;
    }
  }

  update(dt, ctx) {
    if (this.done) return;
    this.time += dt;

    if (this.type === 'flicker') {
      this._targets.forEach((t) => {
        const flick = Math.random() > 0.5 ? 1 : 0.15;
        t.light.intensity = t.baseIntensity * flick;
      });
      if (this.time >= this.duration) {
        this._targets.forEach((t) => { t.light.intensity = t.baseIntensity; });
        this.done = true;
      }
    } else if (this.type === 'blackout') {
      if (this.time >= this.duration) {
        this.chunk.lights.forEach((l) => { l.light.intensity = l._savedIntensity ?? l.baseIntensity; });
        this.done = true;
      }
    } else if (this.type === 'explode_light') {
      const target = this.chunk.lights.find((l) => l._exploded);
      if (target) {
        target._explodeTimer -= dt;
        if (target._explodeTimer <= 0 && target.light.intensity !== 0) {
          target.light.intensity = 0;
          if (target.fixture) target.fixture.material.emissiveIntensity = 0;
        }
      }
      this.done = true;
    } else if (this.type === 'fog_surge') {
      if (ctx.sceneManager) {
        const fog = ctx.sceneManager.scene.fog;
        const t = Math.min(1, this.time / this.duration);
        fog.density = THREE.MathUtils.lerp(BASE_FOG_DENSITY * 3.2, BASE_FOG_DENSITY, t);
        if (t >= 1) this.done = true;
      } else {
        this.done = true;
      }
    } else {
      this.done = true;
    }
  }
}

function shuffle(arr, rng) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
