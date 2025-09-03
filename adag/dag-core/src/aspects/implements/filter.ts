
import type { AspectFunction } from "../aspect-types";


const ifAspect: AspectFunction=(ctx:any,aspectParams:{[name:string]:string}) => {
    let next=true;
    if(aspectParams.value){
        next=false;
    }
    return {
        next,
        params:{}
    }   
}

export { ifAspect }
