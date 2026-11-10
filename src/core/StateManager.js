const transitions = {
  menu: ['playing'], playing: ['paused', 'upgrade', 'defeat', 'victory', 'menu'],
  paused: ['playing', 'menu'], upgrade: ['playing', 'menu'], defeat: ['playing', 'menu'], victory: ['playing', 'menu'],
};
export class StateManager {
  constructor() { this.value = 'menu'; }
  set(next) {
    if (!transitions[this.value]?.includes(next)) return false;
    this.value = next;
    return true;
  }
}
