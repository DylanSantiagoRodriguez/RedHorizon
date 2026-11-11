const FILES = ['instrumental_music', 'spaceship_fire', 'spaceship_aurora', 'altar_boss', 'beacon_launch'];

// All tracks use the simulation clock so pause, frame stalls and new runs stay synchronized.
export class SceneAudio {
  constructor(context, output) {
    this.context = context; this.output = output; this.buffers = {}; this.tracks = new Map(); this.serial = 0;
    this.ready = Promise.all(FILES.map(async name => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + 'audio/effects/' + name + '.mp3');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!this.disposed) this.buffers[name] = buffer;
      } catch (error) { if (!this.disposed) console.warn('No se pudo cargar el sonido ' + name, error); }
    }));
  }
  track(id, name, loop, level, start = 0) {
    if (this.tracks.has(id)) return this.tracks.get(id);
    const gain = this.context.createGain(), pan = this.context.createStereoPanner();
    gain.gain.value = 0; gain.connect(pan); pan.connect(this.output);
    const track = { id, name, loop, level, start, gain, pan, source: null };
    this.tracks.set(id, track); return track;
  }
  trigger(name, clock) {
    if (this.disposed) return;
    // Bound overlapping one-shot resources even when several altars activate together.
    const shots = [...this.tracks.values()].filter(t => !t.loop);
    if (shots.length >= 4) this.remove(shots[0]);
    this.track('event-' + this.serial++, name, false, name === 'beacon_launch' ? .55 : .45, clock);
  }
  stop(track) {
    if (!track.source) return;
    track.source.onended = null; track.source.stop(); track.source.disconnect(); track.source = null;
  }
  remove(track) { this.stop(track); track.gain.disconnect(); track.pan.disconnect(); this.tracks.delete(track.id); }
  sync(track, time, level, pan = 0) {
    const buffer = this.buffers[track.name];
    if (!buffer || time < 0 || level <= 0) { this.stop(track); return; }
    if (!track.loop && time >= buffer.duration) { this.remove(track); return; }
    const offset = track.loop ? time % buffer.duration : time;
    track.gain.gain.setTargetAtTime(level, this.context.currentTime, .12);
    track.pan.pan.setTargetAtTime(pan, this.context.currentTime, .1);
    if (track.source && Math.abs(this.context.currentTime - track.startedAt + track.clockOffset - time) < .3) return;
    this.stop(track);
    const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = track.loop;
    source.connect(track.gain); track.source = source; track.startedAt = this.context.currentTime; track.clockOffset = time;
    source.onended = () => {
      source.disconnect();
      if (track.source === source) {
        track.source = null;
        if (!track.loop) this.remove(track);
      }
    };
    source.start(0, offset);
  }
  update(active, run, yaw = 0, voice = false) {
    if (this.disposed) return;
    if (!active || !run || this.context.state !== 'running') { this.pause(); return; }
    const cinema = run.mission.phase === 'cinematic', time = run.time + (cinema ? run.mission.cinematic : 0);
    const music = this.track('music', 'instrumental_music', true, .12);
    this.sync(music, time, voice ? .025 : cinema ? .055 : .12);
    const aurora = this.track('aurora', 'spaceship_aurora', true, .18);
    this.sync(aurora, run.mission.cinematic - 15, cinema && run.mission.cinematic >= 15 ? (voice ? .055 : .18) : 0);
    const fire = this.track('fire', 'spaceship_fire', true, .35), wreck = run.world.wreck;
    let fireLevel = 0, pan = 0;
    if (wreck && !cinema) {
      const dx = wreck.root.position.x - run.player.x, dz = wreck.root.position.z - run.player.z;
      const distance = Math.hypot(dx, dz);
      fireLevel = .35 * Math.max(0, 1 - distance / 32) ** 2;
      pan = distance > .01 ? (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / distance * .8 : 0;
    }
    this.sync(fire, run.time, fireLevel, pan);
    for (const track of [...this.tracks.values()]) if (!track.loop) {
      if (cinema) this.remove(track);
      else this.sync(track, time - track.start, track.level);
    }
  }
  pause() { for (const track of this.tracks.values()) this.stop(track); }
  reset() { for (const track of [...this.tracks.values()]) this.remove(track); }
  dispose() { this.disposed = true; this.reset(); this.buffers = {}; }
}
