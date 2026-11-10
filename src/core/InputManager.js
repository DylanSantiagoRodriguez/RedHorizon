export class InputManager {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.buttons = new Set(); this.dx = 0; this.dy = 0; this.active = false;
    this.abort = new AbortController(); const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => {
      if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    }, options);
    window.addEventListener('keyup', e => this.keys.delete(e.code), options);
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener('mousedown', e => {
      if (!this.active) return;
      this.buttons.add(e.button);
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock()?.catch(() => {});
    }, options);
    window.addEventListener('mouseup', e => this.buttons.delete(e.button), options);
    canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
    window.addEventListener('mousemove', e => {
      if (this.active && (document.pointerLockElement === canvas || this.buttons.size)) { this.dx += e.movementX; this.dy += e.movementY; }
    }, options);
  }
  down(code) { return this.keys.has(code); }
  take(code) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  clear() { this.keys.clear(); this.pressed.clear(); this.buttons.clear(); this.dx = 0; this.dy = 0; }
  dispose() { this.abort.abort(); document.exitPointerLock?.(); }
}
