import {type   Provider,ProvidersStore } from "./types";
import { ModuleController } from "../loader";
 

let PROVIDERS_POOL:ProvidersPool|undefined=undefined;


export class ProvidersPool {
    private providers = new Map<string, Provider>();
    private codeController:ModuleController;
  
    constructor(private factories: ProvidersStore,private tempDir:string) {
        this.codeController=new ModuleController(this.tempDir);
    }
  
    /** Получить или создать провайдер */
    async getOrCreate(name: string ): Promise<Provider> {
      if(this.providers.has(name)){
        return this.providers.get(name)!;
      }

      const {hash,code,config} = await this.factories.getProvider(name);

      const module = await this.codeController.loadAndGetModule(hash, code);
      const ProviderClass = module.default;

      const values=Object.values(config)
  
      const provider:Provider  = Reflect.construct(ProviderClass, values);
    
      await provider.start();
      this.providers.set(name, provider);
      return provider;
    }
  
    async remove(name: string) {
      const provider = this.providers.get(name);
      if (provider) {
        await provider.stop();
        this.providers.delete(name);
      }
    }
  
    async shutdownAll() {
      for (const [name, provider] of this.providers) {
        await provider.stop();
      }
      this.providers.clear();
    }
  }

  export function initProvidersPool(store: ProvidersStore,tempDir:string) {
    PROVIDERS_POOL=new ProvidersPool(store,tempDir);

  }

  export function getProvidersPool():ProvidersPool {
    if(PROVIDERS_POOL==undefined){
      throw new Error("ProvidersPool is not initialized");
    }
    return PROVIDERS_POOL;
  }