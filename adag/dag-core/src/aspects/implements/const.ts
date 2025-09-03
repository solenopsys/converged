import type { AspectFunction } from "../aspect-types";

const constAspect: AspectFunction=(ctx:any,aspectParams:{[name:string]:string}) => {
    return {
        next:true,
        params:aspectParams
    }   
}

export { constAspect }
