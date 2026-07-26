// Pure HTML template builders for each full-screen UI panel. UIManager
// injects these into #ui-root and wires up event listeners afterwards.

export function mainMenuHTML(hasSave) {
  return `
    <div class="bd-menu" id="screen-main">
      <div class="bd-noise"></div>
      <div class="bd-title">BACKDOOR</div>
      <div class="bd-subtitle">99개의 문. 하나의 출구.</div>
      <div class="bd-btn-list">
        <button class="bd-btn" id="btn-play">Play</button>
        <button class="bd-btn" id="btn-continue" ${hasSave ? '' : 'disabled'}>Continue</button>
        <button class="bd-btn" id="btn-settings">Settings</button>
        <button class="bd-btn" id="btn-codex">Entity Codex</button>
        <button class="bd-btn" id="btn-stats">Statistics</button>
        <button class="bd-btn" id="btn-credits">Credits</button>
        <button class="bd-btn danger" id="btn-quit">Quit</button>
      </div>
      <div class="bd-footer-links">WASD 이동 · Shift 달리기 · C 앉기 · Space 점프 · E 상호작용 · F 손전등 · ESC 메뉴</div>
    </div>
  `;
}

export function settingsHTML(values) {
  return `
    <div class="bd-menu" id="screen-settings">
      <div class="bd-panel">
        <h2>Settings</h2>
        <div class="bd-row"><span>마스터 볼륨</span><input type="range" id="s-master" min="0" max="1" step="0.01" value="${values.masterVolume}"></div>
        <div class="bd-row"><span>효과음 볼륨</span><input type="range" id="s-sfx" min="0" max="1" step="0.01" value="${values.sfxVolume}"></div>
        <div class="bd-row"><span>음악/앰비언트 볼륨</span><input type="range" id="s-music" min="0" max="1" step="0.01" value="${values.musicVolume}"></div>
        <div class="bd-row"><span>마우스 감도</span><input type="range" id="s-sens" min="0.05" max="1" step="0.01" value="${values.mouseSensitivity}"></div>
        <div class="bd-row"><span>시야각 (FOV)</span><input type="range" id="s-fov" min="60" max="110" step="1" value="${values.fov}"></div>
        <div class="bd-row"><span>밝기</span><input type="range" id="s-brightness" min="0.5" max="1.6" step="0.01" value="${values.brightness}"></div>
        <div class="bd-row"><span>그래픽 품질</span>
          <select id="s-graphics">
            <option value="low" ${values.graphics === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${values.graphics === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${values.graphics === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
        <div class="bd-row"><span>언어</span>
          <select id="s-lang">
            <option value="ko" ${values.language === 'ko' ? 'selected' : ''}>한국어</option>
            <option value="en" ${values.language === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
        <div class="bd-btn-list" style="margin-top:1.5rem">
          <button class="bd-btn" id="btn-settings-back">Back</button>
        </div>
      </div>
    </div>
  `;
}

export function pauseMenuHTML(doorIndex) {
  return `
    <div class="bd-menu" id="screen-pause">
      <div class="bd-panel" style="text-align:center">
        <h2 style="text-align:left">PAUSED</h2>
        <p style="margin-bottom:1.5rem;color:#aaa;font-size:0.8rem">현재 문: Door ${String(doorIndex).padStart(2, '0')} / 99</p>
        <div class="bd-btn-list">
          <button class="bd-btn" id="btn-resume">Resume</button>
          <button class="bd-btn" id="btn-pause-settings">Settings</button>
          <button class="bd-btn" id="btn-pause-codex">Entity Codex</button>
          <button class="bd-btn" id="btn-pause-save">Save Game</button>
          <button class="bd-btn danger" id="btn-pause-quit">Save &amp; Quit to Menu</button>
        </div>
      </div>
    </div>
  `;
}

export function gameOverHTML(stats) {
  return `
    <div class="end-screen gameover" id="screen-gameover">
      <div class="bd-title">GAME OVER</div>
      <div class="bd-subtitle">${stats.cause || '알 수 없는 존재에게 붙잡혔다...'}</div>
      <div class="end-stats">
        <span class="label">도달한 문</span><span>${stats.doorIndex} / 99</span>
        <span class="label">생존 시간</span><span>${formatTime(stats.timeSec)}</span>
        <span class="label">총 사망 횟수</span><span>${stats.totalDeaths}</span>
        <span class="label">최고 기록</span><span>Door ${stats.bestDoor}</span>
      </div>
      <div class="bd-btn-list" style="margin-top:1rem">
        <button class="bd-btn" id="btn-gameover-retry">Retry</button>
        <button class="bd-btn" id="btn-gameover-menu">Main Menu</button>
      </div>
    </div>
  `;
}

