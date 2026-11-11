import * as THREE from 'three';
import { SkyBackdrop } from './SkyBackdrop.js';
export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a76c51');
    this.scene.fog = new THREE.FogExp2('#a76c51', 0.0075);
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.15, 420);
    this.scene.add(new THREE.HemisphereLight(0xc4e5ed, 0x853b24, 1.5));
    this.sun = new THREE.DirectionalLight(0xffd6a0, 2.5);
    this.sun.position.set(-35, 65, -25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 180 });
    this.sun.shadow.bias = -0.0007;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    this.backdrop = new SkyBackdrop(this.scene);
    this.sky = this.backdrop.mesh;
    this.resize = () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.resize); this.resize();
  }
  quality(value) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, value === 'low' ? 1 : 1.5));
    this.renderer.shadowMap.enabled = value !== 'low';
    this.resize();
  }
  draw() { this.backdrop.update(this.camera); this.renderer.render(this.scene, this.camera); }
  dispose() { window.removeEventListener('resize', this.resize); this.renderer.setAnimationLoop(null); this.backdrop.dispose(); this.renderer.dispose(); }
}
