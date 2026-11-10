// Require a quiet interval after firing/confirming is released, including repeat clicks.
export class UpgradeSelectionGate {
  constructor(now, fireBinding = 'Mouse0') {
    this.fireBinding = fireBinding; this.readyAt = now + 700; this.ready = false;
  }
  update(now, held, lastActivationAt = -Infinity) {
    if (this.ready) return true;
    this.readyAt = Math.max(this.readyAt, lastActivationAt + 700);
    const blocked = [...held].some(code => code.startsWith('Mouse') || code === this.fireBinding || ['Enter', 'NumpadEnter', 'Space'].includes(code));
    if (blocked) this.readyAt = now + 700;
    this.ready = !blocked && now >= this.readyAt;
    return this.ready;
  }
}
