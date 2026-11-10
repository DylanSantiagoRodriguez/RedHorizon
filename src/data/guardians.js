export const GUARDIANS = [
  { id: 'ruby', name: 'Guardián rubí', color: 0xff5060, effect: 'embers' },
  { id: 'sapphire', name: 'Guardián zafiro', color: 0x509dff, effect: 'arcs' },
  { id: 'emerald', name: 'Guardián esmeralda', color: 0x50e090, effect: 'vapor' },
  { id: 'amethyst', name: 'Guardián amatista', color: 0xb580ff, effect: 'shards' },
  { id: 'dust', name: 'Titán del polvo', color: 0xffd050, effect: 'shockwave' },
];
export const guardianFor = enemy => GUARDIANS.find(g => g.id === enemy.guardianId) || GUARDIANS[4];
export const enemyModelKey = enemy => enemy.type === 'titan' ? `titan-${guardianFor(enemy).id}` : enemy.type;
