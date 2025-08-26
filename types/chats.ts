
export interface ChatsService {
   
    list(): Promise<
    {
        id:string,
       date:string
    }[]>
 
}


