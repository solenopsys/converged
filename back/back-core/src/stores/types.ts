
export interface Store extends Migrate{
    open(): Promise<void>;
    close(): Promise<void>;
   
}

export interface Migrate {
    migrate(): Promise<void>;
}






export enum StoreType {
    SQL = "SQL",
    FILES = "FILES",
    JSON = "JSON",
    COLUMN = "COLUMN",
    KVS = "KEY_VALUE",
}



export const DATA_DIR = "./data"




