// Starts leave a short pause after each cut. The three shots end at 5, 15 and 24 s.
export const NARRATION_CUES = [
  { file: 'cinematic_phrase_1.mp3', start: .55, enabled: true },
  { file: 'cinematic_phrase_2.mp3', start: 5.5, enabled: true },
  { file: 'cinematic_phrase_3.mp3', start: 15.5, enabled: true },
];

export class CinematicNarration {
  constructor(context, output) {
    this.context = context; this.buffers = []; this.index = -1;
    this.gain = context.createGain(); this.gain.gain.value = 1; this.gain.connect(output);
    this.ready = Promise.all(NARRATION_CUES.map(async (cue, index) => {
      if (!cue.enabled) return;
      try {
        const response = await fetch(import.meta.env.BASE_URL + 'audio/cinematic/' + cue.file);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers[index] = buffer;
      } catch (error) { if (!this.disposed) console.warn('No se pudo cargar la voz ' + cue.file, error); }
    }));
  }
  sync(mission, playing) {
    if (this.disposed) return;
    if (!playing || mission?.phase !== 'cinematic' || this.context.state !== 'running') { this.stop(); return; }
    const time = mission.cinematic;
    const index = NARRATION_CUES.findIndex((cue, i) => cue.enabled && this.buffers[i] && time >= cue.start && time < cue.start + this.buffers[i].duration);
    if (index < 0) { this.stop(); return; }
    const offset = time - NARRATION_CUES[index].start;
    if (this.index === index && (!this.source || Math.abs(this.context.currentTime - this.startedAt + this.offset - offset) < .25)) return;
    this.stop(); this.index = index; this.offset = offset; this.startedAt = this.context.currentTime;
    const source = this.context.createBufferSource(); source.buffer = this.buffers[index]; source.connect(this.gain);
    this.source = source;
    source.onended = () => { source.disconnect(); if (this.source === source) this.source = null; };
    source.start(0, offset);
  }
  stop() {
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = null; }
    this.index = -1;
  }
  dispose() { this.disposed = true; this.stop(); this.gain.disconnect(); this.buffers = []; }
}
