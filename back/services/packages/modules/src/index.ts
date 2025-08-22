
import { ModulesService } from "../../../../../types/modules";

const staticModules =[
    {
        "name":"panel",
        "path": "/panel",
        "link": "https://converged-modules.s3.us-east-2.amazonaws.com/front/panel.js",
        "protected": true,
        "layout": "SidebarLayout"
    },
    {
        "name":"dag",
        "path": "/dag",
        "link": "http://localhost:3005/modules/dag.js",
        "protected": true,
        "layout": "SidebarLayout"
    },
    {
        "name":"chats",
        "path": "/chats",
        "link": "https://converged-modules.s3.us-east-2.amazonaws.com/front/chats.js",
        "protected": true,
        "layout": "SidebarLayout"
    },
    {
        "name":"auth",
        "path": "/login",
        "link": "http://localhost:3005/modules/auth.js",
        "protected": false,
        "layout": "SimpleLayout"
    }
    ,
    {
        "name":"mailing",
        "path": "/mailing",
        "link": "http://localhost:3005/modules/mailing.js",
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
        return Promise.resolve(staticModules)
    }
    add(name:string ): Promise<void> {
        return Promise.resolve()
    }

    remove(name:string): Promise<void> {
        return Promise.resolve()
    }
     
}

export default ModulesServiceImpl;