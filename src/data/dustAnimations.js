// Frame zero is the beginning of a clip. Gameplay uses seconds, independent of render FPS.
export const DUST_CLIPS = {
  idle: { frames: 60, duration: 2, loop: true },
  move: { frames: 31, duration: 31 / 30, loop: true },
  attack_melee: { frames: 30, duration: 1, loop: false, eventFrame: 14, event: 'contact' },
  attack_special: { frames: 42, duration: 1.4, loop: false, eventFrame: 20, event: 'discharge' },
  summon: { frames: 45, duration: 1.5, loop: false, eventFrame: 24, event: 'call' },
  stunned: { frames: 24, duration: 0.8, loop: true },
  death: { frames: 72, duration: 2.4, loop: false },
};
export const isDust = enemy => enemy.type === 'titan' && (!enemy.guardianId || enemy.guardianId === 'dust');
