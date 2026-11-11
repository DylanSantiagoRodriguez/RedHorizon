import { expect, it, vi } from 'vitest';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { startEmeraldAction, advanceEmeraldAction, emeraldMuzzlePosition } from '../src/ai/EmeraldActions.js';
function fixture() {
 const run=new Run({heightAt:()=>0,obstacles:[]},'emerald');
 const boss=run.spawn('titan',0,0);boss.guardianId='emerald';boss.gemColor=0x40ef80;
 run.boss.guardians.push(boss);run.hurtPlayer=vi.fn();return {run,boss};
}
it('melee damage crosses frame 18 exactly once and respects dodging',()=>{
 const {run,boss}=fixture();run.player.z=3;startEmeraldAction(boss,'attack_melee',0);
 run.time=17/30;advanceEmeraldAction(boss,run);expect(run.hurtPlayer).not.toHaveBeenCalled();
 run.time=18/30;advanceEmeraldAction(boss,run);advanceEmeraldAction(boss,run);expect(run.hurtPlayer).toHaveBeenCalledExactlyOnceWith(boss.damage);
 run.time=1;advanceEmeraldAction(boss,run);startEmeraldAction(boss,'attack_melee',1);run.player.z=20;run.time=2;advanceEmeraldAction(boss,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
});
it.each(['attack_special','summon'])('%s crosses its marker once and cancels on stun/death',name=>{
 const {run,boss}=fixture(),spy=vi.spyOn(run.boss,name==='summon'?'releaseSummon':'releaseAbility');
 boss.attackSpeed=2;startEmeraldAction(boss,name,0);run.time=(name==='summon'?1:.8)/2-.01;advanceEmeraldAction(boss,run);expect(spy).not.toHaveBeenCalled();
 run.time=(name==='summon'?1:.8)/2;advanceEmeraldAction(boss,run);advanceEmeraldAction(boss,run);expect(spy).toHaveBeenCalledTimes(1);
 run.time=2;advanceEmeraldAction(boss,run);startEmeraldAction(boss,name,2);boss.stun=.5;run.time=4;updateEnemy(boss,.01,run);expect(boss.emeraldAction).toBeNull();
 boss.stun=0;startEmeraldAction(boss,name,4);boss.dead=true;run.time=8;advanceEmeraldAction(boss,run);expect(spy).toHaveBeenCalledTimes(1);
});
it('serializes abilities and summons, emitting emerald discharge from the chest socket',()=>{
 const {run,boss}=fixture();boss.yaw=.7;boss.abilityTimer=boss.summonTimer=0;
 run.boss.updateBoss(0,run,boss);expect(boss.emeraldAction.name).toBe('attack_special');
 run.time=.8;advanceEmeraldAction(boss,run);const origin=emeraldMuzzlePosition(boss),shots=run.combat.pool.items.filter(p=>p.active);
 expect(shots.length).toBeGreaterThan(0);for(const shot of shots){expect(shot.color).toBe(boss.gemColor);expect(shot.x).toBeCloseTo(origin.x);expect(shot.y).toBeCloseTo(origin.y);}
 run.boss.updateBoss(0,run,boss);expect(boss.emeraldAction.name).toBe('attack_special');
 run.time=1.2;advanceEmeraldAction(boss,run);run.boss.updateBoss(0,run,boss);expect(boss.emeraldAction.name).toBe('summon');
 run.time=2.19;advanceEmeraldAction(boss,run);expect(run.enemies).toHaveLength(1);
 run.time=2.2;advanceEmeraldAction(boss,run);expect(run.enemies).toHaveLength(4);
});
