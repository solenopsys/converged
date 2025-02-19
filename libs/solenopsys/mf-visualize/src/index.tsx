import {View3D} from "@solenopsys/ui-3d";

export const Visual=(conf:any)=>{
    console.log("VUSUAL OK",conf)
    return (<div style="padding:100px;" >Visualize
    <View3D modelUrl={conf.file} textureUrl={conf.texture}></View3D></div>)
}

