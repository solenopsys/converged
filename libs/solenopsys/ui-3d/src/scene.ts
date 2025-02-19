import * as THREE from "three";
import { OrbitControls,RGBELoader } from "./helpers";

const light1 = new THREE.SpotLight(0xffffff, 1);
light1.position.set(-600, 1200, 1200);

const light2 = new THREE.SpotLight(0x02ffff, 1);
light2.position.set(800, -1500, 1100);

const ambientLight = new THREE.AmbientLight(0xffffff, 1); // soft white light
const hemiLight = new THREE.HemisphereLight(0x0000ff, 0x00ff00, 0.6);

export class BasicSceneConfig {
    public readonly scene: THREE.Scene;
    private camera: THREE.Camera;
    public renderer: THREE.WebGLRenderer;
    
    constructor() {
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 70;
        this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        this.renderer.setSize(500, 500);
        this.renderer.outputEncoding = THREE.sRGBEncoding; //улучшает качество
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;


        this.scene = new THREE.Scene();
        // this.scene.add(ambientLight);//
        this.scene.add(light1);
        this.scene.add(light2);
        this.scene.add(hemiLight);
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
    }

   public  loadTexture(textureUrl: string) {
    let loader = new THREE.PMREMGenerator(this.renderer);
        new RGBELoader().load(textureUrl, (hdrmap: any) => {
            const webGLRenderTarget = loader.fromCubemap(hdrmap);
            this.envMap = webGLRenderTarget.texture;
        });
    }

   public render() {
        this.renderer.render(this.scene, this.camera);
    }
}


