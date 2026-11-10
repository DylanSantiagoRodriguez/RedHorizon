export const RARITIES = { common: { name: 'Común', weight: 6 }, uncommon: { name: 'Poco común', weight: 4 }, rare: { name: 'Rara', weight: 2 }, legendary: { name: 'Legendaria', weight: 0.7 } };
export const UPGRADES = [
  { id: 'damage', name: 'Núcleo de fusión', icon: '✦', description: '+20% de daño base en todas las armas.', rarity: 'common', stat: 'damage', amount: 0.2, max: 8 },
  { id: 'fireRate', name: 'Ciclo acelerado', icon: '»', description: '+15% de velocidad de disparo.', rarity: 'common', stat: 'fireRate', amount: 0.15, max: 8 },
  { id: 'maxHp', name: 'Armadura cerámica', icon: '⬡', description: '+25 de vida máxima. Recupera 25 de vida.', rarity: 'common', stat: 'maxHp', amount: 25, max: 6 },
  { id: 'regen', name: 'Nanorreparadores', icon: '✚', description: 'Regenera 0,8 de vida por segundo.', rarity: 'uncommon', stat: 'regen', amount: 0.8, max: 4 },
  { id: 'speed', name: 'Propulsores iónicos', icon: '↗', description: '+10% de velocidad de movimiento.', rarity: 'common', stat: 'speed', amount: 0.1, max: 4 },
  { id: 'multishot', name: 'Prisma fractal', icon: '⋔', description: 'Un proyectil adicional por disparo. Combina con rebote.', rarity: 'legendary', stat: 'multishot', amount: 1, max: 3 },
  { id: 'crit', name: 'Óptica de precisión', icon: '⌖', description: '+10 puntos de probabilidad de crítico.', rarity: 'uncommon', stat: 'crit', amount: 0.1, max: 6 },
  { id: 'critDamage', name: 'Punto de ruptura', icon: '⋈', description: '+40% de multiplicador de daño crítico.', rarity: 'rare', stat: 'critDamage', amount: 0.4, max: 4 },
  { id: 'explosion', name: 'Reacción en cadena', icon: '☼', description: 'Las bajas explotan e infligen 25 de daño en área.', rarity: 'rare', stat: 'explosion', amount: 25, max: 4 },
  { id: 'lifesteal', name: 'Sifón biológico', icon: '◈', description: 'Recupera el 2% del daño infligido como vida.', rarity: 'rare', stat: 'lifesteal', amount: 0.02, max: 4 },
  { id: 'cooldown', name: 'Condensador frío', icon: '⌁', description: 'Reduce un 12% el enfriamiento del pulso.', rarity: 'uncommon', stat: 'cooldown', amount: -0.12, max: 5 },
  { id: 'pierce', name: 'Aguja de fase', icon: '⇥', description: 'Los proyectiles atraviesan un objetivo adicional.', rarity: 'rare', stat: 'pierce', amount: 1, max: 3 },
  { id: 'area', name: 'Resonancia orbital', icon: '◎', description: '+25% al radio de explosiones y pulso.', rarity: 'uncommon', stat: 'area', amount: 0.25, max: 4 },
  { id: 'shield', name: 'Barrera de emergencia', icon: '◇', description: '+25 de escudo. Se recarga tras 6 s sin daño.', rarity: 'uncommon', stat: 'shield', amount: 25, max: 4 },
  { id: 'bounce', name: 'Eco de plasma', icon: '⤴', description: 'Un rebote hacia otro enemigo a menos de 16 m.', rarity: 'legendary', stat: 'bounce', amount: 1, max: 3 },
];
