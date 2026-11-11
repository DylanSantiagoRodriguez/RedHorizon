import { AMETHYST_CLIPS, AMETHYST_SCALE } from '../data/amethystAnimations.js';
import muzzle from '../data/amethystMuzzle.json';
export function amethystMuzzlePosition(enemy) {
 const [x,y,z]=muzzle.position.map(v=>v*AMETHYST_SCALE),c=Math.cos(enemy.yaw),s=Math.sin(enemy.yaw);
 return {x:enemy.x+x*c+z*s,y:enemy.y+y,z:enemy.z-x*s+z*c};
}
export function startAmethystAction(enemy,name,time) {
 if(enemy.dead||enemy.stun>0||enemy.amethystAction)return false;
 enemy.amethystAction={name,startedAt:time,speed:Math.max(.01,enemy.attackSpeed||1),fired:false};
 enemy.state={summon:'Summon',attack_special:'Special',attack_melee:'Attack'}[name];return true;
}
export function advanceAmethystAction(enemy,run) {
 const action=enemy.amethystAction;if(!action)return false;
 if(enemy.dead||enemy.stun>0){enemy.amethystAction=null;return false;}
 const clip=AMETHYST_CLIPS[action.name],elapsed=(run.time-action.startedAt)*action.speed;
 if(!action.fired&&clip.eventFrame!==undefined&&elapsed+1e-8>=clip.eventFrame/30){
  action.fired=true;
  if(action.name==='attack_special')run.boss.releaseAbility(run,enemy,amethystMuzzlePosition(enemy));
  else if(action.name==='summon'){
   run.boss.releaseSummon(run,enemy);
   run.emit('guardianEffect',{x:enemy.x,y:enemy.y,z:enemy.z,guardianId:'amethyst',color:enemy.gemColor});
  }else{
   const p=run.player,dx=p.x-enemy.x,dz=p.z-enemy.z;
   if(Math.hypot(dx,dz)<=enemy.range&&dx*Math.sin(enemy.yaw)+dz*Math.cos(enemy.yaw)>=0&&Math.abs(p.y+1-enemy.y)<enemy.height+1.2)run.hurtPlayer(enemy.damage);
  }
 }
 if(elapsed+1e-8>=clip.duration){enemy.amethystAction=null;return false;}return true;
}
