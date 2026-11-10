import { DEFAULT_BINDINGS, keyLabel } from './Controls.js';
export class InputManager {
  constructor(canvas) {
    this.bindings = { ...DEFAULT_BINDINGS }; this.rebinding = false;
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.buttons = new Set(); this.dx = 0; this.dy = 0; this.active = false;
    this.abort = new AbortController(); const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => {
      if (this.rebinding) return;
      if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
      if (this.active && (Object.values(this.bindings).includes(e.code) || e.code === 'Tab')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    }, options);
    window.addEventListener('keyup', e => this.keys.delete(e.code), options);
    window.addEventListener('blur', () => this.clear(), options);
    canvas.addEventListener('mousedown', e => {
      if (!this.active || this.rebinding) return;
      if (!this.buttons.has(e.button)) this.pressed.add('Mouse' + e.button);
      this.buttons.add(e.button);
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock()?.catch(() => {});
    }, options);
    window.addEventListener('mouseup', e => this.buttons.delete(e.button), options);
    canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
    window.addEventListener('mousemove', e => {
      if (this.active && (document.pointerLockElement === canvas || this.buttons.size)) { this.dx += e.movementX; this.dy += e.movementY; }
    }, options);
  }
  label(code) { return keyLabel(this.bindings[code] || code); }
  down(code) { const bound = this.bindings[code] || code; return bound.startsWith('Mouse') ? this.buttons.has(Number(bound.slice(5))) : this.keys.has(bound); }
  take(code) { code = this.bindings[code] || code; const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  clear() { this.keys.clear(); this.pressed.clear(); this.buttons.clear(); this.dx = 0; this.dy = 0; }
  dispose() { this.abort.abort(); document.exitPointerLock?.(); }
}
