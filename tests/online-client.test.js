import { it, expect, vi } from 'vitest';
import { OnlineGame } from '../src/network/OnlineGame.js';
import { CoopRun } from '../src/core/CoopRun.js';
import { Run } from '../src/core/Run.js';
import { Player } from '../src/entities/Player.js';
import { WorldModel } from '../src/world/WorldModel.js';
import { snapshot } from '../src/network/snapshot.js';
import { inputAdapter } from '../src/network/protocol.js';
function fixture() {
  const world = new WorldModel('net-client'), authoritative = new CoopRun(world, 'net-client', ['a', 'b'], () => {});
  const room = { run: authoritative, tick: 1, events: [], members: new Map(['a', 'b'].map(id => [id, { nickname: id, socket: {}, ack: 0 }])) };
  const events = [], game = { world: new WorldModel('net-client'), run: new Run(new WorldModel('net-client'), 'net-client'), entities: { weapons: {} }, state: { value: 'playing' }, onEvent: (...args) => events.push(args) };
  const client = Object.assign(Object.create(OnlineGame.prototype), { game, started: true, playerId: 'a', players: new Map(), pending: [], history: [], fresh: true, updateTeam() {} });
  const dto = () => JSON.parse(JSON.stringify(snapshot(room, 1000)));
  return { authoritative, room, client, game, events, dto };
}
it('reconcilia movimiento desde ack y reproduce solo entradas pendientes, sin acumular correcciones', () => {
  const { room, client, game, dto } = fixture();
  const command = { seq: 2, enabled: true, held: ['KeyW'], actions: ['Space'], yaw: 0, aim: { x: 0, y: 0, z: -1 }, dt: 1 / 60 };
  client.pending = [{ ...command, seq: 1 }, command]; room.members.get('a').ack = 1;
  const data = dto(), expected = Object.assign(new Player(), data.players[0]); expected.update(command.dt, inputAdapter(command), 0, game.world);
  client.snapshot(data); expect(client.pending.map(p => p.seq)).toEqual([2]); expect(game.run.player.z).toBe(expected.z); expect(game.run.player.y).toBe(expected.y);
  client.snapshot(data); expect(game.run.player.z).toBe(expected.z); expect(game.run.player.y).toBe(expected.y);
});
it('interpola remotos y enemigos y conserva la posición predicha local', () => {
  const { client, authoritative, room, game, dto } = fixture(); const now = vi.spyOn(performance, 'now');
  try {
    const e = authoritative.spawn('stalker', 0, -4); now.mockReturnValue(100); client.snapshot(dto());
    authoritative.playerById('b').x = 10; e.x = 10; room.tick++; now.mockReturnValue(200); client.snapshot(dto());
    const local = game.run.player.x; now.mockReturnValue(250); client.interpolate();
    expect(client.players.get('b').player.x).toBe(5.75); expect(game.run.enemies[0].x).toBe(5); expect(game.run.player.x).toBe(local);
    client.history = []; expect(() => client.interpolate()).not.toThrow();
  } finally { now.mockRestore(); }
});
it('no reproduce eventos históricos, duplicados o de daño dirigidos a otro jugador', () => {
  const { client, room, dto, events } = fixture(); room.events = [{ id: 1, name: 'explosion', data: {} }]; client.snapshot(dto()); expect(events).toHaveLength(0);
  room.events.push({ id: 2, name: 'hurt', data: { playerId: 'b' } }, { id: 3, name: 'hurt', data: { playerId: 'a' } }); room.tick++; client.snapshot(dto()); client.snapshot(dto()); expect(events).toHaveLength(1);
  client.fresh = true; room.events.push({ id: 4, name: 'shot', data: {} }); client.snapshot(dto()); expect(events).toHaveLength(1);
});
