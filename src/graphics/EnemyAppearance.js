// Enemy-only grading: soften highlights and preserve each gem's recognizable hue.
// Materials shared by cloned enemies are adjusted once, never once per instance.
const adjusted = new WeakSet();
export function softenEnemyMaterials(root) {
  root.traverse(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material || adjusted.has(material)) continue;
      adjusted.add(material);
      if (material.roughness !== undefined) material.roughness = Math.max(.65, material.roughness);
      if (material.emissiveIntensity !== undefined) material.emissiveIntensity *= .5;
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = function(shader, renderer) {
        previous.call(this, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', `
          float enemyLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor.rgb = mix(vec3(enemyLuma), gl_FragColor.rgb, 0.65);
          gl_FragColor.rgb = (gl_FragColor.rgb * 0.82 + vec3(0.018)) * 0.85;
          #include <tonemapping_fragment>
        `);
      };
      material.customProgramCacheKey = () => 'enemy-soft-v1';
      material.needsUpdate = true;
    }
  });
}