export function winHTML(stats) {
  return `
    <div class="end-screen win" id="screen-win">
      <div class="bd-title">YOU ESCAPED</div>
      <div class="bd-subtitle">99개의 문을 모두 통과했다.</div>
      <div class="end-stats">
        <span class="label">클리어 시간</span><span>${formatTime(stats.timeSec)}</span>
        <span class="label">총 완주 횟수</span><span>${stats.runsCompleted}</span>
        <span class="label">총 사망 횟수</span><span>${stats.totalDeaths}</span>
      </div>
      <div class="bd-btn-list" style="margin-top:1rem">
        <button class="bd-btn" id="btn-win-again">Play Again</button>
        <button class="bd-btn" id="btn-win-menu">Main Menu</button>
      </div>
    </div>
  `;
}

export function codexHTML(entries, backTargetLabel = 'Back') {
  return `
    <div class="bd-menu" id="screen-codex">
      <div class="bd-panel" style="min-width:640px">
        <h2>Entity Codex</h2>
        <div class="codex-grid">
          ${entries.map((e) => `
            <div class="codex-entry ${e.seen ? '' : 'locked'}">
              <h3>${e.seen ? e.codexName : '???'}</h3>
              <p>${e.seen ? e.codexDesc : '아직 목격되지 않았다.'}</p>
              ${e.seen ? `<p style="color:#666">목격 횟수: ${e.count}</p>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="bd-btn-list" style="margin-top:1.5rem">
          <button class="bd-btn" id="btn-codex-back">${backTargetLabel}</button>
        </div>
      </div>
    </div>
  `;
}

export function statsHTML(stats, achievements) {
  return `
    <div class="bd-menu" id="screen-stats">
      <div class="bd-panel" style="min-width:600px">
        <h2>Statistics</h2>
        <div class="bd-row"><span>총 플레이 시간</span><span>${formatTime(stats.totalPlayTimeSec)}</span></div>
        <div class="bd-row"><span>사망 횟수</span><span>${stats.deaths}</span></div>
        <div class="bd-row"><span>최고 기록 (문)</span><span>Door ${stats.bestDoor}</span></div>
        <div class="bd-row"><span>탈출 성공 횟수</span><span>${stats.runsCompleted}</span></div>
        <div class="bd-row"><span>발견한 페이크 문</span><span>${stats.fakeDoorsFound}</span></div>
        <div class="bd-row"><span>수집한 아이템</span><span>${stats.itemsCollected}</span></div>
        <div class="bd-row"><span>은신 횟수</span><span>${stats.timesHidden}</span></div>
        <div class="bd-row"><span>누적 획득 코인</span><span>${stats.totalCoins || 0}</span></div>
        <h2 style="margin-top:1.5rem">Achievements (${achievements.filter((a) => a.unlocked).length}/${achievements.length})</h2>
        <div class="codex-grid">
          ${achievements.map((a) => `
            <div class="codex-entry ${a.unlocked ? '' : 'locked'}">
              <h3>${a.unlocked ? a.name : '???'}</h3>
              <p>${a.unlocked ? a.desc : '잠김'}</p>
            </div>
          `).join('')}
        </div>
        <div class="bd-btn-list" style="margin-top:1.5rem">
          <button class="bd-btn" id="btn-stats-back">Back</button>
        </div>
      </div>
    </div>
  `;
}

export function creditsHTML() {
  return `
    <div class="bd-menu" id="screen-credits">
      <div class="bd-panel" style="text-align:center">
        <h2>Credits</h2>
        <p style="color:#ccc;line-height:1.8;font-size:0.85rem">
          BACKDOOR<br/>
          A Three.js first-person horror game<br/>
          inspired by Backrooms &amp; Roblox Doors.<br/><br/>
          Built with Three.js, Vite &amp; the Web Audio API.<br/>
          Procedurally generated rooms, doors and entities.
        </p>
        <div class="bd-btn-list" style="margin-top:1.5rem">
          <button class="bd-btn" id="btn-credits-back">Back</button>
        </div>
      </div>
    </div>
  `;
}

function formatTime(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
