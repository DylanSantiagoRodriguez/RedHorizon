import { Random } from '../utils/Random.js';
export const PLUSH_NAMES = ['ichika','nino','miku','yotsuba','itsuki'];
export function hiddenPlushies(terrain, obstacles, seed) {
 const random=new Random(`${seed}-secrets`), chosen=[];
 const candidates=terrain.rocks.map(rock=>({rock,sort:random.next()})).sort((a,b)=>a.sort-b.sort);
 for(const {rock} of candidates){
  const distance=Math.hypot(rock.x,rock.z);if(distance<40 || rock.height<1.2)continue;
  const x=rock.x+rock.x/distance*(rock.radius+1.1),z=rock.z+rock.z/distance*(rock.radius+1.1);
  if(Math.hypot(x,z)>100||chosen.some(p=>Math.hypot(p.x-x,p.z-z)<22))continue;
  if(obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<o.radius+.8))continue;
  const y=terrain.heightAt(x,z);
  if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>Math.abs(terrain.heightAt(x+dx,z+dz)-y)>.65))continue;
  chosen.push({id:PLUSH_NAMES[chosen.length],type:'plush',x,y,z,rotation:Math.atan2(-x,-z),used:false});
  if(chosen.length===5)break;
 }
 return chosen;
}
export function collectPlush(run, target) {
 if(run.status!=='playing'||run.player.dead||target.used||!run.world.plushies?.includes(target))return false;
 if(Math.hypot(run.player.x-target.x,run.player.z-target.z)>1.25||Math.abs(run.player.y-target.y)>.9)return false;
 target.used=true;run.plushCount=(run.plushCount||0)+1;run.player.interactSerial++;
 if(run.plushCount===5&&!run.plushPower){
  run.plushPower=true;
  const players=run.livingPlayers?run.livingPlayers():[run.player];
  for(const player of players){const s=player.stats;s.damage*=4;s.fireRate*=1.5;s.maxHp+=500;s.shield+=300;s.regen+=8;s.speed*=1.2;player.hp=s.maxHp;player.shield=s.shield;}
 }
 run.emit('plush',{name:target.id,count:run.plushCount,power:!!run.plushPower});return true;
}
