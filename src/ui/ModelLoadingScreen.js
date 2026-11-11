export class ModelLoadingScreen {
  constructor(container) {
    this.element = document.createElement('div');
    this.element.className = 'model-loading';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.textContent = 'Preparando la expedición…';
    container.appendChild(this.element);
  }
  wait(promises) {
    const generation = this.generation = (this.generation || 0) + 1;
    this.pending = true; this.ready = false; this.element.hidden = false;
    // Each model loader reports failures and retains its emergency fallback.
    this.promise = Promise.allSettled(promises).then(() => {
      if (generation === this.generation) this.ready = true;
    });
  }
  reveal() {
    if (!this.ready) return;
    this.pending = false; this.element.hidden = true;
  }
  dispose() { this.generation++; this.element.remove(); }
}
