import { expect, it, vi } from 'vitest';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { startRubyAction, advanceRubyAction, rubyMuzzlePosition } from '../src/ai/RubyActions.js';
function fixture() {
 const run=new Run({heightAt:()=>0,obstacles:[]},'ruby');
 const boss=run.spawn('titan',0,0);boss.guardianId='ruby';boss.gemColor=0xff5060;
 run.boss.guardians.push(boss);run.hurtPlayer=vi.fn();return {run,boss};
}
it('altar activation holds Ruby in spawn for two seconds',()=>{
 const {run}=fixture(),altar=run.altars[0];run.player.x=altar.x;run.player.z=altar.z;
 expect(run.boss.awaken(run,altar)).toBe(true);const boss=run.boss.enemy,x=boss.x,z=boss.z;
 boss.abilityTimer=0;run.time=1.9;run.boss.updateBoss(.1,run,boss);updateEnemy(boss,.1,run);
 expect(boss.rubyAction.name).toBe('spawn');expect([boss.x,boss.z]).toEqual([x,z]);expect(run.boss.zones).toHaveLength(0);
 run.time=2;advanceRubyAction(boss,run);expect(boss.rubyAction).toBeNull();
});
it('melee damage crosses frame 18 exactly once and respects dodging',()=>{
 const {run,boss}=fixture();run.player.z=3;startRubyAction(boss,'attack_melee',0);
 run.time=17/30;advanceRubyAction(boss,run);expect(run.hurtPlayer).not.toHaveBeenCalled();
 run.time=18/30;advanceRubyAction(boss,run);advanceRubyAction(boss,run);expect(run.hurtPlayer).toHaveBeenCalledExactlyOnceWith(boss.damage);
 run.time=1;advanceRubyAction(boss,run);startRubyAction(boss,'attack_melee',1);run.player.z=20;run.time=2;advanceRubyAction(boss,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
});
it.each(['attack_special','summon'])('%s crosses frame 30 once and cancels on stun/death',name=>{
 const {run,boss}=fixture(),spy=vi.spyOn(run.boss,name==='summon'?'releaseSummon':'releaseAbility');
 boss.attackSpeed=2;startRubyAction(boss,name,0);run.time=.49;advanceRubyAction(boss,run);expect(spy).not.toHaveBeenCalled();
 run.time=.5;advanceRubyAction(boss,run);advanceRubyAction(boss,run);expect(spy).toHaveBeenCalledTimes(1);
 run.time=2;advanceRubyAction(boss,run);startRubyAction(boss,name,2);boss.stun=.5;run.time=4;updateEnemy(boss,.01,run);expect(boss.rubyAction).toBeNull();
 boss.stun=0;startRubyAction(boss,name,4);boss.dead=true;run.time=8;advanceRubyAction(boss,run);expect(spy).toHaveBeenCalledTimes(1);
});
it('serializes abilities and summons, emitting ruby discharge from the chest socket',()=>{
 const {run,boss}=fixture();boss.yaw=.7;boss.abilityTimer=boss.summonTimer=0;
 run.boss.updateBoss(0,run,boss);expect(boss.rubyAction.name).toBe('attack_special');
 run.time=1;advanceRubyAction(boss,run);const origin=rubyMuzzlePosition(boss),shots=run.combat.pool.items.filter(p=>p.active);
 expect(shots.length).toBeGreaterThan(0);for(const shot of shots){expect(shot.color).toBe(boss.gemColor);expect(shot.x).toBeCloseTo(origin.x);expect(shot.y).toBeCloseTo(origin.y);}
 run.boss.updateBoss(0,run,boss);expect(boss.rubyAction.name).toBe('attack_special');
 run.time=1.5;advanceRubyAction(boss,run);run.boss.updateBoss(0,run,boss);expect(boss.rubyAction.name).toBe('summon');
 run.time=2.49;advanceRubyAction(boss,run);expect(run.enemies).toHaveLength(1);
 run.time=2.5;advanceRubyAction(boss,run);expect(run.enemies).toHaveLength(4);
});
