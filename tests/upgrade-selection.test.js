import { it, expect } from 'vitest';
import { UpgradeSelectionGate } from '../src/ui/UpgradeSelectionGate.js';

it('espera a soltar el disparo incluso después de la pausa inicial', () => {
  const gate = new UpgradeSelectionGate(0);
  expect(gate.update(2000, new Set(['Mouse0']))).toBe(false);
  expect(gate.update(2100, new Set(), 2050)).toBe(false);
  expect(gate.update(2750, new Set(), 2050)).toBe(true);
});
it('los clics rápidos entre fotogramas mantienen bloqueadas las tarjetas', () => {
  const gate = new UpgradeSelectionGate(0);
  for (let time = 100; time <= 2000; time += 100) expect(gate.update(time, new Set(), time - 1)).toBe(false);
  expect(gate.update(2700, new Set(), 1999)).toBe(true);
});
it('protege disparo reasignado y confirmación con teclado sin bloquear movimiento', () => {
  for (const code of ['KeyR', 'Enter', 'NumpadEnter', 'Space']) {
    const gate = new UpgradeSelectionGate(0, 'KeyR');
    expect(gate.update(1000, new Set([code]))).toBe(false);
  }
  const gate = new UpgradeSelectionGate(0, 'KeyR');
  expect(gate.update(700, new Set(['KeyW']))).toBe(true);
  expect(gate.update(710, new Set(['Mouse0']))).toBe(true);
  expect(new UpgradeSelectionGate(710).update(711, new Set())).toBe(false);
});
