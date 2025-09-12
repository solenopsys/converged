
export interface ModulesService {
     list(): Promise<
     {
        name:string,
        link:string,
        protected:boolean,
        locales:{[key:string]:string},
     }[]>
     add(name:string ): Promise<void>
     remove(name:string ): Promise<void>
}


 