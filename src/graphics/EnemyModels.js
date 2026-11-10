import * as THREE from 'three';
import { guardianFor } from '../data/guardians.js';

const iron = 0x243039, black = 0x101a20, copper = 0xa96540, brass = 0xd5ad6e, ivory = 0xb8b6a2;

// Bake the armor into two shared buffers; only the small energy mechanisms animate.
export function buildEnemyArmor(models, data) {
  const g = new THREE.Group();
  const boss = data.type === 'titan', profile = guardianFor(data);
  const glow = boss ? profile.color : ({ drone: 0x67dfea, spitter: 0x73df94, elite: 0xbf8cff }[data.type] || 0xff8661);
  const part = (type, color, pos, scale, light = false) => models.part(g, type, color, pos, scale, light);
  const box = (color, pos, scale) => part('box', color, pos, scale);
  const ring = (pos, r, color = brass) => part('torus', color, pos, [r, r, r]);
  const pipe = (pos, r, length, color = copper, forward = false) => {
    const p = part('cylinder', color, pos, [r, length, r]); if (forward) p.rotation.x = Math.PI / 2; return p;
  };
  const core = (pos, r) => {
    part('sphere', glow, pos, [r, r, r * 0.35], true); ring([pos[0], pos[1], pos[2] + 0.04], r * 1.15);
  };
  const boiler = (x, y, z, r, h) => {
    pipe([x, y, z], r, h, copper);
    for (const dy of [-h * 0.38, h * 0.38]) { const rim = ring([x, y + dy, z], r, brass); rim.rotation.x = Math.PI / 2; }
    box(glow, [x, y, z + r], [r * 0.45, h * 0.6, 0.025]).material = models.material(glow, true);
    pipe([x, y + h * 0.6, z], r * 0.35, h * 0.3, black);
  };
  const legs = (pairs, spread, bottom) => {
    for (const side of [-1, 1]) for (let i = 0; i < pairs; i++) {
      const z = (i - (pairs - 1) / 2) * 0.62;
      const thigh = box(iron, [side * spread * 0.7, -0.32, z], [spread, 0.17, 0.2]); thigh.rotation.z = side * 0.45;
      part('sphere', brass, [side * spread, -0.45, z], [0.14, 0.14, 0.14]);
      const shin = pipe([side * spread * 1.1, (bottom - 0.45) / 2, z], 0.065, Math.abs(bottom + 0.45), copper); shin.rotation.z = side * -0.18;
      box(black, [side * spread * 1.18, bottom, z + 0.08], [0.22, 0.15, 0.35]);
    }
  };
  const biped = () => {
    box(iron, [0, 0.15, 0], [1.4, 1.35, 0.95]);
    for (const s of [-1, 1]) {
      box(copper, [s * 0.5, 0.5, 0.53], [0.28, 0.65, 0.13]);
      box(iron, [s * 0.46, -0.95, 0], [0.45, 1, 0.5]);
      pipe([s * 0.7, -0.9, 0], 0.07, 0.8, brass);
      box(black, [s * 0.46, -1.48, 0.15], [0.62, 0.23, 0.8]);
      part('sphere', brass, [s * 0.46, -0.75, 0.3], [0.17, 0.17, 0.08]);
      box(copper, [s * 1, 0.63, 0], [0.6, 0.5, 0.8]);
      pipe([s * 1.03, 0, 0], 0.13, 0.85, ivory);
    }
    box(black, [0, 1.02, 0.05], [0.6, 0.42, 0.55]);
    box(glow, [0, 1.05, 0.34], [0.43, 0.065, 0.025]).material = models.material(glow, true);
  };

  if (boss && profile.id === 'sapphire') {
    part('sphere', iron, [0, 0, 0], [0.65, 0.8, 0.65]); core([0, 0.1, 0.67], 0.43);
    for (const s of [-1, 1]) {
      box(copper, [s * 0.92, 0.2, 0], [0.2, 1.8, 0.28]);
      part('sphere', glow, [s * 0.92, 1.2, 0], [0.18, 0.18, 0.18], true);
      for (let i = 0; i < 5; i++) pipe([s * 0.92, 0.25 + i * 0.17, 0], 0.28, 0.06, brass);
      box(iron, [s * 0.82, -0.9, 0], [0.22, 1.2, 0.35]).rotation.z = s * -0.3;
      box(brass, [s * 0.65, -1.5, 0.12], [0.45, 0.15, 0.6]);
    }
    pipe([0, -1.1, -0.45], 0.12, 0.9, copper);
    ring([0, 0.1, 0], 1.05, copper);
  } else if (boss && profile.id === 'emerald') {
    box(iron, [0, -0.15, 0], [1.5, 0.65, 1.4]); legs(3, 1.15, -1.55);
    for (const x of [-0.5, 0, 0.5]) boiler(x, 0.65, -0.2, 0.22, x === 0 ? 1.5 : 1.1);
    core([0, 0, 0.76], 0.32);
    for (const s of [-1, 1]) { pipe([s * 0.45, 0.25, 0.95], 0.17, 0.7, brass, true); ring([s * 0.45, 0.25, 1.32], 0.17, copper); }
  } else if (boss && profile.id === 'amethyst') {
    const crystal = part('rock', glow, [0, 0.3, 0], [0.45, 1.1, 0.45], true); crystal.rotation.z = 0.15;
    for (const s of [-1, 1]) {
      box(iron, [s * 0.65, 0.15, 0], [0.23, 1.9, 0.4]).rotation.z = s * -0.2;
      part('cone', brass, [s * 0.82, 1.45, 0], [0.2, 0.8, 0.2]);
      box(copper, [s * 0.45, -0.85, 0], [0.4, 0.2, 0.65]);
    }
    const crown = ring([0, 1.05, 0], 0.6); crown.rotation.x = Math.PI / 2;
    part('cone', iron, [0, -1, 0], [0.5, 0.8, 0.5]).rotation.z = Math.PI;
    pipe([0, -1.5, 0], 0.3, 0.1, glow);
  } else if (boss || data.type === 'brute') {
    biped(); core([0, 0.15, 0.56], boss ? 0.38 : 0.27);
    if (boss && profile.id === 'dust') {
      for (const s of [-1, 1]) {
        box(iron, [s * 1.1, -0.35, 0.2], [0.65, 0.8, 0.85]);
        part('cone', brass, [s * 1.1, -0.35, 0.88], [0.32, 0.85, 0.32]).rotation.x = Math.PI / 2;
        for (const z of [0.56, 0.7, 0.85]) ring([s * 1.1, -0.35, z], 0.3 - (z - 0.56) * 0.5, copper);
      }
      ring([0, 0.7, -0.65], 0.9, brass);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; box(copper, [Math.cos(a) * 0.95, 0.7 + Math.sin(a) * 0.95, -0.65], [0.22, 0.22, 0.18]).rotation.z = a; }
      box(brass, [0, 1.4, 0], [0.85, 0.15, 0.6]);
    } else {
      for (const s of [-1, 1]) {
        boiler(s * 0.55, 0.85, -0.58, 0.22, 1.2);
        box(black, [s * 1.07, -0.45, 0.15], [0.62, 0.6, 0.7]);
        for (let i = 0; i < 3; i++) box(brass, [s * 1.07 + (i - 1) * 0.16, -0.4, 0.52], [0.08, 0.4, 0.08]);
      }
      if (boss) for (let i = 0; i < 5; i++) box(iron, [(i - 2) * 0.13, 0.15, 0.73], [0.05, 0.65, 0.1]);
    }
  } else if (data.type === 'drone') {
    part('sphere', iron, [0, 0, 0], [0.48, 0.3, 0.6]); core([0, 0, 0.56], 0.16);
    for (const s of [-1, 1]) {
      box(copper, [s * 0.55, 0, 0], [0.6, 0.13, 0.2]);
      const fan = ring([s * 0.85, 0, 0], 0.38); fan.rotation.x = Math.PI / 2;
      pipe([s * 0.85, -0.06, 0], 0.13, 0.2, glow);
      for (const a of [0, Math.PI / 2]) box(iron, [s * 0.85, 0, 0], [0.65, 0.04, 0.09]).rotation.y = a;
    }
    pipe([0, -0.22, 0.3], 0.09, 0.6, brass, true);
  } else {
    box(iron, [0, 0, 0], [0.85, 0.45, 1.15]); legs(3, 0.65, data.type === 'stalker' ? -0.62 : -0.82);
    box(copper, [0, 0.12, 0.6], [0.6, 0.28, 0.28]);
    for (const s of [-1, 1]) core([s * 0.2, 0.18, 0.77], 0.07);
    if (data.type === 'spitter') {
      for (const x of [-0.24, 0.24]) boiler(x, 0.4, -0.25, 0.17, 0.6);
      pipe([0, 0.05, 0.9], 0.15, 0.4, brass, true);
    } else if (data.type === 'elite') {
      for (const s of [-1, 1]) {
        const blade = part('cone', glow, [s * 0.65, 0.3, 0.65], [0.12, 1.3, 0.18], true); blade.rotation.x = Math.PI / 3;
        ring([s * 0.5, 0.35, -0.15], 0.22, copper);
      }
      box(brass, [0, 0.3, 0], [0.14, 0.15, 0.9]);
    } else for (let i = 0; i < 4; i++) box(brass, [0, 0.27, -0.4 + i * 0.22], [0.65, 0.08, 0.08]);
  }
  if (boss) g.scale.setScalar(2.15);
  return g;
}

