export const ENEMIES = {
  stalker: { name: 'Stalker', hp: 35, speed: 4.4, damage: 10, radius: 0.65, height: 0.7, range: 1.8, cooldown: 1.1, xp: 8, color: 0x573647, behavior: 'melee', model: 'crawler' },
  brute: { name: 'Brute', hp: 180, speed: 2.2, damage: 24, radius: 1.25, height: 1.5, range: 2.5, cooldown: 1.7, xp: 25, color: 0x71554b, behavior: 'melee', model: 'brute' },
  drone: { name: 'Drone', hp: 55, speed: 3.6, damage: 12, radius: 0.7, height: 3.2, range: 19, cooldown: 2.6, xp: 14, color: 0x536a70, behavior: 'ranged', model: 'drone' },
  spitter: { name: 'Spitter', hp: 65, speed: 2.8, damage: 16, radius: 0.85, height: 0.9, range: 16, cooldown: 3.1, xp: 16, color: 0x536746, behavior: 'ranged', model: 'crawler' },
  elite: { name: 'ELTE · Sobrecarga', hp: 220, speed: 5.3, damage: 21, radius: 0.9, height: 1, range: 2.2, cooldown: 0.9, xp: 40, color: 0x8d5da8, behavior: 'melee', model: 'crawler', modifier: 'haste' },
  titan: { name: 'THE TITAN OF DUST', hp: 4200, speed: 2.4, damage: 36, radius: 3, height: 3.5, range: 5.1, cooldown: 2.2, xp: 0, color: 0x454d50, behavior: 'boss', model: 'titan' },
};
