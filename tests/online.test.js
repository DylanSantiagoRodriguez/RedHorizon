import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RoomManager } from '../server/RoomManager.js';
import { WorldModel } from '../src/world/WorldModel.js';
import { WorldManager } from '../src/world/WorldManager.js';
import { Models } from '../src/graphics/Models.js';
import { Run } from '../src/core/Run.js';
import { CoopRun } from '../src/core/CoopRun.js';
import { inputAdapter, validateMessage, normalizeCode } from '../src/network/protocol.js';
import { snapshot } from '../src/network/snapshot.js';
import { CONFIG } from '../src/config.js';
const socket = () => ({ messages: [], send(m) { this.messages.push(JSON.parse(m)); }, close() { this.closed = true; } });
const input = (seq, extra = {}) => ({ type: 'input', seq, held: [], actions: [], yaw: 0, aim: { x: 0, y: 0, z: -1 }, enabled: true, ...extra });
function setup(options) {
  let now = 1000; const manager = new RoomManager({ ...options, now: () => now });
  const a = manager.create(socket(), 'Uno'), b = manager.join(a.room.code, socket(), 'Dos');
  const start = () => { manager.ready(a.room, a.member, true); manager.ready(a.room, b.member, true); manager.start(a.room, a.member); return a.room.run; };
  return { manager, a, b, start, advance: ms => { now += ms; manager.step(1 / 60); } };
}
const run = () => { const r = new CoopRun(new WorldModel('test-online'), 'test', ['a', 'b'], () => {}); r.director.timer = 1e6; return r; };

