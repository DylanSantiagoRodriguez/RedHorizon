import { it, expect } from 'vitest';
import { DEFAULT_BINDINGS, rebind, normalizeBindings } from '../src/core/Controls.js';
import { SaveSystem } from '../src/progression/SaveSystem.js';
import { InputManager } from '../src/core/InputManager.js';
it('intercambia teclas ocupadas sin perder ninguna acción', () => {
  const b = { ...DEFAULT_BINDINGS }; expect(rebind(b, 'Space', 'KeyE')).toBe(true);
  expect(b.Space).toBe('KeyE'); expect(b.KeyE).toBe('Space');
  expect(new Set(Object.values(b)).size).toBe(Object.keys(b).length);
  expect(rebind(b, 'Space', 'Escape')).toBe(false);
});
it('guarda y recupera controles; sanea asignaciones inválidas', () => {
  let json = '{}'; const storage = { getItem: () => json, setItem: (_, text) => { json = text; } };
  const save = new SaveSystem(storage); rebind(save.data.options.bindings, 'Space', 'KeyR'); save.write();
  expect(new SaveSystem(storage).data.options.bindings.Space).toBe('KeyR');
  expect(normalizeBindings({ Space: '<script>' })).toEqual(DEFAULT_BINDINGS);
});
it('traduce acciones a teclado y botones de ratón, incluyendo pulsaciones únicas', () => {
  const input = Object.create(InputManager.prototype);
  Object.assign(input, { bindings: { ...DEFAULT_BINDINGS, Space: 'Mouse1', Mouse0: 'KeyR' }, keys: new Set(['KeyR']), buttons: new Set([1]), pressed: new Set(['Mouse1']) });
  expect(input.down('Mouse0')).toBe(true); expect(input.down('Space')).toBe(true);
  expect(input.take('Space')).toBe(true); expect(input.take('Space')).toBe(false);
});