export function addGuardianEffects(models, group, enemy) {
  const profile = guardianFor(enemy), fx = new THREE.Group(); fx.name = 'guardian-effects'; group.add(fx);
  const count = profile.id === 'ruby' ? 2 : profile.id === 'dust' ? 1 : 3;
  for (let i = 0; i < count; i++) {
    const rotor = new THREE.Group(); rotor.name = 'guardian-rotor'; rotor.userData.index = i; fx.add(rotor);
    const radius = profile.id === 'sapphire' ? 2.35 : profile.id === 'amethyst' ? 1.9 : profile.id === 'dust' ? 1 : 0.35;
    const ring = models.part(rotor, 'torus', profile.color, [0, 0, 0], [radius, radius, radius], true);
    if (profile.id === 'ruby') rotor.position.set((i ? 1 : -1) * 1.18, 3, -1.25);
    if (profile.id === 'emerald') rotor.position.set((i - 1) * 1.07, 2.6, -0.43);
    if (profile.id === 'dust') rotor.position.set(0, 0.32, 1.3);
    if (profile.id === 'amethyst') {
      ring.visible = false;
      models.part(rotor, 'rock', profile.color, [radius, 0, 0], [0.16, 0.55, 0.16], true);
      models.part(rotor, 'torus', brass, [radius, 0, 0], [0.25, 0.25, 0.25]);
    }
  }
}

export function animateGuardian(mesh, enemy, time) {
  const fx = mesh.getObjectByName('guardian-effects'); if (!fx) return;
  const profile = guardianFor(enemy), age = time - (enemy.lastAbilityAt ?? -100);
  const pulse = age >= 0 && age < 0.7 ? 1 + Math.sin(age / 0.7 * Math.PI) * 0.7 : 1;
  const speed = enemy.phase === 2 ? 2 : 1;
  for (const rotor of fx.children) {
    const i = rotor.userData.index;
    rotor.scale.setScalar(pulse);
    if (profile.id === 'sapphire') rotor.rotation.set(time * 0.4 * speed + i, time * 0.7 * speed + i * Math.PI / 3, i);
    else if (profile.id === 'amethyst') rotor.rotation.set(i * 0.7, time * speed + i * Math.PI * 2 / 3, 0.3);
    else if (profile.id === 'dust') rotor.rotation.z = -time * speed;
    else { rotor.rotation.x = Math.PI / 2; rotor.position.y = (profile.id === 'ruby' ? 3 : 2.6) + ((time * speed + i * 0.3) % 1) * 0.5; }
  }
}
