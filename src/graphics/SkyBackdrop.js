import * as THREE from 'three';

export class SkyBackdrop {
  constructor(scene) {
    this.mode = 'planet'; this.textures = {};
    this.geometry = new THREE.SphereGeometry(350, 64, 32);
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: {
        panorama: { value: null }, loaded: { value: false },
        spaceView: { value: false }, screenSize: { value: new THREE.Vector2(1, 1) }, imageAspect: { value: 2 },
        top: { value: new THREE.Color('#4d6264') }, bottom: { value: new THREE.Color('#b97755') },
      },
      vertexShader: `varying vec2 panoUv; varying vec3 direction;
        void main(){ panoUv=uv; direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D panorama; uniform bool loaded; uniform bool spaceView;
        uniform vec2 screenSize; uniform float imageAspect;
        uniform vec3 top; uniform vec3 bottom; varying vec2 panoUv; varying vec3 direction;
        void main(){
          vec3 color;
          if(loaded){
            vec2 uv=panoUv;
            // Preserve the universe image's detail and aspect ratio as a cinematic backdrop.
            if(spaceView){
              uv=gl_FragCoord.xy/screenSize;
              float aspect=screenSize.x/screenSize.y;
              if(aspect>imageAspect) uv.y=(uv.y-.5)*imageAspect/aspect+.5;
              else uv.x=(uv.x-.5)*aspect/imageAspect+.5;
            }
            color=texture2D(panorama,uv).rgb;
            // Blend the outer 2% so the generated panorama has no hard wrap seam.
            float edge=min(uv.x,1.0-uv.x);
            if(!spaceView && edge<.02){
              vec3 opposite=texture2D(panorama,vec2(1.0-uv.x,uv.y)).rgb;
              color=mix(color,(color+opposite)*.5,1.0-smoothstep(0.0,.02,edge));
            }
          }else{
            float h=clamp(normalize(direction).y*1.6,0.0,1.0);
            color=mix(bottom,top,pow(h,.65));
          }
          gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'panoramic-background'; this.mesh.renderOrder = -1000; this.mesh.frustumCulled = false;
    this.mesh.onBeforeRender = renderer => renderer.getDrawingBufferSize(this.material.uniforms.screenSize.value);
    scene.add(this.mesh);
    const loader = new THREE.TextureLoader();
    this.ready = Promise.all(Object.entries({ planet: 'planet-sky-v1.png', space: 'aurora-universe-v1.png' }).map(async ([mode, file]) => {
      try {
        const texture = await loader.loadAsync(import.meta.env.BASE_URL + 'textures/backgrounds/' + file);
        if (this.disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.name = mode + '-panorama';
        this.textures[mode] = texture;
        this.setMode(this.mode);
      } catch (error) { console.warn('No se pudo cargar el fondo ' + mode + '; se mantiene el degradado.', error); }
    }));
  }
  setMode(mode) {
    this.mode = mode;
    this.material.uniforms.panorama.value = this.textures[mode] || null;
    this.material.uniforms.loaded.value = !!this.textures[mode];
    this.material.uniforms.spaceView.value = mode === 'space';
    const image = this.textures[mode]?.image;
    this.material.uniforms.imageAspect.value = image ? image.width / image.height : 2;
    this.material.uniforms.top.value.set(mode === 'space' ? '#020714' : '#4d6264');
    this.material.uniforms.bottom.value.set(mode === 'space' ? '#071523' : '#b97755');
  }
  update(camera) {
    // Keep the sky infinitely distant even at Aurora's cinematic altitude.
    this.mesh.position.copy(camera.position);
  }
  dispose() {
    this.disposed = true;
    Object.values(this.textures).forEach(texture => texture.dispose());
    this.geometry.dispose(); this.material.dispose(); this.mesh.removeFromParent();
  }
}
