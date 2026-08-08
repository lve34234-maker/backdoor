// On-screen touch controls for phones/tablets (Android/iOS WebView or a
// mobile browser tab) - a virtual joystick for movement, a full-screen
// drag zone for looking around, and a cluster of action buttons standing
// in for the keys a touchscreen doesn't have. Feeds straight into the same
// InputManager the keyboard/mouse path uses, so nothing downstream needs
// to know or care where the input came from.

export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

const JOYSTICK_RADIUS = 52; // px the knob can travel from centre

export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.visible = false;

    this.el = document.createElement('div');
    this.el.className = 'tc-root';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <div class="tc-look-zone" data-zone="look"></div>
      <div class="tc-joystick-zone" data-zone="joystick">
        <div class="tc-joystick-knob"></div>
      </div>
      <div class="tc-buttons-main">
        <button class="tc-btn tc-btn-round tc-btn-jump" data-action="jump">점프</button>
        <button class="tc-btn tc-btn-round tc-btn-interact" data-action="interact">E</button>
      </div>
      <div class="tc-buttons-secondary">
        <button class="tc-btn tc-btn-sm" data-toggle="crouch">앉기</button>
        <button class="tc-btn tc-btn-sm" data-toggle="sprint">달리기</button>
        <button class="tc-btn tc-btn-sm" data-action="toggleFlashlight">🔦</button>
      </div>
      <div class="tc-buttons-top">
        <button class="tc-btn tc-btn-sm" data-action="toggleInventory">가방</button>
        <button class="tc-btn tc-btn-sm" data-action="toggleThirdPerson">시점</button>
        <button class="tc-btn tc-btn-sm" data-action="escape">☰</button>
      </div>
    `;
    root.appendChild(this.el);

    this.joystickZone = this.el.querySelector('[data-zone="joystick"]');
    this.joystickKnob = this.el.querySelector('.tc-joystick-knob');
    this.lookZone = this.el.querySelector('[data-zone="look"]');

    this._touches = new Map(); // identifier -> { kind, ...state }
    this._toggleState = { crouch: false, sprint: false };

    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this.el.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.el.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.el.addEventListener('touchend', this._onTouchEnd, { passive: false });
    this.el.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

    // One-shot action buttons (tap = fire once).
    this.el.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._fireAction(btn.dataset.action);
        btn.classList.add('tc-pressed');
      }, { passive: false });
      btn.addEventListener('touchend', () => btn.classList.remove('tc-pressed'));
    });

    // Held/toggle buttons (crouch, sprint) - tap to switch on/off.
    this.el.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.dataset.toggle;
        const active = !this._toggleState[key];
        this._toggleState[key] = active;
        btn.classList.toggle('tc-pressed', active);
        const code = key === 'crouch' ? 'KeyC' : 'ShiftLeft';
        if (active) this.input.keys.add(code);
        else this.input.keys.delete(code);
      }, { passive: false });
    });
  }

  _fireAction(action) {
    if (action === 'jump') {
      this.input.keys.add('Space');
      setTimeout(() => this.input.keys.delete('Space'), 120);
      return;
    }
    this.input.emitAction(action);
  }

  _onTouchStart(e) {
    for (const touch of e.changedTouches) {
      const el = touch.target.closest('[data-zone]');
      if (!el) continue; // buttons handle their own listeners
      const zone = el.dataset.zone;
      e.preventDefault();
      if (zone === 'joystick' && !this._hasKindActive('joystick')) {
        const rect = this.joystickZone.getBoundingClientRect();
        this._touches.set(touch.identifier, {
          kind: 'joystick',
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2
        });
      } else if (zone === 'look' && !this._hasKindActive('look')) {
        this._touches.set(touch.identifier, {
          kind: 'look',
          lastX: touch.clientX,
          lastY: touch.clientY
        });
      }
    }
  }

  _onTouchMove(e) {
    for (const touch of e.changedTouches) {
      const t = this._touches.get(touch.identifier);
      if (!t) continue;
      e.preventDefault();
      if (t.kind === 'joystick') {
        let dx = touch.clientX - t.cx;
        let dy = touch.clientY - t.cy;
        const dist = Math.hypot(dx, dy);
        if (dist > JOYSTICK_RADIUS) {
          dx = (dx / dist) * JOYSTICK_RADIUS;
          dy = (dy / dist) * JOYSTICK_RADIUS;
        }
        this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        // Screen Y grows downward; "up" on the stick should mean forward.
        this.input.setVirtualMove(dx / JOYSTICK_RADIUS, -dy / JOYSTICK_RADIUS);
      } else if (t.kind === 'look') {
        const dx = touch.clientX - t.lastX;
        const dy = touch.clientY - t.lastY;
        t.lastX = touch.clientX;
        t.lastY = touch.clientY;
        // Touch drag is a direct analogue of mouse movement, but a finger
        // swipe covers far fewer pixels than a mouse does for the same
        // turn - boost it so a comfortable swipe actually turns the camera.
        this.input.addLookDelta(dx * 2.2, dy * 2.2);
      }
    }
  }

  _onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      const t = this._touches.get(touch.identifier);
      if (!t) continue;
      this._touches.delete(touch.identifier);
      if (t.kind === 'joystick') {
        this.joystickKnob.style.transform = 'translate(0, 0)';
        this.input.setVirtualMove(0, 0);
      }
    }
  }

  _hasKindActive(kind) {
    for (const t of this._touches.values()) if (t.kind === kind) return true;
    return false;
  }

  setVisible(visible) {
    this.visible = visible;
    this.el.style.display = visible ? 'block' : 'none';
    if (!visible) {
      this._touches.clear();
      this.input.setVirtualMove(0, 0);
      this.joystickKnob.style.transform = 'translate(0, 0)';
      Object.keys(this._toggleState).forEach((key) => {
        this._toggleState[key] = false;
        this.input.keys.delete(key === 'crouch' ? 'KeyC' : 'ShiftLeft');
      });
      this.el.querySelectorAll('.tc-pressed').forEach((b) => b.classList.remove('tc-pressed'));
    }
  }
}
