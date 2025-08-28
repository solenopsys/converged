export type Hash = Uint8Array[32];
export type HashString = string;
export type EntityType = "node" | "receipt" | "provider";

type Node = {
    id: number;
    name: string;
    current_version: Uint8Array;
}

type NodeCode = {
    hash: Hash;
    body: Uint8Array;
    created_at: string;
}

type CodeSource = {
    name: string; 
    version: number; 
    hash: HashString; 
    fields: { name: string, type: string }[]
}

export type { Node, NodeCode }

export type Base64 = {
    base64: string;
}

export interface DagService {
    status(): Promise<{ status: string }>

    setCodeSource(name: string, code: string): Promise<CodeSource>
    createNode(codeSourceName: string, config: any): Promise<{ hash: HashString }>
    createProvider(name: string, codeSourceName: string, config: any): Promise<{ hash: HashString }>

    // Методы для workflow
    createWorkflow(name: string, nodes: HashString[], links: { from: string, to: string }[], description?: string): Promise<{ hash: HashString }>

    codeSourceList(): Promise<{ names: string[] }>
    providerList(): Promise<{ names: string[] }>
    workflowList(): Promise<{ names: string[] }>
    // todo : AsyncIterable<StatusEvent | Disconnect>

    runCode(hash: HashString, params: any): Promise<{ result: any }>

    setParam(name: string, value: any): Promise<{ replaced: boolean }>
    getParam(name: string): Promise<{ value: any }>

    // Методы для процессов
    startProcess(workflowId?: string, meta?: any): Promise<{ processId: string }>


    // Методы для webhook
    createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<{ version: number }>
}