import { HUD } from './HUD.js';
import {
  mainMenuHTML, settingsHTML, pauseMenuHTML, gameOverHTML,
  winHTML, codexHTML, statsHTML, creditsHTML
} from './screens.js';
import { ENTITY_DEFS } from '../entities/EntityDefinitions.js';

export class UIManager {
  constructor(root) {
    this.root = root;
    this.hudContainer = document.createElement('div');
    root.appendChild(this.hudContainer);
    this.hud = new HUD(this.hudContainer);

    this.menuLayer = document.createElement('div');
    this.menuLayer.className = 'ui-layer';
    this.menuLayer.style.display = 'none';
    root.appendChild(this.menuLayer);

    this.callbacks = {};
    this.settingsReturnTo = 'main';
    this.codexReturnTo = 'main';
  }

  on(callbacks) {
    Object.assign(this.callbacks, callbacks);
  }

  _show(html) {
    this.menuLayer.innerHTML = html;
    this.menuLayer.style.display = 'block';
  }

  hide() {
    this.menuLayer.innerHTML = '';
    this.menuLayer.style.display = 'none';
  }

  showMainMenu(hasSave) {
    this._show(mainMenuHTML(hasSave));
    document.getElementById('btn-play').onclick = () => this.callbacks.onPlay?.();
    document.getElementById('btn-continue').onclick = () => this.callbacks.onContinue?.();
    document.getElementById('btn-settings').onclick = () => this.showSettings('main');
    document.getElementById('btn-codex').onclick = () => this.showCodex('main');
    document.getElementById('btn-stats').onclick = () => this.showStats();
    document.getElementById('btn-credits').onclick = () => this.showCredits();
    document.getElementById('btn-quit').onclick = () => this.callbacks.onQuit?.();
  }

  showSettings(returnTo) {
    this.settingsReturnTo = returnTo;
    const values = this.callbacks.getSettings?.() || {};
    this._show(settingsHTML(values));
    const bind = (id, key, parse = parseFloat) => {
      document.getElementById(id).addEventListener('input', (e) => {
        this.callbacks.onSettingsChanged?.(key, parse(e.target.value));
      });
    };
    bind('s-master', 'masterVolume');
    bind('s-sfx', 'sfxVolume');
    bind('s-music', 'musicVolume');
    bind('s-sens', 'mouseSensitivity');
    bind('s-fov', 'fov');
    bind('s-brightness', 'brightness');
    document.getElementById('s-graphics').addEventListener('change', (e) => this.callbacks.onSettingsChanged?.('graphics', e.target.value));
    document.getElementById('s-lang').addEventListener('change', (e) => this.callbacks.onSettingsChanged?.('language', e.target.value));
    document.getElementById('btn-settings-back').onclick = () => {
      if (returnTo === 'pause') this.showPause(this.callbacks.getDoorLabel?.() || 'Door 01 / 99');
      else this.showMainMenu(this.callbacks.hasSave?.());
    };
  }

  showPause(doorLabel) {
    this._show(pauseMenuHTML(doorLabel));
    document.getElementById('btn-resume').onclick = () => this.callbacks.onResume?.();
    document.getElementById('btn-pause-settings').onclick = () => this.showSettings('pause');
    document.getElementById('btn-pause-codex').onclick = () => this.showCodex('pause');
    document.getElementById('btn-pause-save').onclick = () => this.callbacks.onSaveGame?.();
    document.getElementById('btn-pause-quit').onclick = () => this.callbacks.onQuitToMenu?.();
  }

  showGameOver(stats) {
    this._show(gameOverHTML(stats));
    document.getElementById('btn-gameover-retry').onclick = () => this.callbacks.onRetry?.();
    document.getElementById('btn-gameover-menu').onclick = () => this.callbacks.onGoToMenu?.();
  }

  showWin(stats) {
    this._show(winHTML(stats));
    document.getElementById('btn-win-again').onclick = () => this.callbacks.onRetry?.();
    document.getElementById('btn-win-menu').onclick = () => this.callbacks.onGoToMenu?.();
  }

  showCodex(returnTo) {
    this.codexReturnTo = returnTo;
    const seenMap = this.callbacks.getEntitiesSeen?.() || {};
    const entries = Object.keys(ENTITY_DEFS).map((key) => ({
      codexName: ENTITY_DEFS[key].codexName,
      codexDesc: ENTITY_DEFS[key].codexDesc,
      seen: !!seenMap[key],
      count: seenMap[key] || 0
    }));
    this._show(codexHTML(entries, returnTo === 'pause' ? 'Back to Pause' : 'Back'));
    document.getElementById('btn-codex-back').onclick = () => {
      if (returnTo === 'pause') this.showPause(this.callbacks.getDoorLabel?.() || 'Door 01 / 99');
      else this.showMainMenu(this.callbacks.hasSave?.());
    };
  }

  showStats() {
    const stats = this.callbacks.getStats?.() || {};
    const achievements = this.callbacks.getAchievements?.() || [];
    this._show(statsHTML(stats, achievements));
    document.getElementById('btn-stats-back').onclick = () => this.showMainMenu(this.callbacks.hasSave?.());
  }

  showCredits() {
    this._show(creditsHTML());
    document.getElementById('btn-credits-back').onclick = () => this.showMainMenu(this.callbacks.hasSave?.());
  }
}
