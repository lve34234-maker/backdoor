import * as THREE from 'three';

// All sound in BACKDOOR is synthesised at runtime with the Web Audio API
// (through three.js's Audio/PositionalAudio wrappers) so the repository
// never needs to ship binary audio assets. Every helper below builds a
// short AudioBuffer (noise / tone / envelope) on demand and plays it back,
// optionally attached to a 3D object for spatial (panned) sound.

export class AudioManager {
  constructor() {
    this.listener = new THREE.AudioListener();
    this.ctx = this.listener.context;
    this.masterVolume = 1;
    this.sfxVolume = 1;
    this.musicVolume = 0.6;
    this._activeLoops = [];
  }

  attachToCamera(camera) {
    camera.add(this.listener);
  }

  async resume() {
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* ignore */ }
    }
  }

  setVolumes({ master, sfx, music }) {
    if (master != null) this.masterVolume = master;
    if (sfx != null) this.sfxVolume = sfx;
    if (music != null) this.musicVolume = music;
    this._activeLoops.forEach((a) => a.setVolume(a.userVolume * this.masterVolume * this.musicVolume));
  }

  // ---------- buffer synthesis ----------

  _createBuffer(duration) {
    const length = Math.max(1, Math.floor(duration * this.ctx.sampleRate));
    return this.ctx.createBuffer(1, length, this.ctx.sampleRate);
  }

  noiseBuffer(duration, { decay = 3.0, filterSweep = false } = {}) {
    const buffer = this._createBuffer(duration);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const env = Math.pow(1 - t, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  toneBuffer(freq, duration, { type = 'sine', decay = 4.0, freqEnd = null } = {}) {
    const buffer = this._createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sr = this.ctx.sampleRate;
    let phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const f = freqEnd != null ? freq + (freqEnd - freq) * t : freq;
      phase += (2 * Math.PI * f) / sr;
      let sample;
      if (type === 'sine') sample = Math.sin(phase);
      else if (type === 'square') sample = Math.sign(Math.sin(phase));
      else if (type === 'saw') sample = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
      else sample = Math.sin(phase);
      const env = Math.pow(1 - t, decay);
      data[i] = sample * env;
    }
    return buffer;
  }

  growlBuffer(duration = 1.2, pitch = 1) {
    const buffer = this._createBuffer(duration);
    const data = buffer.getChannelData(0);
    const sr = this.ctx.sampleRate;
    let phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const wobble = Math.sin(t * 18) * 0.5 + 0.5;
      const f = (55 + wobble * 40) * pitch;
      phase += (2 * Math.PI * f) / sr;
      const tone = Math.sin(phase) * 0.6;
      const noise = (Math.random() * 2 - 1) * 0.5;
      const env = Math.sin(Math.PI * t);
      data[i] = (tone + noise) * env * 0.8;
    }
    return buffer;
  }

  // ---------- playback ----------

  playOneShot2D(buffer, volume = 1) {
    const audio = new THREE.Audio(this.listener);
    audio.setBuffer(buffer);
    audio.setVolume(volume * this.masterVolume * this.sfxVolume);
    audio.play();
    audio.onEnded = () => audio.disconnect();
    return audio;
  }

  playPositional(object3D, buffer, { volume = 1, refDistance = 4, loop = false, rolloff = 2 } = {}) {
    const audio = new THREE.PositionalAudio(this.listener);
    audio.setBuffer(buffer);
    audio.setRefDistance(refDistance);
    audio.setRolloffFactor(rolloff);
    audio.setLoop(loop);
    audio.setVolume(volume * this.masterVolume * this.sfxVolume);
    object3D.add(audio);
    audio.play();
    if (!loop) {
      audio.onEnded = () => {
        object3D.remove(audio);
        audio.disconnect();
      };
    }
    return audio;
  }

  // ---------- gameplay-specific helpers ----------

  footstep(object3D, { running = false, crouching = false } = {}) {
    const dur = crouching ? 0.05 : running ? 0.09 : 0.07;
    const buf = this.noiseBuffer(dur, { decay: 6 });
    const vol = crouching ? 0.15 : running ? 0.55 : 0.32;
    this.playPositional(object3D, buf, { volume: vol, refDistance: crouching ? 1.5 : 3 });
  }

  heartbeat(intensity = 0.5) {
    const buf = this.toneBuffer(45, 0.28, { type: 'sine', decay: 3 });
    this.playOneShot2D(buf, 0.3 + intensity * 0.7);
  }

  ambientHum(object3D) {
    const buf = this.noiseBuffer(2.0, { decay: 0.2 });
    const audio = this.playPositional(object3D, buf, { volume: 0.12, refDistance: 6, loop: true });
    audio.userVolume = 0.12;
    this._activeLoops.push(audio);
    return audio;
  }

  fluorescentBuzz(object3D) {
    const buf = this.toneBuffer(120, 1.5, { type: 'square', decay: 0.1 });
    const audio = this.playPositional(object3D, buf, { volume: 0.05, refDistance: 3, loop: true });
    audio.userVolume = 0.05;
    this._activeLoops.push(audio);
    return audio;
  }

  doorCreak(object3D) {
    const buf = this.toneBuffer(180, 0.9, { type: 'saw', decay: 1.5, freqEnd: 60 });
    this.playPositional(object3D, buf, { volume: 0.6, refDistance: 4 });
  }

  entityGrowl(object3D, pitch = 1) {
    this.playPositional(object3D, this.growlBuffer(1.1, pitch), { volume: 0.8, refDistance: 6, rolloff: 1.5 });
  }

  entityScream(object3D) {
    const buf = this.toneBuffer(800, 0.6, { type: 'square', decay: 2, freqEnd: 200 });
    this.playPositional(object3D, buf, { volume: 0.9, refDistance: 8 });
  }

  jumpscareSting() {
    const buf = this.noiseBuffer(1.1, { decay: 0.8 });
    this.playOneShot2D(buf, 1.0);
    const tone = this.toneBuffer(90, 1.1, { type: 'square', decay: 1.2, freqEnd: 40 });
    this.playOneShot2D(tone, 0.8);
  }

  uiClick() {
    this.playOneShot2D(this.toneBuffer(700, 0.05, { type: 'square', decay: 8 }), 0.25);
  }

  pickupChime() {
    this.playOneShot2D(this.toneBuffer(660, 0.18, { type: 'sine', decay: 3, freqEnd: 990 }), 0.4);
  }

  lockRattle(object3D) {
    this.playPositional(object3D, this.noiseBuffer(0.4, { decay: 4 }), { volume: 0.5, refDistance: 3 });
  }

  breathing(intensity = 0.4) {
    this.playOneShot2D(this.toneBuffer(180, 0.7, { type: 'sine', decay: 2 }), 0.15 + intensity * 0.2);
  }

  stopAllLoops() {
    this._activeLoops.forEach((a) => {
      try { a.stop(); a.disconnect(); } catch (e) { /* ignore */ }
    });
    this._activeLoops = [];
  }
}
