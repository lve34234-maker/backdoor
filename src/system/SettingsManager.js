const STORAGE_KEY = 'backdoor.settings.v1';

const DEFAULTS = {
  masterVolume: 0.8,
  sfxVolume: 1.0,
  musicVolume: 0.6,
  mouseSensitivity: 0.55,
  fov: 82,
  brightness: 1.0,
  graphics: 'high', // low | medium | high
  language: 'ko' // ko | en
};

export class SettingsManager {
  constructor() {
    this.values = { ...DEFAULTS, ...this._load() };
    this.listeners = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch (e) { /* storage unavailable */ }
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    this.values[key] = value;
    this.save();
    this.listeners.forEach((cb) => cb(key, value, this.values));
  }

  onChange(cb) { this.listeners.push(cb); }

  reset() {
    this.values = { ...DEFAULTS };
    this.save();
  }
}
