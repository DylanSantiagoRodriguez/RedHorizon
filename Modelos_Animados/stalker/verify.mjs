import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url);
function load(path){const b=fs.readFileSync(path),n=b.readUInt32LE(12);return {j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const {j,bin}=load(new URL('stalker.glb',dir));
const source=load('C:/Users/macab/Downloads/studio-model.glb').j;
function values(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],d={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type];assert.equal(a.componentType,5126);return Array.from({length:a.count},(_,k)=>Array.from({length:d},(_,c)=>bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||d*4)+c*4)));}
const expected=['idle','move','attack_melee','death','reference_pose'];assert.deepEqual(j.animations.map(a=>a.name),expected);
assert.deepEqual(j.skins[0].joints.map(i=>j.nodes[i].name).sort(),source.skins[0].joints.map(i=>source.nodes[i].name).sort());
assert.equal(j.meshes.length,1);assert(j.images.length>0);assert(j.images.every(i=>i.bufferView!==undefined));assert(!j.cameras?.length);assert(!j.extensions?.KHR_lights_punctual);
const summary=[];
for(const a of j.animations){let duration=0,loopError=0,rootError=0,stableError=0;
 for(const c of a.channels){const s=a.samplers[c.sampler],t=values(s.input).flat(),v=values(s.output);assert(v.flat().every(Number.isFinite));duration=Math.max(duration,t.at(-1));
 if(['idle','move'].includes(a.name))for(let k=0;k<v[0].length;k++)loopError=Math.max(loopError,Math.abs(v[0][k]-v.at(-1)[k]));
 if(j.nodes[c.target.node].name==='root')for(const x of v)for(let k=0;k<x.length;k++)rootError=Math.max(rootError,Math.abs(x[k]-v[0][k]));
 if(a.name==='death')for(let i=0;i<t.length;i++)if(t[i]>=1.7)for(let k=0;k<v[i].length;k++)stableError=Math.max(stableError,Math.abs(v[i][k]-v.at(-1)[k]));
 }
 assert(loopError<1e-5);assert(rootError<1e-5);assert(stableError<1e-5);summary.push({name:a.name,duration,loopError,rootError,stableError});
}
fs.writeFileSync(new URL('verification.json',dir),JSON.stringify({passed:true,bones:j.skins[0].joints.length,embeddedTextures:j.images.length,clips:summary},null,2));console.log(summary);
