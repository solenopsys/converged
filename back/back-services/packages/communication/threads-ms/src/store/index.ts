import { StoreControllerAbstract,Store } from "back-core";
import { StoreType } from "back-core";
import { ThreadsStoreService } from "./service";

export class StoresController extends StoreControllerAbstract{
    public readonly threads: ThreadsStoreService;


    constructor(protected msName:string){
        super(msName);
    
        const threads=this.addStore("threads", StoreType.KVS);
       
    }


}