describe('salas e identidad efímera', () => {
  it('crea códigos, normaliza, limita capacidad y aísla salas', () => {
    const { manager, a } = setup(); expect(a.room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/); expect(normalizeCode(' ab c234 ')).toBe('ABC234');
    manager.join(a.room.code.toLowerCase(), socket()); manager.join(a.room.code, socket()); expect(() => manager.join(a.room.code, socket())).toThrow('FULL');
    const other = manager.create(socket()); expect(other.room.members.size).toBe(1); expect(other.room.code).not.toBe(a.room.code);
    expect(() => manager.find('1')).toThrow('INVALID_CODE'); expect(() => manager.find('AAAAAA')).toThrow('NOT_FOUND');
  });
  it('resuelve colisiones del código', () => { const { manager, a } = setup(); const original = manager.rooms.has.bind(manager.rooms); let calls = 0; manager.rooms.has = c => ++calls <= 2 || original(c); const b = manager.create(socket()); expect(calls).toBeGreaterThanOrEqual(3); expect(b.room.code).not.toBe(a.room.code); });
  it('solo el creador inicia con todos listos y bloquea nuevos miembros', () => {
    const { manager, a, b, start } = setup(); expect(() => manager.start(a.room, b.member)).toThrow('PERMISSION'); expect(() => manager.start(a.room, a.member)).toThrow('PERMISSION');
    start(); expect(() => manager.join(a.room.code, socket())).toThrow('STARTED');
  });
  it('transfiere administración al desconectar y conserva simulación', () => {
    const { manager, a, b, start, advance } = setup(); const r = start(); manager.disconnect(a.room, a.member); expect(a.room.hostId).toBe(b.member.id); advance(20); expect(r.time).toBeGreaterThan(0);
  });
  it('reconecta con token secreto sin duplicar ni permitir control doble', () => {
    const { manager, a, start } = setup(); const r = start(); const p = r.playerById(a.member.id); p.hp = 42;
    expect(() => manager.reconnect(a.room.code, a.member.token, socket())).toThrow('ACTIVE'); manager.disconnect(a.room, a.member);
    expect(() => manager.reconnect(a.room.code, 'bad', socket())).toThrow('TOKEN'); const recovered = manager.reconnect(a.room.code, a.member.token, socket());
    expect(recovered.member.id).toBe(a.member.id); expect(r.members.size).toBe(2); expect(r.playerById(a.member.id).hp).toBe(42);
    expect(JSON.stringify(snapshot(a.room, 1000))).not.toContain(a.member.token); expect(JSON.stringify(manager.lobby(a.room))).not.toContain(a.member.token);
  });
  it('expira a los 30 segundos y elimina salas vacías', () => {
    const { manager, a, b, advance } = setup(); const token = a.member.token; manager.disconnect(a.room, a.member); advance(30000); expect(() => manager.reconnect(a.room.code, token, socket())).toThrow('TOKEN');
    manager.disconnect(a.room, b.member, true); expect(manager.rooms.size).toBe(0);
  });
  it('desconectados siguen vulnerables, sin autofire; abandono no reduce escalado', () => {
    const { manager, a, start, advance } = setup(); const r = start(), p = r.playerById(a.member.id); r.members.get(a.member.id).autoFire = true;
    const e = r.spawn('stalker', 5, 5); const hp = e.hp; manager.disconnect(a.room, a.member);
    r.withPlayer(p.id, () => r.hurtPlayer(12)); expect(p.hp).toBeLessThan(120); expect(r.members.get(p.id).autoFire).toBe(false); advance(30000);
    expect(p.dead).toBe(true); expect(e.hp).toBe(hp); expect(r.spawn('stalker', 7, 7).hp).toBe(hp);
  });
  it('limita salas y limpia sockets al cerrar', () => { const { manager, a } = setup({ maxRooms: 1 }); expect(() => manager.create(socket())).toThrow('LIMIT'); const s = a.member.socket; manager.close(); expect(manager.rooms.size).toBe(0); expect(s.closed).toBe(true); });
});
describe('protocolo e inputs', () => {
  it('rechaza posiciones, tipos, valores no finitos y acciones desconocidas', () => {
    expect(validateMessage(input(1))).toBe(true);
    for (const value of [null, [], { type: 'admin' }, input(1, { x: 5 }), input(1, { yaw: NaN }), input(1, { aim: { x: 9, y: 0, z: 0 } }), input(1, { held: ['KeyZ'] }), input(-1), input(1, { actions: ['KeyQ', 'KeyQ'] })]) expect(validateMessage(value)).toBeFalsy();
  });
  it('no avanza por mensajes, procesa una entrada por tick e ignora duplicados', () => {
    const { manager, a, start, advance } = setup(); const r = start(); const m = input(1, { actions: ['KeyF'], held: ['KeyW'] });
    manager.input(a.room, a.member, m); manager.input(a.room, a.member, m); expect(r.time).toBe(0); advance(16); expect(a.member.ack).toBe(1); expect(r.members.get(a.member.id).autoFire).toBe(true);
    manager.input(a.room, a.member, m); advance(16); expect(r.members.get(a.member.id).autoFire).toBe(true); expect(a.member.queue).toHaveLength(0);
    advance(300); expect(r.members.get(a.member.id).autoFire).toBe(false); expect(() => manager.input(a.room, a.member, input(1000))).toThrow('LIMIT');
  });
  it('una acción puntual se consume una sola vez', () => { const a = inputAdapter(input(1, { actions: ['KeyQ'] })); expect(a.take('KeyQ')).toBe(true); expect(a.take('KeyQ')).toBe(false); });
  it('respeta colisiones y velocidad compartidas', () => { const r = run(), p = r.playerById('a'); r.world.obstacles = [{ x: 0, z: -3, radius: 1 }]; for (let i = 0; i < 120; i++) r.update(1 / 60, new Map([['a', { input: inputAdapter(input(i + 1, { held: ['KeyW'] })), yaw: 0, aim: { x: 0, y: 0, z: -1 } }]])); expect(p.z).toBeGreaterThan(-1.5); expect(r.playerById('b').z).toBe(0); });
});
describe('simulación compartida', () => {
  it('los altares usan el mismo fallback durante la construcción, antes de crear miembros', () => {
    const world = { heightAt: () => 0, obstacles: [{ x: 0, z: 0, radius: 200 }], beacons: [], rewards: [] };
    expect(new CoopRun(world, 'blocked-altar', ['a', 'b'], () => {}).altars).toEqual(new Run(world, 'blocked-altar').altars);
  });
  it('el mundo visual consume exactamente los datos físicos de Node', () => {
    const models = new Models(), scene = new THREE.Scene(), visual = new WorldManager(scene, models, 'matching'), data = new WorldModel('matching');
    expect(visual.obstacles).toEqual(data.obstacles); expect(visual.rewards.map(({ id, x, z, used }) => ({ id, x, z, used }))).toEqual(data.rewards);
    expect(visual.beacons.map(({ id, x, z }) => ({ id, x, z }))).toEqual(data.beacons.map(({ id, x, z }) => ({ id, x, z })));
    for (let x = -100; x < 100; x += 11) expect(visual.heightAt(x, x / 3)).toBe(data.heightAt(x, x / 3)); visual.dispose(); models.dispose();
  });
  it('daño, robo de vida, explosiones y proyectiles pertenecen al atacante', () => {
    const r = run(), a = r.playerById('a'), b = r.playerById('b'); a.hp = b.hp = 50; a.stats.crit = b.stats.crit = 0; b.stats.damage = 2; b.stats.lifesteal = .5;
    const e = r.spawn('brute', 0, -2); const hp = e.hp;
    r.withPlayer('b', () => r.combat.spawn({ friendly: true, x: e.x, y: e.y, z: e.z + .1, vx: 0, vy: 0, vz: -1, life: 1, damage: 10 }));
    r.combat.update(1 / 60); expect(e.hp).toBe(hp - 20); expect(b.hp).toBe(60); expect(a.hp).toBe(50);
    const pool = r.combat.pool.items.find(p => p.ownerId === 'b'); expect(pool.ownerId).toBe('b');
    r.withPlayer('b', () => r.ability.activate(r)); expect(a.hp).toBe(50);
  });
  it('XP se concede una sola vez, sin fuego amigo', () => { const r = run(), e = r.spawn('stalker', 0, -1), p = r.playerById('b'); r.combat.hit(e, 99999); const xp = r.experience.xp; r.onKill(e); expect(r.experience.xp).toBe(xp); r.combat.explode(p.x, p.y, p.z, 10, 99999); expect(p.hp).toBe(120); });
  it('interacciones simultáneas curan solo al recolector y se aplican una vez', () => {
    const r = run(), target = r.world.rewards[0]; const actions = new Map();
    for (const [id, m] of r.members) { Object.assign(m.player, { x: target.x, z: target.z, hp: 50 }); actions.set(id, { input: inputAdapter(input(1, { actions: ['KeyE'] })), yaw: 0 }); }
    r.update(1 / 60, actions); expect(target.used).toBe(true); expect(r.salvage).toBe(3); expect([...r.members.values()].map(m => m.player.hp).sort()).toEqual([50, 95]);
    r.update(1 / 60, actions); expect(r.salvage).toBe(3);
  });
  it('ofertas individuales, rechazo de repetición y plazo de 15 segundos reales', () => {
    const r = run(); r.experience.add(32); r.update(1 / 60, new Map(), 1000); expect(r.status).toBe('upgrade'); expect(r.deadline).toBe(16000);
    const time = r.time, a = r.members.get('a'), b = r.members.get('b'); expect(a.upgrades.offers).toHaveLength(3); expect(b.upgrades.offers).toHaveLength(3);
    expect(r.chooseFor('a', 'not-offered', r.round)).toBe(false); expect(r.chooseFor('a', a.upgrades.offers[0].id, r.round)).toBe(true); expect(r.chooseFor('a', a.upgrades.offers[0]?.id, r.round)).toBe(false);
    r.update(1 / 60, new Map(), 15999); expect(r.time).toBe(time); expect(r.status).toBe('upgrade'); r.update(1 / 60, new Map(), 16000); expect(r.status).toBe('playing'); expect(Object.values(b.upgrades.stacks)).toEqual([1]);
  });
  it('solo termina cuando todo el equipo muere antes del lanzamiento', () => { const r = run(); r.withPlayer('a', () => r.hurtPlayer(99999)); expect(r.status).toBe('playing'); r.withPlayer('b', () => r.hurtPlayer(99999)); expect(r.status).toBe('defeat'); });
  it('gemas de equipo, baliza por otro jugador y victoria tras 60 + 24 segundos pese a muertes', () => {
    const r = run(); r.gems = Array.from({ length: 5 }, (_, id) => ({ id, x: 0, z: 0, collected: false })); r.update(1 / 60); expect(r.mission.phase).toBe('ready');
    const p = r.playerById('b'); p.x = 0; p.z = 7;
    r.update(1 / 60, new Map([['b', { input: inputAdapter(input(1, { actions: ['KeyE'] })), yaw: 0 }]])); expect(r.mission.phase).toBe('countdown');
    r.forEachLiving(() => r.hurtPlayer(99999)); expect(r.status).toBe('playing');
    for (let i = 0; i < 3601; i++) r.update(1 / 60); expect(r.mission.phase).toBe('cinematic'); expect(r.status).toBe('playing');
    for (let i = 0; i < 1441; i++) r.update(1 / 60); expect(r.status).toBe('victory');
  });
  it('IA elige vivos y las zonas de área alcanzan a ambos', () => {
    const r = run(), e = r.spawn('stalker', 3, -2); r.update(1 / 60); expect(e.targetId).toBe('b');
    r.boss.zones.push({ x: 0, y: 0, z: 0, radius: 5, damage: 10, remaining: 0 }); r.boss.update(1 / 60, r); expect(r.playerById('a').hp).toBeLessThan(120); expect(r.playerById('b').hp).toBeLessThan(120);
    r.abandon('b'); r.update(1 / 60); expect(e.targetId).toBe('a');
  });
  it('mantiene los límites de entidades y proyectiles', () => { const r = run(); for (let i = 0; i < CONFIG.projectileLimit + 50; i++) r.combat.spawn({ life: 1 }); expect(r.combat.pool.items.filter(p => p.active)).toHaveLength(CONFIG.projectileLimit); for (let i = 0; i < 200; i++) { r.director.timer = 0; r.director.update(1, r); } expect(r.enemies.length).toBeLessThanOrEqual(CONFIG.enemyLimit - 5); });
});
