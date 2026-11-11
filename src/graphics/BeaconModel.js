import { Mesh, IcosahedronGeometry, MeshStandardMaterial, ConeGeometry, MeshBasicMaterial } from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
const gems=[['ruby',0xff5060],['sapphire',0x509dff],['emerald',0x50e090],['amethyst',0xb580ff],['dust',0xffd050]];
export async function loadBeacon(parent,ground){
 const asset=await loadAnimatedModel(import.meta.env.BASE_URL+'models/beacon.glb');
 const capsule=asset.scene.getObjectByName('beacon_capsule'),base=asset.scene.getObjectByName('beacon_base');
 if(!capsule||!base){asset.dispose();throw new Error('Baliza sin grupos de base y cápsula');}
 const restY=capsule.position.y;asset.scene.position.set(0,ground,7);parent.add(asset.scene);
 asset.scene.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;}});
 const sockets=gems.map(([name,color])=>{
  const mesh=new Mesh(new IcosahedronGeometry(.17,1),new MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,roughness:.65}));mesh.scale.y=1.6;
  asset.scene.getObjectByName('gem_socket_'+name).add(mesh);return mesh;
 });
 const flame=new Mesh(new ConeGeometry(.28,1.5,12),new MeshBasicMaterial({color:0x9dd9e3}));
 // The socket's +Z follows the exhaust; cone tip points back toward the nozzle.
 flame.rotation.x=Math.PI/2;flame.position.z=.75;asset.scene.getObjectByName('engine_socket').add(flame);
 return {root:asset.scene,base,capsule,sockets,update(mission,collected){
  const launched=['countdown','cinematic'].includes(mission.phase),elapsed=launched?60-mission.countdown:0;
  capsule.position.y=restY+elapsed*elapsed*.8;capsule.visible=mission.phase!=='cinematic'&&elapsed<20;
  flame.visible=launched;sockets.forEach((mesh,i)=>{mesh.visible=launched||collected.some(g=>g.color===gems[i][1]&&g.collected);});
 },dispose(){asset.dispose();}};
}
