import { Box3, Group, Vector3 } from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
export async function loadAurora(parent) {
 const asset=await loadAnimatedModel(import.meta.env.BASE_URL+'models/spaceship_aurora.glb');
 const box=new Box3().setFromObject(asset.scene),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
 const scale=32/Math.max(size.x,size.y,size.z);
 const root=new Group();root.name='aurora-model';root.scale.setScalar(scale);
 asset.scene.position.sub(center);root.add(asset.scene);parent.add(root);
 asset.scene.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(m.roughness!==undefined)m.roughness=Math.max(.6,m.roughness);}}});
 return {root,radius:size.length()*scale/2,dispose(){asset.dispose();root.removeFromParent();}};
}
export function frameAurora(camera,center,radius,time) {
 const vertical=camera.fov*Math.PI/180,horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);
 const distance=radius/Math.sin(Math.min(vertical,horizontal)/2)*1.12;
 const angle=.75-Math.max(0,Math.min(9,time-15))*.018;
 camera.position.copy(center).add(new Vector3(Math.sin(angle),.43,Math.cos(angle)).normalize().multiplyScalar(distance));
 camera.lookAt(center);
}
