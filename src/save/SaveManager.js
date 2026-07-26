const STORAGE_KEY = 'backdoor.save.v1';
const AUTOSAVE_INTERVAL_SEC = 20;

// Persists progress (current door, health, inventory, seed, checkpoint)
// to localStorage so a run can be resumed with "Continue" from the main menu.

export class SaveManager {
  constructor() {
    this._autosaveTimer = 0;
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
      return true;
    } catch (e) {
      return false;
    }
  }

  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
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
