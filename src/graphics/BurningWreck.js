import * as THREE from 'three';
import { loadAnimatedModel } from './AssetLoader.js';
import { Random } from '../utils/Random.js';

function particles(kind, count, random) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['size', 1], ['fade', 1]]) {
    geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage));
  }
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pointScale: { value: 600 }, kind: { value: kind } },
    vertexShader: `attribute float size; attribute float fade; uniform float pointScale; varying float alpha;
      void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); alpha=fade;
        gl_PointSize=clamp(size*pointScale/max(.1,-p.z),1.0,180.0); gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform float kind; varying float alpha;
      void main(){ vec2 p=gl_PointCoord*2.0-1.0;
        if(kind==1.0) p.x*=1.5;
        float r=length(p); if(r>1.0) discard;
        float soft=pow(1.0-r,kind==0.0?1.3:.8);
        vec3 color=kind==0.0?vec3(.055,.052,.048):mix(vec3(.8,.055,.004),vec3(1.0,.48,.045),soft);
        gl_FragColor=vec4(color,alpha*soft);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Points(geometry, material); mesh.frustumCulled = false;
  mesh.name = ['wreck-smoke', 'wreck-fire', 'wreck-embers'][kind];
  const drawingSize = new THREE.Vector2();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    material.uniforms.pointScale.value = renderer.getDrawingBufferSize(drawingSize).y / (2 * Math.tan(camera.fov * Math.PI / 360));
  };
  const seeds = Array.from({ length: count }, (_, i) => ({
    emitter: i % 3, phase: random.next(), x: random.range(-.6, .6), z: random.range(-.6, .6), speed: random.range(.8, 1.2),
  }));
  return { mesh, seeds, geometry, material, kind };
}

export async function loadBurningWreck(parent, site, heightAt, seed) {
  const asset = await loadAnimatedModel(import.meta.env.BASE_URL + 'models/spaceship_aurora.glb');
  const root = new THREE.Group(); root.name = 'aurora-wreck';
  const pose = new THREE.Group(); root.add(pose);
  const bounds = new THREE.Box3().setFromObject(asset.scene), size = bounds.getSize(new THREE.Vector3());
  asset.scene.position.sub(bounds.getCenter(new THREE.Vector3()));
  const scale = 18 / Math.max(size.x, size.y, size.z);
  pose.scale.setScalar(scale); pose.rotation.set(.09, Math.PI / 2, -.2); pose.add(asset.scene);
  root.position.set(site.x, 0, site.z - 6);
  root.updateMatrixWorld(true);
  // Embed the keel slightly in the terrain rather than leaving the hull suspended.
  const tilted = new THREE.Box3().setFromObject(root);
  let ground = -Infinity;
  for (let x = -7; x <= 7; x += 3.5) ground = Math.max(ground, heightAt(site.x + x, site.z - 6));
  root.position.y = ground - tilted.min.y - .65;
  asset.scene.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.color?.multiplyScalar(.62);
      if (material.roughness !== undefined) material.roughness = .93;
      if (material.emissiveIntensity !== undefined) material.emissiveIntensity *= .15;
    }
  });
  parent.add(root); root.updateMatrixWorld(true);
  // Attachment positions use the normalized hull coordinates, then follow its crash tilt.
  const emitters = [[-1.7, 1.3, -5.8], [1.8, 1.1, -4.2], [.3, 1.7, 1.1]].map(p =>
    new THREE.Vector3(...p).divideScalar(scale).applyMatrix4(pose.matrix).clone());
  const random = new Random(`${seed}-wreck-fire`);
  const batches = [particles(0, 30, random), particles(1, 36, random), particles(2, 24, random)];
  for (const batch of batches) root.add(batch.mesh);
  const lights = emitters.slice(0, 2).map(position => {
    const light = new THREE.PointLight(0xff8036, 4, 9, 2); light.position.copy(position); root.add(light); return light;
  });
  return {
    root, batches, lights,
    update(time) {
      for (const { geometry, seeds, kind } of batches) {
        const positions = geometry.getAttribute('position'), sizes = geometry.getAttribute('size'), fades = geometry.getAttribute('fade');
        const duration = [6, 1.3, 2.5][kind];
        seeds.forEach((s, i) => {
          const age = (time / duration * s.speed + s.phase) % 1, source = emitters[s.emitter];
          const rise = age * [9, 2.4, 5][kind];
          positions.setXYZ(i, source.x + s.x + age * (kind === 0 ? 2 : .5) + Math.sin(time * 1.5 + i) * age * .3,
            source.y + rise, source.z + s.z + age * .7);
          sizes.setX(i, kind === 0 ? 1.4 + age * 4 : kind === 1 ? 1.5 * (1 - age) + .15 : .055 * (1 - age) + .02);
          fades.setX(i, Math.sin(Math.PI * age) * (kind === 0 ? .5 : .85));
        });
        positions.needsUpdate = sizes.needsUpdate = fades.needsUpdate = true;
      }
      lights.forEach((light, i) => { light.intensity = 3.5 + Math.sin(time * 9 + i) * .5 + Math.sin(time * 17) * .3; });
    },
    dispose() {
      asset.dispose();
      batches.forEach(b => { b.geometry.dispose(); b.material.dispose(); });
      lights.forEach(light => light.dispose()); root.removeFromParent();
    },
  };
}
