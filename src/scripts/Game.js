import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { PlayerController } from './PlayerController.js';
import { FlashlightController } from './FlashlightController.js';
import { Inventory } from './Inventory.js';
import { InputManager } from '../system/InputManager.js';
import { AudioManager } from '../system/AudioManager.js';
import { SettingsManager } from '../system/SettingsManager.js';
import { AchievementManager } from '../system/AchievementManager.js';
import { StatsManager } from '../system/StatsManager.js';
import { SaveManager } from '../save/SaveManager.js';
import { Random, randomSeed } from '../system/Random.js';
import { generateChunk } from '../rooms/RoomGenerator.js';
import { updateDoors, swingDoorOpen, markDoorFake } from '../rooms/DoorSystem.js';
import { HazardRunner } from '../rooms/Traps.js';
import { EntityManager } from '../entities/EntityManager.js';
import { UIManager } from '../ui/UIManager.js';

const TOTAL_DOORS = 99;
const INTERACT_RANGE = 1.6;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.sceneManager = new SceneManager(canvas);
    this.input = new InputManager(canvas);
    this.audio = new AudioManager();
    this.audio.attachToCamera(this.sceneManager.camera);
    this.settings = new SettingsManager();
    this.stats = new StatsManager();
    this.saveManager = new SaveManager();
    this.achievements = new AchievementManager((def) => this.ui?.hud.unlockToast(def));

    this.ui = new UIManager(document.getElementById('ui-root'));
    this.player = new PlayerController(this.sceneManager.camera, this.input);
    this.flashlight = new FlashlightController(this.sceneManager.camera);
    this.inventory = new Inventory();
    this.entityManager = new EntityManager(this.sceneManager.scene);

    this.ambientLight = new THREE.AmbientLight(0x3a3420, 0.7);
    this.sceneManager.scene.add(this.ambientLight);

    this.state = 'menu';
    this.doorIndex = 1;
    this.seed = randomSeed();
    this.rng = new Random(this.seed);
    this.currentChunk = null;
    this.hazardRunner = null;
    this.runTimeSec = 0;
    this.entitiesSeen = {};
    this.doorsSinceHit = 0;
    this.runStartTime = 0;
    this.deathCause = '';
    this.interactTarget = null;
    this._chunkAmbientAudio = [];

    this._applySettingsToSystems();
    this._wireInput();
    this._wireUI();
    this.settings.onChange(() => this._applySettingsToSystems());

    this.ui.showMainMenu(this.saveManager.hasSave());
    this._lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  // ---------------- setup ----------------

  _applySettingsToSystems() {
    const s = this.settings.values;
    this.audio.setVolumes({ master: s.masterVolume, sfx: s.sfxVolume, music: s.musicVolume });
    this.player.setSensitivity(s.mouseSensitivity);
    this.sceneManager.setFOV(s.fov);
    this.sceneManager.setBrightness(s.brightness);
    this.sceneManager.setGraphicsQuality(s.graphics);
  }

  _wireInput() {
    this.input.on('escape', () => this._handleEscape());
    this.input.on('interact', () => this._handleInteract());
    this.input.on('toggleFlashlight', () => {
      if (this.state === 'playing') {
        this.flashlight.toggle();
        this.audio.uiClick();
      }
    });

    this.player.onFootstep = (running, crouching) => {
      this.audio.footstep(this.sceneManager.camera, { running, crouching });
    };
  }

  _wireUI() {
    this.ui.on({
      onPlay: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onQuit: () => { window.close(); },
      getSettings: () => this.settings.values,
      onSettingsChanged: (key, value) => this.settings.set(key, value),
      hasSave: () => this.saveManager.hasSave(),
      getDoorIndex: () => this.doorIndex,
      onResume: () => this._resume(),
      onSaveGame: () => { this._persist(); this.ui.hud.notify('저장되었다.'); },
      onQuitToMenu: () => this._quitToMenu(true),
      getEntitiesSeen: () => this.entitiesSeen,
      getStats: () => this.stats.data,
      getAchievements: () => this.achievements.list(),
      onRetry: () => this.startNewGame(),
      onGoToMenu: () => this._quitToMenu(false)
    });
  }

  // ---------------- flow control ----------------

  startNewGame() {
    this.saveManager.clear();
    this.doorIndex = 1;
    this.seed = randomSeed();
    this.rng = new Random(this.seed);
    this.player.health = 100;
    this.player.stamina = 100;
    this.flashlight.battery = 100;
    this.flashlight.on = false;
    this.inventory.clear();
    this.entitiesSeen = {};
    this.doorsSinceHit = 0;
    this.runTimeSec = 0;
    this.runStartTime = 0;
    this._enterChunk(1);
    this._startPlaying();
  }

  continueGame() {
    const save = this.saveManager.load();
    if (!save) { this.startNewGame(); return; }
    this.doorIndex = save.doorIndex || 1;
    this.seed = save.seed || randomSeed();
    this.rng = new Random(this.seed);
    this.player.health = save.health ?? 100;
    this.flashlight.battery = save.battery ?? 100;
    this.inventory.restore(save.inventory);
    this.entitiesSeen = save.entitiesSeen || {};
    this.doorsSinceHit = save.doorsSinceHit || 0;
    this.runTimeSec = save.runTimeSec || 0;
    this._enterChunk(this.doorIndex);
    this._startPlaying();
  }

  _startPlaying() {
    this.state = 'playing';
    this.ui.hide();
    this.ui.hud.setVisible(true);
    document.getElementById('app').classList.add('playing');
    this.input.setEnabled(true);
    this.input.requestPointerLock();
    this.audio.resume();
  }

  _quitToMenu(save) {
    if (save) this._persist();
    this.state = 'menu';
    this.input.setEnabled(false);
    this.input.exitPointerLock();
    document.getElementById('app').classList.remove('playing');
    this.ui.hud.setVisible(false);
    this.ui.showMainMenu(this.saveManager.hasSave());
  }

  _handleEscape() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.input.setEnabled(false);
      this.input.exitPointerLock();
      this.ui.showPause(this.doorIndex);
    } else if (this.state === 'paused') {
      this._resume();
    }
  }

  _resume() {
    this.state = 'playing';
    this.ui.hide();
    this.input.setEnabled(true);
    this.input.requestPointerLock();
  }

  _persist() {
    this.saveManager.save({
      doorIndex: this.doorIndex,
      seed: this.seed,
      health: this.player.health,
      battery: this.flashlight.battery,
      inventory: this.inventory.serialize(),
      entitiesSeen: this.entitiesSeen,
      doorsSinceHit: this.doorsSinceHit,
      runTimeSec: this.runTimeSec
    });
  }

  // ---------------- chunk / door transitions ----------------

  _enterChunk(doorIndex) {
    if (this.currentChunk) {
      this.sceneManager.scene.remove(this.currentChunk.group);
      this.currentChunk.dispose();
      this.entityManager.clear();
    }
    this.audio.stopAllLoops();

    const chunk = generateChunk(doorIndex, this.rng);
    this.sceneManager.scene.add(chunk.group);
    this.player.teleport(chunk.playerSpawn.x, chunk.playerSpawn.y, chunk.playerSpawn.z, chunk.playerSpawn.yaw);
    this.player.setColliders(chunk.colliders);
    this.player.isHidden = false;
    this.entityManager.spawnForChunk(chunk);

    this.audio.ambientHum(chunk.group);
    if (chunk.lights[0]) this.audio.fluorescentBuzz(chunk.lights[0].fixture || chunk.group);

    this.hazardRunner = chunk.hazard ? new HazardRunner(chunk.hazard, chunk, this.rng.child(`hazard_${doorIndex}`)) : null;
    if (this.hazardRunner) {
      this.hazardRunner.start({
        audio: this.audio,
        sceneManager: this.sceneManager,
        camera: this.sceneManager.camera,
        notify: (t) => this.ui.hud.notify(t),
        onShadowFlash: () => this._doShadowFlash()
      });
    }

    this.currentChunk = chunk;
    this.doorIndex = doorIndex;

    let objective = '문을 찾아 다음 구역으로 이동하세요.';
    if (chunk.isFakeDoorRoom) objective = '두 개의 문 중 하나는 함정이다. 신중하게 선택하라.';
    else if (chunk.type === 'maze') objective = '미로를 빠져나가 출구 문을 찾으세요.';
    else if (chunk.type === 'hiding_room') objective = '위험하다... 숨을 곳을 확인하세요.';
    this.objective = objective;
  }

  _doShadowFlash() {
    this.ui.hud.showJumpscare(140);
  }

  _startDoorTransition(doorDef) {
    if (this.state !== 'playing') return;
    this.state = 'transition';
    this.input.setEnabled(false);
    swingDoorOpen(doorDef);
    this.audio.doorCreak(doorDef.group);

    setTimeout(() => {
      this.ui.hud.fadeOut();
      setTimeout(() => {
        if (doorDef.isFinal || this.doorIndex >= TOTAL_DOORS) {
          this._triggerWin();
        } else {
          this._advanceDoor();
        }
        this.ui.hud.fadeIn();
        setTimeout(() => {
          this.state = 'playing';
          this.input.setEnabled(true);
          this.input.requestPointerLock();
        }, 250);
      }, 550);
    }, 350);
  }

  _advanceDoor() {
    const next = this.doorIndex + 1;
    this.doorsSinceHit += 1;
    this._checkDoorAchievements(next);
    this._enterChunk(next);
    this._persist();
  }

  _checkDoorAchievements(next) {
    if (next >= 2) this.achievements.unlock('first_door');
    if (next >= 25) this.achievements.unlock('door_25');
    if (next >= 50) this.achievements.unlock('door_50');
    if (next >= 77) this.achievements.unlock('door_77');
    if (this.doorsSinceHit >= 25) this.achievements.unlock('no_hit_25');
    if (next >= 31 && this.runTimeSec <= 600) this.achievements.unlock('speedrunner');
  }

  _handleFakeDoor(doorDef) {
    markDoorFake(doorDef);
    this.stats.recordFakeDoor();
    this.achievements.unlock('fake_door');
    this.ui.hud.notify('함정이었다!');
    this.ui.hud.showJumpscare(700);
    this.ui.hud.flashDamage();
    this.audio.jumpscareSting();
    const dead = this._damagePlayer(this.rng.int(10, 25));
    if (dead) return;

    if (this.rng.bool(0.35)) {
      this.hazardRunner = new HazardRunner('blackout', this.currentChunk, this.rng);
      this.hazardRunner.start({ audio: this.audio, sceneManager: this.sceneManager, camera: this.sceneManager.camera, notify: (t) => this.ui.hud.notify(t) });
    }
    if (this.rng.bool(0.3)) {
      const pos = this.player.position.clone();
      pos.x += this.rng.range(-3, 3);
      pos.z += this.rng.range(2, 4);
      this.entityManager.spawnAt(this.rng.pick(['monster', 'crawler']), pos);
    }
  }

  // ---------------- interaction ----------------

  _handleInteract() {
    if (this.state !== 'playing') return;

    if (this.player.isHidden) {
      this._exitHiding();
      return;
    }

    if (this.interactTarget?.type === 'door') {
      const doorDef = this.interactTarget.ref;
      if (doorDef.locked) {
        if (this.inventory.hasKey()) {
          this.inventory.useKey();
          doorDef.locked = false;
          this.ui.hud.notify('열쇠로 문을 열었다.');
        } else {
          this.audio.lockRattle(doorDef.group);
          this.ui.hud.notify('문이 잠겨 있다. 열쇠가 필요하다.');
          return;
        }
      }
      if (doorDef.isReal) {
        this._startDoorTransition(doorDef);
      } else {
        this._handleFakeDoor(doorDef);
      }
    } else if (this.interactTarget?.type === 'hideSpot') {
      this._enterHiding(this.interactTarget.ref);
    } else if (this.interactTarget?.type === 'item') {
      this._collectItem(this.interactTarget.ref);
    }
  }

  _enterHiding(spot) {
    spot.occupied = true;
    this.player.isHidden = true;
    this.currentHideSpot = spot;
    this.stats.recordHidden();
    this.achievements.unlock('first_hide');
    this.audio.breathing(0.5);
  }

  _exitHiding() {
    if (this.currentHideSpot) this.currentHideSpot.occupied = false;
    this.currentHideSpot = null;
    this.player.isHidden = false;
  }

  _collectItem(item) {
    if (item.collected) return;
    item.collected = true;
    if (item.mesh) item.mesh.visible = false;
    this.stats.recordItemCollected();
    this.audio.pickupChime();

    if (item.type === 'battery') {
      this.flashlight.addBattery(35);
      this.ui.hud.notify('배터리를 획득했다.');
    } else if (item.type === 'health') {
      this.player.heal(30);
      this.ui.hud.notify('구급 키트를 사용했다.');
    } else if (item.type === 'key') {
      this.inventory.add({ type: 'key', label: '열쇠', id: item.id });
      this.ui.hud.notify('열쇠를 획득했다.');
    }
  }

  // ---------------- damage / entities ----------------

  _damagePlayer(amount) {
    const dead = this.player.takeDamage(amount);
    this.doorsSinceHit = 0;
    this.ui.hud.flashDamage();
    if (dead) this._triggerGameOver();
    return dead;
  }

  _onEntityDamage(amount, instaKill, type) {
    this.deathCause = `${type} 에게 붙잡혔다.`;
    if (instaKill) {
      this.player.health = 0;
      this.ui.hud.flashDamage();
      this._triggerGameOver();
      return;
    }
    this._damagePlayer(amount);
  }

  _onEntitySighted(type) {
    if (!this.entitiesSeen[type]) this.entitiesSeen[type] = 0;
    this.entitiesSeen[type] += 1;
    this.stats.recordEntitySeen(type);
    if (type === 'unknown') this.achievements.unlock('unknown_seen');
    if (Object.keys(this.entitiesSeen).length >= 7) this.achievements.unlock('codex_complete');
  }

  _isDark(position) {
    if (this.flashlight.on) return false;
    const lights = this.currentChunk?.lights || [];
    for (const l of lights) {
      if (l.light.intensity > 0.25 && l.light.position.distanceTo(position) < 8) return false;
    }
    return true;
  }

  _triggerGameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.input.setEnabled(false);
    this.input.exitPointerLock();
    this.stats.recordDeath(this.doorIndex);
    this.achievements.unlock('first_death');
    if (this.stats.data.deaths >= 5) this.achievements.unlock('survivor_5');
    this.saveManager.clear();
    this.ui.hud.setVisible(false);
    this.ui.showGameOver({
      cause: this.deathCause,
      doorIndex: this.doorIndex,
      timeSec: this.runTimeSec,
      totalDeaths: this.stats.data.deaths,
      bestDoor: this.stats.data.bestDoor
    });
  }

  _triggerWin() {
    this.state = 'win';
    this.input.setEnabled(false);
    this.input.exitPointerLock();
    this.stats.recordEscape(TOTAL_DOORS);
    this.achievements.unlock('escaped');
    this.saveManager.clear();
    this.ui.hud.setVisible(false);
    this.ui.showWin({
      timeSec: this.runTimeSec,
      runsCompleted: this.stats.data.runsCompleted,
      totalDeaths: this.stats.data.deaths
    });
  }

  // ---------------- interaction target scan ----------------

  _scanInteractTarget() {
    this.interactTarget = null;
    let prompt = '';
    if (!this.currentChunk) { this._interactPrompt = ''; return; }

    if (this.player.isHidden) { this._interactPrompt = 'E - 나오기'; return; }

    const p = this.player.position;
    for (const door of this.currentChunk.doors) {
      if (door.opened) continue;
      if (door.knownFake) continue;
      const d = p.distanceTo(door.interactPoint);
      if (d < INTERACT_RANGE) {
        this.interactTarget = { type: 'door', ref: door };
        prompt = door.locked ? 'E - 잠긴 문 (열쇠 필요)' : 'E - 문 열기';
        break;
      }
    }

    if (!this.interactTarget) {
      for (const spot of this.currentChunk.hidingSpots) {
        const d = p.distanceTo(spot.position);
        if (d < spot.radius) {
          this.interactTarget = { type: 'hideSpot', ref: spot };
          prompt = 'E - 숨기';
          break;
        }
      }
    }

    if (!this.interactTarget) {
      for (const item of this.currentChunk.items) {
        if (item.collected) continue;
        const d = p.distanceTo(item.position);
        if (d < 1.3) {
          this.interactTarget = { type: 'item', ref: item };
          prompt = 'E - 줍기';
          break;
        }
      }
    }

    this._interactPrompt = prompt;
  }

  // ---------------- main loop ----------------

  _loop(now) {
    const dt = Math.min(0.05, (now - this._lastTime) / 1000);
    this._lastTime = now;

    if (this.state === 'playing') {
      this._update(dt);
    }

    this.sceneManager.render(dt);
    requestAnimationFrame(this._loop.bind(this));
  }

  _update(dt) {
    this.runTimeSec += dt;
    this.player.update(dt);
    this.flashlight.update(dt);
    updateDoors(this.currentChunk?.doors || [], dt);
    this._scanInteractTarget();

    if (this.hazardRunner && !this.hazardRunner.done) {
      this.hazardRunner.update(dt, { sceneManager: this.sceneManager });
    }

    const items = this.currentChunk?.items || [];
    items.forEach((item) => {
      if (item.collected || !item.mesh) return;
      item.mesh.rotation.y += dt * 2;
      item.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.002 + item.position.x) * 0.05;
    });

    if (this.currentChunk) {
      this.entityManager.update(dt, {
        player: this.player,
        grid: this.currentChunk.grid,
        gridOrigin: this.currentChunk.gridOrigin,
        audio: this.audio,
        camera: this.sceneManager.camera,
        isDark: (pos) => this._isDark(pos),
        notify: (t) => this.ui.hud.notify(t),
        onDamage: (amount, instaKill, type) => this._onEntityDamage(amount, instaKill, type),
        onEntityContact: (type) => this._onEntitySighted(type),
        onJumpscare: (type) => { this.ui.hud.showJumpscare(); this._onEntitySighted(type); }
      });

      this.entityManager.active.forEach((e) => {
        if (e.state !== 'patrol' && e.state !== 'dormant' && e.state !== 'disguised' && !e._sightedReported) {
          e._sightedReported = true;
          this._onEntitySighted(e.type);
        }
        if (e.type === 'rush' && e.dead && this.player.health > 0 && !e._survivalCounted) {
          e._survivalCounted = true;
          this.achievements.unlock('rush_survive');
        }
      });
    }

    this.saveManager.tick(dt, () => this._buildSaveState());

    this.ui.hud.update(dt, {
      doorIndex: this.doorIndex,
      objective: this.objective,
      health: this.player.health,
      stamina: this.player.stamina,
      battery: this.flashlight.battery,
      isHidden: this.player.isHidden,
      interactPrompt: this._interactPrompt,
      inventory: this.inventory.items
    });
  }

  _buildSaveState() {
    return {
      doorIndex: this.doorIndex,
      seed: this.seed,
      health: this.player.health,
      battery: this.flashlight.battery,
      inventory: this.inventory.serialize(),
      entitiesSeen: this.entitiesSeen,
      doorsSinceHit: this.doorsSinceHit,
      runTimeSec: this.runTimeSec
    };
  }
}
