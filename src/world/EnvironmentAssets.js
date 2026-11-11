import { Box3, Vector3, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export async function loadEnvironment(world) {
 const loader=new GLTFLoader(), assets=[];
 const load=async path=>{const a=await loader.loadAsync(import.meta.env.BASE_URL+'models/'+path);assets.push(a);return a;};
 const dispose=()=>{const geo=new Set(),mats=new Set(),textures=new Set();for(const a of assets)a.scene.traverse(n=>{if(n.geometry)geo.add(n.geometry);for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geo.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());};
 world.disposeEnvironment=dispose;
 const place=(asset,x,y,z,yaw,width,height)=>{
  const model=asset.scene.clone(true),root=new Group(),box=new Box3().setFromObject(model),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
  const scale=width/Math.hypot(size.x,size.z);model.position.set(-center.x,-box.min.y,-center.z);root.add(model);
  root.scale.set(scale,height?height/size.y:scale,scale);root.position.set(x,y,z);root.rotation.y=yaw;
  root.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;}});world.group.add(root);return root;
 };
 try {
  const t=world.terrain;
  const arena=await load(`environment/world_${t.worldVariant+1}.glb`);
  if(world.disposed)return;
  arena.scene.scale.set(240,t.verticalScale,240);arena.scene.rotation.y=t.worldRotation;arena.scene.position.y=t.worldOffset;
  arena.scene.traverse(n=>{if(n.isMesh){n.receiveShadow=true;n.material.roughness=1;}});
  world.group.add(arena.scene);arena.scene.traverse(n=>{if(n.isMesh)world.cameraColliders.push(n);});world.terrainMesh.visible=false;
  const rocks=await Promise.all(Array.from({length:5},(_,i)=>load(`environment/rock_${i+1}.glb`)));
  if(world.disposed)return;
  for(const [i,rock] of t.rocks.entries()){
   const root=place(rocks[rock.variant-1],rock.x,world.heightAt(rock.x,rock.z)-.15,rock.z,rock.rotation,rock.radius*2,rock.height);
   world.rockViews[i].visible=false;world.cameraColliders=world.cameraColliders.filter(n=>n!==world.rockViews[i]);root.traverse(n=>{if(n.isMesh)world.cameraColliders.push(n);});
  }
  const plush=await Promise.all(world.plushies.map(p=>load(`plushies/${p.id}_nakano.glb`)));
  if(world.disposed)return;
  world.plushies.forEach((p,i)=>{const box=new Box3().setFromObject(plush[i].scene),size=box.getSize(new Vector3());p.mesh=place(plush[i],p.x,p.y,p.z,p.rotation,.55*Math.hypot(size.x,size.z)/size.y);p.mesh.visible=!p.used;});
  world.environmentLoaded=true;
 } catch(error){world.environmentError=String(error);console.warn('No se pudieron cargar todos los modelos del entorno.',error);}
 finally {if(world.disposed)dispose();}
}

