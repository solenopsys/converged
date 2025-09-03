import { injectAspect } from "./implements/io";    
import { ifAspect } from "./implements/filter";
import { constAspect } from "./implements/const";

const Aspects={
    input:ioAspect,
    output:ioAspect,
    if:ifAspect,
    const:constAspect,
}
    
export { Aspects }