import type { AspectFunction } from "../aspect-types";

const injectAspect: AspectFunction=(ctx:any,aspectParams:{[name:string]:string}) => {
    const params={}
 
    return {
        next:true,
        params
    }   
}

export { injectAspect }
