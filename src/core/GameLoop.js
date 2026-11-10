import { CONFIG } from '../config.js';
export class GameLoop {
  constructor(update, render) { this.update = update; this.render = render; this.last = null; this.accumulator = 0; }
  frame(time) {
    const dt = this.last === null ? 0 : Math.min((time - this.last) / 1000, 0.1);
    this.last = time;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= CONFIG.step && steps++ < CONFIG.maxSteps) {
      this.update(CONFIG.step); this.accumulator -= CONFIG.step;
    }
    this.render(dt, this.accumulator / CONFIG.step);
  }
}
