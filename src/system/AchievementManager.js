const STORAGE_KEY = 'backdoor.achievements.v1';

export const ACHIEVEMENT_DEFS = [
  { id: 'first_door', name: '첫 걸음', desc: '첫 번째 문을 통과했다.' },
  { id: 'door_25', name: '깊어지는 어둠', desc: '25번째 문에 도달했다.' },
  { id: 'door_50', name: '절반의 여정', desc: '50번째 문에 도달했다.' },
  { id: 'door_77', name: '행운의 숫자', desc: '77번째 문에 도달했다.' },
  { id: 'basement_reached', name: '가짜 결말', desc: '탈출한 줄 알았지만... 지하로 떨어졌다.' },
  { id: 'escaped', name: 'BACKDOOR', desc: '지하 -100층까지 모두 통과해 진짜로 탈출했다.' },
  { id: 'first_hide', name: '숨바꼭질', desc: '처음으로 은신처에 숨었다.' },
  { id: 'rush_survive', name: '질주 생존자', desc: 'Rush를 숨어서 피했다.' },
  { id: 'unknown_seen', name: '알 수 없는 존재', desc: '희귀 개체 Unknown을 목격했다.' },
  { id: 'fake_door', name: '함정 발견', desc: '페이크 문을 열어 함정을 경험했다.' },
  { id: 'first_death', name: '첫 죽음', desc: '처음으로 사망했다.' },
  { id: 'survivor_5', name: '생존 본능', desc: '5번 사망 후에도 포기하지 않았다.' },
  { id: 'codex_complete', name: '개체 도감 완성', desc: '모든 엔티티 종류를 목격했다.' },
  { id: 'no_hit_25', name: '완벽한 잠입', desc: '피해 없이 25개의 문을 통과했다.' },
  { id: 'speedrunner', name: '스피드러너', desc: '10분 이내에 30개의 문을 통과했다.' },
  { id: 'coin_collector', name: '동전 수집가', desc: '서랍에서 누적 100코인을 모았다.' }
];

export class AchievementManager {
  constructor(onUnlock) {
    this.onUnlock = onUnlock;
    this.unlocked = new Set(this._load());
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]));
    } catch (e) { /* ignore */ }
  }

  unlock(id) {
    if (this.unlocked.has(id)) return false;
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === id);
    if (!def) return false;
    this.unlocked.add(id);
    this._save();
    if (this.onUnlock) this.onUnlock(def);
    return true;
  }

  isUnlocked(id) { return this.unlocked.has(id); }

  list() {
    return ACHIEVEMENT_DEFS.map((def) => ({ ...def, unlocked: this.unlocked.has(def.id) }));
  }
}
