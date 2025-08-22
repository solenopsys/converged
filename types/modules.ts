
export interface ModulesService {
     list(): Promise<
     {
        name:string,
        path:string,
        link:string,
        protected:boolean,
        layout:string
     }[]>
     add(name:string ): Promise<void>
     remove(name:string ): Promise<void>
}


 