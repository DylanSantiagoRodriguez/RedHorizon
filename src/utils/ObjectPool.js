export class ObjectPool {
  constructor(capacity, create) { this.items = Array.from({ length: capacity }, () => ({ ...create(), active: false })); }
  acquire() { const item = this.items.find(p => !p.active); if (item) item.active = true; return item; }
  clear() { for (const item of this.items) item.active = false; }
}
