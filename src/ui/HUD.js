import { Notifications, AchievementToasts } from './Notifications.js';
import { ITEM_DEFS, USABLE_ITEM_TYPES } from '../scripts/ItemDefs.js';

export class HUD {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <div id="hud" style="display:none">
        <div class="hud-top-left">
          <div class="hud-door-number" id="hud-door">Door 01</div>
          <div class="hud-objective" id="hud-objective">문을 찾아 다음 구역으로 이동하세요.</div>
        </div>
        <div class="hud-top-right">
          <div id="hud-fps">FPS: 60</div>
        </div>
        <div class="hud-bottom-left">
          <div>
            <div class="bar-label">체력</div>
            <div class="bar bar-health"><div class="bar-fill" id="bar-health" style="width:100%"></div></div>
          </div>
          <div>
            <div class="bar-label">스태미나</div>
            <div class="bar bar-stamina"><div class="bar-fill" id="bar-stamina" style="width:100%"></div></div>
          </div>
          <div>
            <div class="bar-label">손전등 배터리</div>
            <div class="bar bar-battery"><div class="bar-fill" id="bar-battery" style="width:100%"></div></div>
          </div>
        </div>
        <div class="hud-bottom-right">
          <div class="hud-hide-status" id="hud-hide-status" style="display:none">숨는 중...</div>
          <div class="hud-coins">💰 <span id="hud-coins-count">0</span></div>
          <div class="hud-inventory" id="hud-inventory"></div>
        </div>
        <div class="hud-interact-prompt" id="hud-interact"></div>
        <div class="hud-notifications" id="hud-notifications"></div>
        <div id="inventory-panel" style="display:none">
          <div class="inv-panel-title">인벤토리<button id="inv-panel-close" class="inv-panel-close-btn">✕</button></div>
          <div id="inv-panel-grid" class="inv-panel-grid"></div>
          <div class="inv-panel-hint">Tab 닫기</div>
        </div>
      </div>
      <div id="vignette" style="display:none"></div>
      <div id="damage-flash"></div>
      <div id="hide-overlay"></div>
      <div id="jumpscare"></div>
      <div id="fade-overlay"></div>
      <div id="achv-toast-root"></div>
    `;

    this.el = document.getElementById('hud');
    this.doorEl = document.getElementById('hud-door');
    this.objectiveEl = document.getElementById('hud-objective');
    this.fpsEl = document.getElementById('hud-fps');
    this.healthBar = document.getElementById('bar-health');
    this.staminaBar = document.getElementById('bar-stamina');
    this.batteryBar = document.getElementById('bar-battery');
    this.hideStatusEl = document.getElementById('hud-hide-status');
    this.coinsEl = document.getElementById('hud-coins-count');
    this.inventoryEl = document.getElementById('hud-inventory');
    this.interactEl = document.getElementById('hud-interact');
    this.damageFlashEl = document.getElementById('damage-flash');
    this.hideOverlayEl = document.getElementById('hide-overlay');
    this.jumpscareEl = document.getElementById('jumpscare');
    this.vignetteEl = document.getElementById('vignette');
    this.fadeEl = document.getElementById('fade-overlay');

    this.notifications = new Notifications(document.getElementById('hud-notifications'));
    this.achievements = new AchievementToasts(document.getElementById('achv-toast-root'));

    this.inventoryPanelEl = document.getElementById('inventory-panel');
    this.inventoryGridEl = document.getElementById('inv-panel-grid');
    this.inventoryPanelVisible = false;
    this._invPanelSignature = null;
    this._onUseItem = null;
    this.inventoryGridEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.inv-use-btn');
      if (btn && this._onUseItem) this._onUseItem(btn.dataset.type);
    });
    this._onCloseInventory = null;
    document.getElementById('inv-panel-close').addEventListener('click', () => this._onCloseInventory?.());

    this._fpsTimer = 0;
    this._fpsFrames = 0;
  }

  setUseItemCallback(cb) {
    this._onUseItem = cb;
  }

  setCloseInventoryCallback(cb) {
    this._onCloseInventory = cb;
  }

  setInventoryPanelVisible(visible) {
    this.inventoryPanelVisible = visible;
    this.inventoryPanelEl.style.display = visible ? 'flex' : 'none';
    if (visible) this._invPanelSignature = null; // force a fresh render on open
  }

  renderInventoryPanel(items) {
    // A real click spans several animation frames between mousedown and
    // mouseup; rebuilding this innerHTML every frame (as update() used to)
    // replaces the "사용" button mid-gesture, so mouseup lands on a brand
    // new element and the browser never fires 'click'. Skip the rebuild
    // whenever the grouped contents haven't actually changed.
    const signature = items.map((item) => item.type).sort().join(',');
    if (signature === this._invPanelSignature) return;
    this._invPanelSignature = signature;

    if (!items.length) {
      this.inventoryGridEl.innerHTML = '<p class="inv-panel-empty">아직 아무것도 없다.</p>';
      return;
    }
    const grouped = new Map();
    items.forEach((item) => {
      const key = item.type;
      if (!grouped.has(key)) grouped.set(key, { ...item, count: 0 });
      grouped.get(key).count += 1;
    });
    this.inventoryGridEl.innerHTML = [...grouped.values()].map((item) => `
      <div class="inv-panel-entry">
        <div class="inv-panel-icon">${iconFor(item.type)}</div>
        <div class="inv-panel-info">
          <div class="inv-panel-label">${item.label}${item.count > 1 ? ` x${item.count}` : ''}</div>
          ${item.flavor ? `<div class="inv-panel-flavor">${item.flavor}</div>` : ''}
        </div>
        ${USABLE_ITEM_TYPES.has(item.type) ? `<button class="inv-use-btn" data-type="${item.type}">사용</button>` : ''}
      </div>
    `).join('');
  }

  setVisible(visible) {
    this.el.style.display = visible ? 'block' : 'none';
    this.vignetteEl.style.display = visible ? 'block' : 'none';
  }

  update(dt, state) {
    this._fpsFrames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.4) {
      const fps = Math.round(this._fpsFrames / this._fpsTimer);
      this.fpsEl.textContent = `FPS: ${fps}`;
      this._fpsTimer = 0;
      this._fpsFrames = 0;
    }

    this.doorEl.textContent = state.doorLabel || `Door ${String(state.doorIndex).padStart(2, '0')} / 99`;
    this.objectiveEl.textContent = state.objective || '다음 문을 찾아 이동하세요.';
    this.healthBar.style.width = `${Math.max(0, state.health)}%`;
    this.staminaBar.style.width = `${Math.max(0, state.stamina)}%`;
    this.batteryBar.style.width = `${Math.max(0, state.battery)}%`;

    this.hideStatusEl.style.display = state.isHidden ? 'block' : 'none';
    this.hideOverlayEl.classList.toggle('active', state.isHidden);

    if (state.interactPrompt) {
      this.interactEl.textContent = state.interactPrompt;
      this.interactEl.classList.add('visible');
    } else {
      this.interactEl.classList.remove('visible');
    }

    if (state.inventory) {
      this.inventoryEl.innerHTML = state.inventory.map((item) => `<div class="inv-slot" title="${item.label}">${iconFor(item.type)}</div>`).join('');
      if (this.inventoryPanelVisible) this.renderInventoryPanel(state.inventory);
    }

    if (state.coins != null) this.coinsEl.textContent = state.coins;
  }

  flashDamage() {
    this.damageFlashEl.style.background = 'rgba(161,19,19,0.55)';
    setTimeout(() => { this.damageFlashEl.style.background = 'rgba(161,19,19,0)'; }, 180);
  }

  showJumpscare(duration = 900) {
    this.jumpscareEl.innerHTML = jumpscareSVG();
    this.jumpscareEl.classList.add('active');
    setTimeout(() => this.jumpscareEl.classList.remove('active'), duration);
  }

  notify(text) {
    this.notifications.push(text);
  }

  fadeOut() {
    this.fadeEl.classList.add('active');
  }

  fadeIn() {
    this.fadeEl.classList.remove('active');
  }

  unlockToast(def) {
    this.achievements.push(def);
  }
}

function iconFor(type) {
  return ITEM_DEFS[type]?.icon || '?';
}

function jumpscareSVG() {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="95" fill="#0a0a0a" stroke="#a11313" stroke-width="4"/>
    <ellipse cx="65" cy="90" rx="14" ry="20" fill="#ff2020"/>
    <ellipse cx="135" cy="90" rx="14" ry="20" fill="#ff2020"/>
    <path d="M50 140 Q100 190 150 140 Q100 160 50 140 Z" fill="#3a0000"/>
  </svg>`;
}
