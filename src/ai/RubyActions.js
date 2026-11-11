import { RUBY_CLIPS } from '../data/rubyAnimations.js';
import muzzle from '../data/rubyMuzzle.json' with { type: 'json' };
export function rubyMuzzlePosition(enemy) {
 const [x,y,z]=muzzle.position,c=Math.cos(enemy.yaw),s=Math.sin(enemy.yaw);
 return {x:enemy.x+x*c+z*s,y:enemy.y-enemy.height+y,z:enemy.z-x*s+z*c};
}
export function startRubyAction(enemy,name,time) {
 if(enemy.dead||enemy.stun>0||enemy.rubyAction)return false;
 enemy.rubyAction={name,startedAt:time,speed:name==='spawn'?1:Math.max(.01,enemy.attackSpeed||1),fired:false};
 enemy.state={spawn:'Spawn',summon:'Summon',attack_special:'Special',attack_melee:'Attack'}[name];return true;
}
export function advanceRubyAction(enemy,run) {
 const action=enemy.rubyAction;if(!action)return false;
 if(enemy.dead||enemy.stun>0){enemy.rubyAction=null;return false;}
 const clip=RUBY_CLIPS[action.name],elapsed=(run.time-action.startedAt)*action.speed;
 if(!action.fired&&clip.eventFrame!==undefined&&elapsed+1e-8>=clip.eventFrame/30){
  action.fired=true;
  if(action.name==='attack_special')run.boss.releaseAbility(run,enemy,rubyMuzzlePosition(enemy));
  else if(action.name==='summon'){
   run.boss.releaseSummon(run,enemy);
   run.emit('guardianEffect',{x:enemy.x,y:enemy.y,z:enemy.z,guardianId:'ruby',color:enemy.gemColor});
  }else{
   const p=run.player,dx=p.x-enemy.x,dz=p.z-enemy.z;
   if(Math.hypot(dx,dz)<=enemy.range&&dx*Math.sin(enemy.yaw)+dz*Math.cos(enemy.yaw)>=0&&Math.abs(p.y+1-enemy.y)<enemy.height+1.2)run.hurtPlayer(enemy.damage);
  }
 }
 if(elapsed+1e-8>=clip.duration){enemy.rubyAction=null;return false;}return true;
}
