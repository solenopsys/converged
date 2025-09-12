
import { ModulesService } from "../../../../../types/modules";

const remotePrefix="https://converged-modules.s3.us-east-2.amazonaws.com/front/"
const localPrefix="http://localhost:3005/modules/"

const localesPrefixes=["en","ru","de","fr","it","pt"]

const staticModules:any =[
    // {
    //     "name":"orders",
    //     "remote": true,
    //     "protected": true,
    //     "layout": "SidebarLayout"
    // },
    {
        "name":"dag-mf", 
        "remote": false,
        "protected": true
    },
    {
        "name":"chats-mf",
        "remote":false,
        "protected": false,
    },
    {
        "name":"auth-mf",
        "remote":false,
        "protected": false,
    },
    {
        "name":"layouts-mf",
        "remote":false,
        "protected": false,
    }
    ,
    {
        "name":"mailing-mf",
        "remote":false,
        "protected": false,
    }

 
]

 

class ModulesServiceImpl implements ModulesService {

    constructor(config:any) {
      
    }

    
    list(): Promise<{
        name:string, 
        link:string,
        protected:boolean
        locales:{[key:string]:string}
    }[]> {
        const modules= staticModules.map((module)=>{
            if(module.remote){
                module.link=remotePrefix+module.name+".js"
            }else{
                module.link=localPrefix+module.name+".js"
            }

            const locales={}

            for (const locale of localesPrefixes) {
                locales[locale]=(module.remote?remotePrefix:localPrefix)+"locale/" +module.name+"/"+locale+".json"
            }

            delete module.remote;

           
            module.locales=locales;
             
            return module;
        })
        return Promise.resolve(modules)
    }
    add(name:string ): Promise<void> {
        return Promise.resolve()
    }

    remove(name:string): Promise<void> {
        return Promise.resolve()
    }
     
}

export default ModulesServiceImpl;