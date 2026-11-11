import fs from 'node:fs';
import { AnimationMixer, LoopOnce, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const path=new URL('./amethyst.glb',import.meta.url),b=fs.readFileSync(path),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n));
// Geometry and transforms only: material image decoding is unnecessary in this offline sampler.
for(const m of j.meshes)for(const p of m.primitives)delete p.material;
delete j.materials;delete j.textures;delete j.images;
const json=Buffer.from(JSON.stringify(j)),padding=(4-json.length%4)%4,jbytes=Buffer.concat([json,Buffer.alloc(padding,32)]),bin=b.subarray(20+n),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+jbytes.length+bin.length,8);header.writeUInt32LE(jbytes.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bytes=Buffer.concat([header,jbytes,bin]);
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
const mixer=new AnimationMixer(asset.scene),a=mixer.clipAction(asset.animations.find(c=>c.name==='attack_special'));a.setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(1);asset.scene.updateMatrixWorld(true);
const p=asset.scene.getObjectByName('muzzle_socket').getWorldPosition(new Vector3());
fs.writeFileSync(new URL('../../src/data/amethystMuzzle.json',import.meta.url),JSON.stringify({frame:30,fps:30,position:p.toArray()},null,2)+'\n');console.log(p.toArray());
