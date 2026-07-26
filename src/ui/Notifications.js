// Small floating text notifications shown in the middle-upper HUD area
// (e.g. "형광등이 터졌다!", "배터리를 획득했다").

export class Notifications {
  constructor(container) {
    this.container = container;
  }

  push(text) {
    const el = document.createElement('div');
    el.className = 'hud-notification';
    el.textContent = text;
    this.container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

export class AchievementToasts {
  constructor(root) {
    this.root = root;
  }

  push(def) {
    const el = document.createElement('div');
    el.className = 'achv-toast';
    el.innerHTML = `<strong>업적 달성</strong><br>${def.name} - ${def.desc}`;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}
