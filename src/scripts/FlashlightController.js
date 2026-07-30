import * as THREE from 'three';

const MAX_BATTERY = 100;
const DRAIN_PER_SEC = 1.6;
const FLICKER_THRESHOLD = 15;

// Lives directly in the scene (not parented to the camera) so it can be
// pointed either from the camera (first person) or from the player
// character (third person) - see Game.js's per-frame transform update.
export class FlashlightController {
  constructor(scene) {
    this.light = new THREE.SpotLight(0xfff2c0, 0, 14, Math.PI / 7, 0.55, 1.4);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.bias = -0.002;

    this.target = new THREE.Object3D();
    this.light.target = this.target;
    scene.add(this.light);
    scene.add(this.target);

    this.on = false;
    this.battery = MAX_BATTERY;
    this._flickerT = 0;
    // Three.js lights use physically-based (candela) units, so this needs
    // to be much larger than the old-style "1.0 = normal" intensity.
    this.baseIntensity = 55;
  }

  addBattery(amount) {
    this.battery = Math.min(MAX_BATTERY, this.battery + amount);
  }

  toggle() {
    if (this.battery <= 0) { this.on = false; return; }
    this.on = !this.on;
  }

  // originPos: THREE.Vector3 world position to shine from.
  // forward: THREE.Vector3 (normalized) world direction to point at.
  setTransform(originPos, forward) {
    this.light.position.copy(originPos);
    this.target.position.copy(originPos).add(forward);
  }

  update(dt) {
    if (this.on && this.battery > 0) {
      this.battery = Math.max(0, this.battery - DRAIN_PER_SEC * dt);
      if (this.battery <= 0) this.on = false;
    }

    let intensity = 0;
    if (this.on) {
      intensity = this.baseIntensity;
      if (this.battery < FLICKER_THRESHOLD) {
        this._flickerT += dt;
        const flicker = 0.5 + 0.5 * Math.sin(this._flickerT * 40) * (1 - this.battery / FLICKER_THRESHOLD);
        intensity *= 0.4 + 0.6 * flicker;
      }
    }
    this.light.intensity = intensity;
  }
}
