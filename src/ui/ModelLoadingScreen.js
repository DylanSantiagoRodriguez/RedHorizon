export class ModelLoadingScreen {
  constructor(container) {
    this.element = document.createElement('div');
    this.element.className = 'model-loading';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.textContent = 'Preparando la expedición…';
    container.appendChild(this.element);
  }
  wait(promises, required = []) {
    const generation = this.generation = (this.generation || 0) + 1;
    this.pending = true; this.ready = false; this.element.hidden = false;
    // Required combat models must succeed: never reveal an invisible boss.
    this.element.textContent = 'Preparando la expedición y los cinco guardianes…';
    this.promise = Promise.all([Promise.allSettled(promises), Promise.all(required)]).then(() => {
      if (generation === this.generation) this.ready = true;
    }).catch(() => {
      if (generation !== this.generation) return;
      this.element.textContent = 'No se pudieron cargar los guardianes. Comprueba tu conexión. ';
      const retry = document.createElement('button'); retry.textContent = 'Reintentar';
      retry.onclick = () => window.location.reload(); this.element.appendChild(retry);
    });
  }
  reveal() {
    if (!this.ready) return;
    this.pending = false; this.element.hidden = true;
  }
  dispose() { this.generation++; this.element.remove(); }
}
