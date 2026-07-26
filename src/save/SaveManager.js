import { CloudSaveManager } from './CloudSaveManager.js';

const STORAGE_KEY = 'backdoor.save.v1';
const AUTOSAVE_INTERVAL_SEC = 20;

// Persists progress (current door, health, inventory, seed, checkpoint)
// to localStorage so a run can be resumed with "Continue" from the main
// menu. LocalStorage is always the synchronous source of truth; if a
// Firebase project is configured (see firebaseConfig.js) every save is
// also mirrored to Firestore in the background as a cross-device backup.

export class SaveManager {
  constructor() {
    this._autosaveTimer = 0;
    this.cloud = new CloudSaveManager();
  }

  hasSave() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  save(state) {
    let ok = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
      ok = true;
    } catch (e) {
      ok = false;
    }
    if (this.cloud.available) this.cloud.save(state);
    return ok;
  }

  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // Best-effort: if there's no local save yet but a Firebase project is
  // configured and holds one (e.g. the player is on a new device), pull it
  // down into LocalStorage. Safe no-op when Firebase isn't configured.
  async syncFromCloudIfEmpty() {
    if (this.hasSave() || !this.cloud.available) return false;
    await this.cloud.readyPromise;
    if (!this.cloud.ready) return false;
    const cloudState = await this.cloud.load();
    if (cloudState) {
      this.save(cloudState);
      return true;
    }
    return false;
  }

  // Called every frame with dt; auto-saves on interval. `getState` is a
  // callback returning the current serialisable game state.
  tick(dt, getState) {
    this._autosaveTimer += dt;
    if (this._autosaveTimer >= AUTOSAVE_INTERVAL_SEC) {
      this._autosaveTimer = 0;
      this.save(getState());
      return true;
    }
    return false;
  }
}
