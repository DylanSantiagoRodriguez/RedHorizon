import * as THREE from 'three';

// All geometry and materials are owned by Models, so restarting does not leak GPU resources.
export class WeaponModels {
  constructor(models, mount) {
    this.mount = mount; this.variants = {}; this.seenShot = 0;
    const brass = 0xc8944c, copper = 0xa65b3b, steel = 0x27343b, dark = 0x101b22;
    const part = (g, shape, color, pos, scale, glow = false) => models.part(g, shape, color, pos, scale, glow);
    const barrel = (g, color, x, y, z, radius, length) => {
      const mesh = part(g, 'cylinder', color, [x, y, z], [radius, length, radius]); mesh.rotation.x = Math.PI / 2; return mesh;
    };
    const ring = (g, color, x, y, z, radius, glow = false) => part(g, 'torus', color, [x, y, z], [radius, radius, radius], glow);
    for (const [kind, color, muzzle] of [['plasma', 0x66ffdd, 1.05], ['scatter', 0xffd679, 0.88], ['nova', 0xff7841, 1.02]]) {
      const root = new THREE.Group(); root.name = `weapon-${kind}`; mount.add(root);
      part(root, 'box', steel, [0, 0, 0.1], [0.26, 0.25, 0.48]);
      const grip = part(root, 'box', dark, [0, -0.22, 0], [0.13, 0.3, 0.16]); grip.rotation.x = -0.25;
      part(root, 'box', copper, [0, -0.05, -0.28], [0.18, 0.18, 0.35]);
      part(root, 'box', steel, [0, -0.04, -0.47], [0.25, 0.29, 0.1]);
      for (const side of [-1, 1]) {
        part(root, 'box', brass, [side * 0.145, 0, 0.1], [0.035, 0.16, 0.37]);
        for (const z of [-0.02, 0.22]) part(root, 'sphere', dark, [side * 0.168, 0.035, z], [0.022, 0.022, 0.022]);
      }
      const mechanism = new THREE.Group(); root.add(mechanism);
      if (kind === 'plasma') {
        barrel(mechanism, dark, 0, 0.025, 0.62, 0.09, 0.75);
        barrel(mechanism, color, 0, 0.025, 0.62, 0.065, 0.7).material = models.material(color, true);
        for (let i = 0; i < 6; i++) ring(mechanism, copper, 0, 0.025, 0.35 + i * 0.105, 0.125);
        for (const x of [-0.13, 0.13]) part(mechanism, 'box', steel, [x, 0.025, 0.61], [0.045, 0.08, 0.7]);
        barrel(mechanism, brass, 0, 0.025, 0.99, 0.13, 0.12);
        part(root, 'box', dark, [0, 0.19, 0.15], [0.08, 0.12, 0.3]);
        part(root, 'box', color, [0, 0.25, 0.15], [0.04, 0.025, 0.19], true);
      } else if (kind === 'scatter') {
        for (const x of [-0.13, 0.13]) {
          barrel(mechanism, steel, x, 0.015, 0.5, 0.115, 0.75);
          for (const z of [0.25, 0.58, 0.85]) ring(mechanism, brass, x, 0.015, z, 0.12);
          barrel(mechanism, dark, x, 0.015, 0.88, 0.087, 0.015);
          ring(mechanism, color, x, 0.015, 0.89, 0.074, true);
        }
        part(mechanism, 'box', copper, [0, -0.13, 0.5], [0.36, 0.12, 0.23]);
        for (const x of [-0.2, 0.2]) {
          part(root, 'cylinder', brass, [x, -0.16, 0.1], [0.09, 0.32, 0.09]);
          part(root, 'sphere', color, [x, 0.03, 0.1], [0.06, 0.04, 0.06], true);
        }
        const dial = barrel(root, brass, 0, 0.22, 0.15, 0.1, 0.06);
        part(dial, 'box', dark, [0, 0.6, 0], [0.1, 0.1, 1.2]);
      } else {
        barrel(root, steel, 0, 0.04, 0.22, 0.29, 0.16);
        barrel(root, color, 0, 0.04, 0.5, 0.22, 0.6).material = models.material(color, true);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          part(mechanism, 'box', copper, [Math.cos(a) * 0.27, 0.04 + Math.sin(a) * 0.27, 0.5], [0.065, 0.065, 0.66]);
        }
        for (const z of [0.2, 0.78, 0.98]) ring(root, brass, 0, 0.04, z, 0.285);
        barrel(root, dark, 0, 0.04, 0.96, 0.245, 0.09);
        part(root, 'sphere', color, [0, 0.04, 1.01], [0.13, 0.13, 0.035], true);
      }
      const flash = new THREE.Group(); flash.position.set(0, 0.025, muzzle + 0.04); root.add(flash);
      part(flash, 'sphere', color, [0, 0, 0.12], [kind === 'scatter' ? 0.3 : 0.13, 0.13, kind === 'plasma' ? 0.5 : 0.25], true);
      const wave = ring(flash, color, 0, 0, 0.1, kind === 'nova' ? 0.4 : 0.18, true);
      flash.visible = false; root.visible = kind === 'plasma';
      this.variants[kind] = { root, mechanism, flash, wave, color };
    }
    this.muzzle = new THREE.Vector3(); this.direction = new THREE.Vector3();
  }
  update(run, emitParticles, avatar) {
    const w = run.weapon, aim = w.aim;
    this.mount.position.set(0.48, run.player.slideTime > 0 ? 0.65 : 1.21, 0.3 - w.recoil * 0.12);
    if (aim) this.mount.rotation.set(-Math.asin(THREE.MathUtils.clamp(aim.y, -1, 1)), Math.atan2(aim.x, aim.z) - run.player.yaw, 0, 'YXZ');
    avatar?.attachWeapon(this.mount, run);
    for (const [kind, v] of Object.entries(this.variants)) {
      v.root.visible = kind === w.equipped;
      const age = run.time - (w.lastShot?.time ?? -100);
      const firing = w.lastShot?.kind === kind && age >= 0 && age < (kind === 'nova' ? 0.19 : 0.1);
      v.flash.visible = firing;
      v.flash.scale.setScalar(Math.max(0.05, 1 - age * 4));
      v.wave.position.z = 0.1 + age * 2;
      v.mechanism.position.z = -w.recoil * (kind === 'scatter' ? 0.15 : 0.05);
      if (kind === 'nova') v.mechanism.rotation.z = run.time * 0.6 + w.recoil * 0.4;
    }
    if (w.shotId !== this.seenShot) {
      this.seenShot = w.shotId;
      if (!w.lastShot || run.time - w.lastShot.time > .2) return;
      const v = this.variants[w.lastShot.kind];
      this.mount.updateWorldMatrix(true, true); v.flash.getWorldPosition(this.muzzle); v.flash.getWorldDirection(this.direction);
      emitParticles?.({ ...this.muzzle, direction: this.direction, kind: w.lastShot.kind, color: v.color });
    }
  }
}
