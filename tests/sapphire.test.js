import { expect, it, vi } from 'vitest';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { startSapphireAction, advanceSapphireAction, sapphireMuzzlePosition } from '../src/ai/SapphireActions.js';
function fixture() {
 const run=new Run({heightAt:()=>0,obstacles:[]},'sapphire');
 const boss=run.spawn('titan',0,0);boss.guardianId='sapphire';boss.gemColor=0x509dff;
 run.boss.guardians.push(boss);run.hurtPlayer=vi.fn();return {run,boss};
}
it('melee damage crosses frame 18 exactly once and respects dodging',()=>{
 const {run,boss}=fixture();run.player.z=3;startSapphireAction(boss,'attack_melee',0);
 run.time=17/30;advanceSapphireAction(boss,run);expect(run.hurtPlayer).not.toHaveBeenCalled();
 run.time=18/30;advanceSapphireAction(boss,run);advanceSapphireAction(boss,run);expect(run.hurtPlayer).toHaveBeenCalledExactlyOnceWith(boss.damage);
 run.time=1;advanceSapphireAction(boss,run);startSapphireAction(boss,'attack_melee',1);run.player.z=20;run.time=2;advanceSapphireAction(boss,run);expect(run.hurtPlayer).toHaveBeenCalledTimes(1);
});
it.each(['attack_special','summon'])('%s crosses frame 30 once and cancels on stun/death',name=>{
 const {run,boss}=fixture(),spy=vi.spyOn(run.boss,name==='summon'?'releaseSummon':'releaseAbility');
 boss.attackSpeed=2;startSapphireAction(boss,name,0);run.time=.49;advanceSapphireAction(boss,run);expect(spy).not.toHaveBeenCalled();
 run.time=.5;advanceSapphireAction(boss,run);advanceSapphireAction(boss,run);expect(spy).toHaveBeenCalledTimes(1);
 run.time=2;advanceSapphireAction(boss,run);startSapphireAction(boss,name,2);boss.stun=.5;run.time=4;updateEnemy(boss,.01,run);expect(boss.sapphireAction).toBeNull();
 boss.stun=0;startSapphireAction(boss,name,4);boss.dead=true;run.time=8;advanceSapphireAction(boss,run);expect(spy).toHaveBeenCalledTimes(1);
});
it('serializes abilities and summons, emitting sapphire discharge from the chest socket',()=>{
 const {run,boss}=fixture();boss.yaw=.7;boss.abilityTimer=boss.summonTimer=0;
 run.boss.updateBoss(0,run,boss);expect(boss.sapphireAction.name).toBe('attack_special');
 run.time=1;advanceSapphireAction(boss,run);const origin=sapphireMuzzlePosition(boss),shots=run.combat.pool.items.filter(p=>p.active);
 expect(shots.length).toBeGreaterThan(0);for(const shot of shots){expect(shot.color).toBe(boss.gemColor);expect(shot.x).toBeCloseTo(origin.x);expect(shot.y).toBeCloseTo(origin.y);}
 run.boss.updateBoss(0,run,boss);expect(boss.sapphireAction.name).toBe('attack_special');
 run.time=1.5;advanceSapphireAction(boss,run);run.boss.updateBoss(0,run,boss);expect(boss.sapphireAction.name).toBe('summon');
 run.time=2.49;advanceSapphireAction(boss,run);expect(run.enemies).toHaveLength(1);
 run.time=2.5;advanceSapphireAction(boss,run);expect(run.enemies).toHaveLength(4);
});
