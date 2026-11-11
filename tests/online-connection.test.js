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
