
export interface Store { 
    open(): Promise<void>;
    close(): Promise<void>;
    migrate(): Promise<void>;
}
