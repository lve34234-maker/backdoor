const STORAGE_KEY = 'backdoor.stats.v1';

const DEFAULTS = () => ({
  totalPlayTimeSec: 0,
  deaths: 0,
  bestDoor: 0,
  runsCompleted: 0,
  entitiesEncountered: {},
  fakeDoorsFound: 0,
  itemsCollected: 0,
  timesHidden: 0
});

export class StatsManager {
  constructor() {
    this.data = { ...DEFAULTS(), ...this._load() };
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) { /* ignore */ }
  }

  addPlayTime(sec) { this.data.totalPlayTimeSec += sec; this.save(); }

  recordDeath(doorReached) {
    this.data.deaths += 1;
    this.data.bestDoor = Math.max(this.data.bestDoor, doorReached);
    this.save();
  }

  recordEscape(doorReached) {
    this.data.runsCompleted += 1;
    this.data.bestDoor = Math.max(this.data.bestDoor, doorReached);
    this.save();
  }

  recordEntitySeen(type) {
    this.data.entitiesEncountered[type] = (this.data.entitiesEncountered[type] || 0) + 1;
    this.save();
  }

  recordFakeDoor() { this.data.fakeDoorsFound += 1; this.save(); }
  recordItemCollected() { this.data.itemsCollected += 1; this.save(); }
  recordHidden() { this.data.timesHidden += 1; this.save(); }

  reset() {
    this.data = DEFAULTS();
    this.save();
  }
}
