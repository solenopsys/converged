import { InjectAspect } from "./implements/inject"
import { CopyResultAspect } from "./implements/result"
import { ConstAspect } from "./implements/const"
import { InitLambdaAspect } from "./implements/init-lambda"
import {   AspectBase } from "./abstract"



const AspectsMapping:{[key:string]: new (...args: any[]) => AspectBase  }={
    "inputs":InjectAspect,
    "consts":ConstAspect,
    "init":InitLambdaAspect,
    "output":CopyResultAspect,
}
    
export { AspectsMapping }