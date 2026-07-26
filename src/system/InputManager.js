// Centralised keyboard / mouse / pointer-lock input state.
//
// Mouse look works two ways: real Pointer Lock (preferred - the cursor
// stays hidden and centred) and a click-and-drag fallback that works even
// in contexts where the browser refuses Pointer Lock (e.g. a sandboxed
// iframe), so the camera can always be turned with the mouse.

export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.domElement.tabIndex = -1;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.dragging = false;
    this._lastDragX = 0;
    this._lastDragY = 0;
    this.listeners = {
      interact: [], toggleHide: [], escape: [], toggleFlashlight: [], toggleInventory: [],
      toggleBuild: [], buildPlace: [], buildRemove: [], toggleThirdPerson: []
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.domElement.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.domElement.addEventListener('click', this._onClick);
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.enabled = false;
  }

  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  _emit(event) {
    (this.listeners[event] || []).forEach((cb) => cb());
  }

  _onClick() {
    if (!this.enabled) return;
    this.domElement.focus?.();
    if (!this.pointerLocked) {
      // Best-effort: succeeds in a normal tab, silently no-ops (or fires
      // pointerlockerror) in contexts that forbid it - drag-to-look below
      // covers that case either way.
      this.domElement.requestPointerLock?.();
    }
  }

  _onMouseDown(e) {
    if (!this.enabled || e.button !== 0) return;
    this.dragging = true;
    this._lastDragX = e.clientX;
    this._lastDragY = e.clientY;
  }

  _onMouseUp() {
    this.dragging = false;
  }

  requestPointerLock() {
    this.domElement.requestPointerLock?.();
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  }

  _onKeyDown(e) {
    if (e.code === 'Escape') {
      this._emit('escape');
      return;
    }
    if (!this.enabled) return;
    if (this.keys.has(e.code)) return;
    this.keys.add(e.code);

    if (e.code === 'KeyE') this._emit('interact');
    if (e.code === 'KeyF') this._emit('toggleFlashlight');
    if (e.code === 'KeyB') this._emit('toggleThirdPerson');
    if (e.code === 'KeyV') this._emit('toggleBuild');
    if (e.code === 'KeyG') this._emit('buildPlace');
    if (e.code === 'KeyH') this._emit('buildRemove');
    if (e.code === 'Tab') { e.preventDefault(); this._emit('toggleInventory'); }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onMouseMove(e) {
    if (!this.enabled) return;
    if (this.pointerLocked) {
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    } else if (this.dragging) {
      this.mouseDX += e.clientX - this._lastDragX;
      this.mouseDY += e.clientY - this._lastDragY;
      this._lastDragX = e.clientX;
      this._lastDragY = e.clientY;
    }
  }

  consumeMouseDelta() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  get forward() { return this.isDown('KeyW') || this.isDown('ArrowUp'); }
  get backward() { return this.isDown('KeyS') || this.isDown('ArrowDown'); }
  get left() { return this.isDown('KeyA') || this.isDown('ArrowLeft'); }
  get right() { return this.isDown('KeyD') || this.isDown('ArrowRight'); }
  get sprint() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }
  get crouch() { return this.isDown('KeyC'); }
  get jump() { return this.isDown('Space'); }

  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.keys.clear(); this.dragging = false; }
  }
}
