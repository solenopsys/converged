
import {CubeTextureLoader} from "three";
import { STLLoader,ThreeMFLoader } from "./helpers";

import * as THREE from "three";


const TestMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb2ffc8,
    metalness: 0.25,
    roughness: 0.1,
    transparent: false,
    transmission: 0.99,
    clearcoat: 1.0,
    clearcoatRoughness: 0.25
});
const textureCube = new CubeTextureLoader();
const TestMaterialGreen = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0.25,
    roughness: 0.5,
    clearcoatRoughness: 0.25,
    transmission: 0.01
});
 const TestMaterialRed = new THREE.MeshPhysicalMaterial({color: 0xFF0000, vertexColors: false});

 export function loadStl(fileUrl: string,scene:THREE.Scene) {
    const loader = new STLLoader();
    loader.load(
        fileUrl,
        (geometry) => {
            let cube = new THREE.Mesh(geometry, TestMaterialRed);
            cube.position.z = 1;
            scene.add(cube);
        });
}

export function load3MF(fileUrl: string,scene:THREE.Scene) {
    const loader = new ThreeMFLoader();
    loader.load(
        fileUrl,
        (object) => {
            //  object.quaternion.setFromEuler( new THREE.Euler( - Math.PI / 2, 0, 0 ) ); 	// z-up conversion


            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    console.log("MAT", child.name);
                    console.log("MAT", child.material);
                    console.log("MAT", child.material.uuid);
                    //child.material.color={isColor: true, r: 221, g: 1, b: 1}
                    //  child.material = TestMaterialRed.clone();
                    // console.log("MAT",child)
                    //    child.castShadow = true;
                    if (child.name == "body68314") {
                        child.material.color = new THREE.Color(0, 1, 0);

                    } else if (child.name == "body67351") {
                        child.material.color = new THREE.Color(0, 0, 1);
                    } else if (child.name == "body68855") {
                        child.material = new THREE.MeshStandardMaterial({
                            metalness: 1,
                            roughness: 0.5,
                            //  envMap :  this.envMap
                        });
                    } else {
                        child.material.color = new THREE.Color(0.3, 0, 0);

                        //    child.material.envMap =  this.envMap
                    }


                }
                //

            });
            object.position.z = 1;
            // main.children[1].traverse( function (child ) {
            //   if ( child instanceof THREE.Mesh ) {
            //     child.material = TestMaterialRed;
            //   }
            // } );

            scene.add(object);
        });
}