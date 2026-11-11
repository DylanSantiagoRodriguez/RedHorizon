export const AMETHYST_CLIPS = {
 idle: {duration:2,loop:true}, move: {duration:1.2,loop:true},
 attack_melee: {duration:1,loop:false,eventFrame:18},
 attack_special: {duration:1.5,loop:false,eventFrame:30},
 summon: {duration:1.5,loop:false,eventFrame:30},
 death: {duration:2.5,loop:false},
};
export const isAmethyst = enemy => enemy.type === 'titan' && enemy.guardianId === 'amethyst';



export const AMETHYST_SCALE = 8;
