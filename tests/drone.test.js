import { expect, it, vi } from 'vitest';
import { Run } from '../src/core/Run.js';
import { updateEnemy } from '../src/ai/EnemyAI.js';
import { startDroneAttack, advanceDroneAttack, droneMuzzlePosition } from '../src/ai/DroneActions.js';
function fixture() {
 const run=new Run({heightAt:()=>2,obstacles:[]},'drone'),enemy=run.spawn('drone',3,4);
 run.player.x=3;run.player.z=14;run.player.y=2;enemy.attackTimer=0;
 return {run,enemy,shot:vi.spyOn(run.combat,'enemyShot'),hurt:vi.spyOn(run,'hurtPlayer')};
}
it('launches once from the socket at frame 12, with damage only on projectile impact',()=>{
 const {run,enemy,shot,hurt}=fixture();updateEnemy(enemy,0,run);const pos=[enemy.x,enemy.z,enemy.yaw];
 run.time=11/30;updateEnemy(enemy,1/60,run);expect(shot).not.toHaveBeenCalled();
 run.time=.4;updateEnemy(enemy,1/60,run);updateEnemy(enemy,0,run);
 expect(shot).toHaveBeenCalledExactlyOnceWith(enemy,droneMuzzlePosition(enemy));expect(hurt).not.toHaveBeenCalled();expect([enemy.x,enemy.z,enemy.yaw]).toEqual(pos);
 const projectile=run.combat.pool.items.find(p=>p.active),origin=droneMuzzlePosition(enemy);
 expect([projectile.x,projectile.y,projectile.z]).toEqual([origin.x,origin.y,origin.z]);expect(projectile.color).toBe(0x67dfea);
 for(let i=0;i<60;i++)run.combat.update(1/60);
 expect(hurt).toHaveBeenCalledTimes(1);
});
it.each(['dead','stun'])('cancels unreleased projectile on %s',key=>{
 const {run,enemy,shot}=fixture();updateEnemy(enemy,0,run);enemy[key]=key==='dead'?true:.2;run.time=.6;updateEnemy(enemy,1/60,run);expect(shot).not.toHaveBeenCalled();expect(enemy.droneAction).toBeNull();
});
it('handles skipped frames, speed and recovery without duplicate shots',()=>{
 const {run,enemy,shot}=fixture();enemy.attackSpeed=2;startDroneAttack(enemy,0);run.time=.19;advanceDroneAttack(enemy,run);expect(shot).not.toHaveBeenCalled();
 run.time=2;advanceDroneAttack(enemy,run);advanceDroneAttack(enemy,run);expect(shot).toHaveBeenCalledTimes(1);expect(enemy.droneAction).toBeNull();
});
it('retreats facing the target and chases when beyond range',()=>{
 const {run,enemy}=fixture();enemy.attackTimer=10;run.player.z=5;updateEnemy(enemy,.1,run);expect(enemy.state).toBe('Retreat');expect(enemy.z).toBeLessThan(4);expect(enemy.yaw).toBe(0);
 run.player.z=30;updateEnemy(enemy,.1,run);expect(enemy.state).toBe('Chase');
});
it('rotates and elevates the baked socket with the enemy independently of rendering',()=>{
 const {enemy}=fixture();const a=droneMuzzlePosition(enemy);enemy.yaw=Math.PI/2;enemy.y+=3;const b=droneMuzzlePosition(enemy);
 expect(b.x-enemy.x).toBeCloseTo(a.z-enemy.z);expect(b.z-enemy.z).toBeCloseTo(-(a.x-enemy.x));expect(b.y-a.y).toBeCloseTo(3);
});
