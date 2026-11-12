import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Connection } from '../src/network/Connection.js';
import { ERRORS, PROTOCOL_VERSION, GAME_VERSION } from '../src/network/protocol.js';
class FakeSocket {
  static OPEN = 1;
  static instances = [];
  constructor() { this.readyState = 0; this.bufferedAmount = 0; FakeSocket.instances.push(this); }
  send() {}
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
}
let connection, status;
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0); FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket); vi.stubGlobal('location', { protocol: 'http:', host: '127.0.0.1:5174' });
  const storage = new Map(); vi.stubGlobal('sessionStorage', { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) });
  status = vi.fn(); connection = new Connection(vi.fn(), status);
});
afterEach(() => { connection.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('distingue un backend ausente de una sala expirada y permite reintentar', () => {
  connection.connect({ type: 'create' }); const first = connection.socket; first.onerror(); first.close();
  expect(status).toHaveBeenLastCalledWith(ERRORS.UNAVAILABLE); expect(connection.socket).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  connection.connect({ type: 'create' }); expect(FakeSocket.instances).toHaveLength(2);
  connection.socket.open(); connection.socket.receive({ type: 'welcome', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION, code: 'ABC234', token: 'a'.repeat(64) });
  expect(status).toHaveBeenLastCalledWith('Conectado'); expect(connection.identity.code).toBe('ABC234');
});
it('conserva el token tras recargar y reintenta si falla la primera reconexión', () => {
  const identity = { code: 'ABC234', token: 'b'.repeat(64) }; connection.connect({ type: 'reconnect', ...identity }); connection.socket.close();
  expect(connection.identity).toEqual(identity); expect(status).toHaveBeenLastCalledWith(ERRORS.OFFLINE);
  vi.advanceTimersByTime(300); expect(FakeSocket.instances).toHaveLength(2); expect(connection.request).toEqual({ type: 'reconnect', ...identity });
});
it('aplica el plazo solo a una identidad existente y cancela reintentos al salir', () => {
  connection.connect({ type: 'reconnect', code: 'ABC234', token: 'c'.repeat(64) }); connection.socket.close();
  vi.advanceTimersByTime(30000); connection.socket.close();
  expect(status).toHaveBeenLastCalledWith('Terminó el plazo de reconexión de 30 segundos. Vuelve al menú.'); expect(connection.identity).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  connection.connect({ type: 'reconnect', code: 'ABC234', token: 'c'.repeat(64) }); connection.socket.close(); connection.dispose(); vi.advanceTimersByTime(10000);
  expect(vi.getTimerCount()).toBe(0);
});
it('comprueba el enlace después de un bloqueo del navegador y sigue cerrando enlaces sin respuesta', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(0);
  connection.connect({ type: 'create' }); const socket = connection.socket; socket.open();
  const send = vi.spyOn(socket, 'send');
  // Only one timer callback runs after the simulated main-thread stall.
  now.mockReturnValue(20000); vi.advanceTimersByTime(5000);
  expect(socket.readyState).toBe(FakeSocket.OPEN);
  expect(JSON.parse(send.mock.calls.at(-1)[0]).type).toBe('ping');
  for (const time of [25000, 30000]) { now.mockReturnValue(time); vi.advanceTimersByTime(5000); expect(socket.readyState).toBe(FakeSocket.OPEN); }
  now.mockReturnValue(35000); vi.advanceTimersByTime(5000);
  expect(socket.readyState).toBe(3); expect(vi.getTimerCount()).toBe(0);
});
it('reconecta sin esperar el handshake de cierre y descarta callbacks del socket antiguo', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(0);
  connection.connect({ type: 'create' }); const old = connection.socket; old.open();
  old.receive({ type: 'welcome', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION, code: 'ABC234', token: 'd'.repeat(64) });
  const lateClose = old.onclose, lateMessage = old.onmessage;
  old.close = () => { old.readyState = 2; }; // Browser close handshake can take 30 seconds.
  for (const time of [5000, 10000, 15000, 20000]) { now.mockReturnValue(time); vi.advanceTimersByTime(5000); }
  expect(connection.socket).toBeNull(); expect(old.readyState).toBe(2);
  vi.advanceTimersByTime(300); const next = connection.socket; next.open();
  next.receive({ type: 'welcome', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION, code: 'ABC234', token: 'd'.repeat(64) });
  lateClose(); lateMessage({ data: JSON.stringify({ type: 'error', code: 'TOKEN' }) });
  expect(connection.socket).toBe(next); expect(connection.identity.token).toBe('d'.repeat(64));
  expect(status).toHaveBeenLastCalledWith('Conectado'); expect(vi.getTimerCount()).toBe(1);
});
it('reintenta ACTIVE con el mismo token hasta que el servidor libera la conexión anterior', () => {
  const identity = { code: 'ABC234', token: 'e'.repeat(64) };
  connection.connect({ type: 'reconnect', ...identity }); const first = connection.socket; first.open(); first.receive({ type: 'error', code: 'ACTIVE' });
  expect(connection.identity).toEqual(identity); expect(connection.closed).toBe(false); expect(connection.receive).not.toHaveBeenCalled();
  vi.advanceTimersByTime(300); expect(connection.request).toEqual({ type: 'reconnect', ...identity });
  connection.socket.open(); connection.socket.receive({ type: 'welcome', version: PROTOCOL_VERSION, gameVersion: GAME_VERSION, ...identity });
  expect(status).toHaveBeenLastCalledWith('Conectado'); expect(FakeSocket.instances).toHaveLength(2);
});
it('no prolonga indefinidamente los reintentos de una identidad todavía activa', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(0);
  connection.connect({ type: 'reconnect', code: 'ABC234', token: 'f'.repeat(64) }); connection.socket.open(); connection.socket.receive({ type: 'error', code: 'ACTIVE' });
  vi.advanceTimersByTime(300); connection.socket.open(); now.mockReturnValue(30000); connection.socket.receive({ type: 'error', code: 'ACTIVE' });
  expect(connection.identity).toBeNull(); expect(vi.getTimerCount()).toBe(0);
});
