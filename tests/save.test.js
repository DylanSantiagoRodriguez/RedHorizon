import { it, expect } from 'vitest';
import { SaveSystem } from '../src/progression/SaveSystem.js';
it('persiste resultados y compra blindaje con coste y límite', () => {
  let json = '{}'; const storage = { getItem: () => json, setItem: (_, value) => { json = value; } };
  const save = new SaveSystem(storage); save.finish({ salvage: 50, time: 120, status: 'victory' });
  expect(save.buyArmor()).toBe(true); expect(save.data.salvage).toBe(25); expect(save.buyArmor()).toBe(false);
  const restored = new SaveSystem(storage); expect(restored.data.wins).toBe(1); expect(restored.data.armor).toBe(1);
});
it('tolera almacenamiento denegado y datos corruptos', () => {
  const save = new SaveSystem({ getItem: () => '{bad', setItem: () => { throw new Error('blocked'); } }); expect(save.data.armor).toBe(0); expect(() => save.write()).not.toThrow();
});
