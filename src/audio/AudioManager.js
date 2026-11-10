export class AudioManager {
  constructor() { this.context = null; this.volume = 0.35; this.active = false; this.boss = false; this.beat = 0; this.last = {}; }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.volume; this.master.connect(this.context.destination);
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate), data = buffer.getChannelData(0);
      let value = 0; for (let i = 0; i < data.length; i++) { value = (value + (Math.random() * 2 - 1) * 0.02) / 1.02; data[i] = value * 3; }
      this.wind = this.context.createBufferSource(); this.wind.buffer = buffer; this.wind.loop = true;
      this.windGain = this.context.createGain(); this.windGain.gain.value = 0; this.wind.connect(this.windGain); this.windGain.connect(this.master); this.wind.start();
    }
    if (this.context.state !== 'running') await this.context.resume();
  }
  setVolume(value) { this.volume = value; if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.1); }
  tone(frequency, end, duration, type = 'sine', gain = 0.12, delay = 0) {
    if (!this.context || this.context.state !== 'running' || this.volume === 0) return;
    const t = this.context.currentTime + delay, osc = this.context.createOscillator(), amp = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(gain, t + 0.005); amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp); amp.connect(this.master); osc.start(t); osc.stop(t + duration + 0.02); osc.onended = () => { osc.disconnect(); amp.disconnect(); };
  }
  play(type, data = {}) {
    const now = this.context?.currentTime || 0;
    if (now - (this.last[type] ?? -10) < (type === 'hit' ? 0.08 : 0.035)) return; this.last[type] = now;
    if (type === 'shot') this.tone(data.kind === 'nova' ? 120 : 650, 65, data.kind === 'nova' ? 0.28 : 0.09, 'sawtooth', 0.055);
    if (type === 'hit') this.tone(200, 80, 0.045, 'triangle', 0.1);
    if (type === 'death') this.tone(120, 35, 0.18, 'sawtooth', 0.05);
    if (type === 'hurt') this.tone(95, 38, 0.3, 'square', 0.075);
    if (type === 'explosion' || type === 'ability') this.tone(90, 22, 0.65, 'sawtooth', 0.13);
    if (['level', 'upgrade', 'relay', 'victory'].includes(type)) for (const [i, f] of [440, 554, 660, 880].entries()) this.tone(f, f, 0.25, 'sine', 0.09, i * 0.08);
    if (type === 'boss' || type === 'phase') { this.boss = true; this.tone(60, 30, 1.5, 'sawtooth', 0.1); }
  }
  update(dt, active) {
    if (!this.context) return;
    if (this.active !== active) { this.active = active; this.windGain.gain.setTargetAtTime(active ? 0.16 : 0, this.context.currentTime, 0.3); }
    if (this.boss && active) { this.beat -= dt; if (this.beat <= 0) { this.beat = 0.55; this.tone(55, 28, 0.22, 'sine', 0.12); } }
  }
  dispose() { this.wind?.stop(); this.context?.close(); }
}
