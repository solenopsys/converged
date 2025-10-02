

import { StoreControllerAbstract, StoreType } from "./abstract/types";
import { ExecutionService } from "./execution/service";
import { SchemeService } from "./scheme/service";


class StoresController extends StoreControllerAbstract{
    public readonly execution: ExecutionService;
    public readonly scheme: SchemeService;


    constructor(private msName:string){
        super(msName);
    
        const execution=this.addStore("executions", StoreType.KVS);
        new ExecutionService(execution);
        const scheme=this.addStore("scheme", StoreType.KVS);
        new SchemeService(scheme);
    }


}