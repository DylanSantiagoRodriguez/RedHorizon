// Test-only process, never imported or packaged by server/main.js. The control
// listener exists only here, on loopback, and requires a fixture header.
import http from 'node:http';
import { createServer } from '../../server/server.js';
const app = createServer({ port: 18787, origins: ['http://127.0.0.1:5179'] }); await app.listen();
// Test diagnostics deliberately omit identities, room tokens and input data.
const welcome = app.manager.welcome.bind(app.manager);
app.manager.welcome = (room, member) => {
  member.socket.once('close', (code, reason) => console.warn('QA socket closed', JSON.stringify({ code, reason: reason.toString(), time: room.run?.time })));
  welcome(room, member);
};
// Browser readiness is not simulation time. Keep the setup deterministic on
// software-rendered CI: encounters begin explicitly at the combat fixture.
const startRoom = app.manager.start.bind(app.manager);
app.manager.start = (room, member) => { startRoom(room, member); room.run.director.timer = 100000; };
const control = http.createServer(async (req, res) => {
  if (req.headers['x-test-fixture'] !== 'redhorizon-playwright' || req.method !== 'POST') { res.writeHead(403).end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost'), room = app.manager.find(url.searchParams.get('code')), r = room.run;
    if (!r) throw new Error('Partida no iniciada');
    if (url.pathname === '/explore') {
      // Network/menus are checked before combat; browser rendering time must not kill the fixture players.
      r.enemies.length = 0; r.director.timer = 100000;
    } else if (url.pathname === '/combat') {
      r.enemies.length = 0; r.director.timer = 100000;
      for (const [i, m] of [...r.members.values()].entries()) { Object.assign(m.player, { x: i * 1.5, z: 0, y: 0, hp: 120, dead: false, vx: 0, vz: 0 }); m.weapon.timer = 0; m.player.stats.crit = 0; }
      const e = r.spawn('brute', 0, -6); e.hp = 100; e.stun = 10000;
    } else if (url.pathname === '/mission') {
      r.enemies.length = 0; r.director.timer = 100000; r.combat.pool.clear();
      const p = [...r.members.values()][0].player;
      for (const altar of r.altars) { p.x = altar.x; p.z = altar.z; r.withPlayer(p.id, () => { r.interaction = altar; r.interact(); }); }
      // Real guardian deaths, XP and gems will be produced by a player ability.
      for (const [i, e] of r.enemies.entries()) Object.assign(e, { x: i * .2, z: -1, y: e.height, hp: 1, stun: 10000 });
      for (const [i, m] of [...r.members.values()].entries()) { Object.assign(m.player, { x: i * 1.5, z: 0, y: 0, hp: 120, dead: false, vx: 0, vz: 0 }); m.ability.timer = 0; }
    } else if (url.pathname === '/launch-position') {
      // Upgrades still use authoritative offers and round validation.
      while (r.status === 'upgrade' || r.experience.pending) { if (r.status !== 'upgrade') r.checkLevel(); for (const [id, m] of r.members) if (!m.chosen) r.chooseFor(id, m.upgrades.offers[0].id, r.round); r.update(1 / 60, new Map(), Date.now()); }
      for (const [i, m] of [...r.members.values()].entries()) Object.assign(m.player, { x: i * 1.5, z: 7, y: r.world.heightAt(i * 1.5, 7), vx: 0, vz: 0 });
    } else if (url.pathname === '/finale') {
      if (r.mission.phase !== 'countdown') throw new Error('Falta lanzar la baliza'); r.mission.countdown = .1;
    } else if (url.pathname === '/epilogue') {
      if (r.mission.phase !== 'cinematic') throw new Error('Falta extinción'); r.mission.cinematic = 23.9;
    } else { res.writeHead(404).end(); return; }
    app.manager.snapshots(); res.writeHead(200).end('ok');
  } catch (e) { res.writeHead(400).end(e.message); }
});
await new Promise(resolve => control.listen(18788, '127.0.0.1', resolve));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { control.close(); await app.close(); process.exit(0); });
