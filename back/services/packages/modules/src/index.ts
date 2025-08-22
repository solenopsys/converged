
import { ModulesService } from "../../../../../types/modules";

const remotePrefix="https://converged-modules.s3.us-east-2.amazonaws.com/front/"
const localPrefix="http://localhost:3005/modules/"

const localesPrefixes=["en","ru","de","fr","it","pt"]

const staticModules:any =[
    {
        "name":"panel",
        "remote": true,
        "protected": true,
        "layout": "SidebarLayout"
    },
    {
        "name":"dag", 
        "remote": false,
        "protected": true,
        "layout": "SidebarLayout"
    },
    {
        "name":"chats",
        "remote":true,
        "protected": true,
        "layout": "SidebarLayout"
    },
    {
        "name":"auth",
        "path":"/login",
        "remote":false,
        "protected": false,
        "layout": "SimpleLayout"
    }
    ,
    {
        "name":"mailing",
        "remote":false,
        "protected": false,
        "layout": "SidebarLayout"
    }

 
]

 

class ModulesServiceImpl implements ModulesService {

    constructor(config:any) {
      
    }

    
    list(): Promise<{
        name:string,
        path:string,
        link:string,
        protected:boolean,
        layout:string
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
            if(module.path===undefined){
                module.path="/"+module.name;
            }
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