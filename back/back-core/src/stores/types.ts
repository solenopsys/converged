
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
    VECTOR = "VECTOR",
    GRAPH = "GRAPH",
}

export interface StoreSizeInfo {
  msName: string;
  store: string;
  key: string;
  sizeBytes: bigint;
}


export const DATA_DIR = process.env.DATA_DIR || "./data"
