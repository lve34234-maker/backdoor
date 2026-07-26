// Centralised keyboard / mouse / pointer-lock input state.

export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.listeners = { interact: [], toggleHide: [], escape: [], toggleFlashlight: [], toggleInventory: [] };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onClick = this._onClick.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.domElement.addEventListener('click', this._onClick);

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
    if (this.enabled && !this.pointerLocked) {
      this.domElement.requestPointerLock();
    }
  }

  requestPointerLock() {
    this.domElement.requestPointerLock();
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
    if (e.code === 'Tab') { e.preventDefault(); this._emit('toggleInventory'); }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onMouseMove(e) {
    if (!this.pointerLocked || !this.enabled) return;
    this.mouseDX += e.movementX || 0;
    this.mouseDY += e.movementY || 0;
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
    if (!v) this.keys.clear();
  }
}
