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

export type { Node, NodeCode }

export type Base64 = {
    base64: string;
}

export interface DagService {
    status(): Promise<{ status: string }>
    setCode(name: string, code: string): Promise<{ name: string, version: number, hash: HashString, fields: { name: string, type: string }[] }>
    codeList(): Promise<{ names: string[] }>
    createNode(nodeCode: string, config: any): Promise<{ hash: HashString }>
    runCode(hash: HashString, params: any): Promise<{ result: any }>
    
    // Методы для процессов
    startProcess(workflowId?: string, meta?: any): Promise<{ processId: string }>
    
    // Методы для workflow
    createWorkflow(name: string, nodes: HashString[], links: { from: string, to: string }[], description?: string): Promise<{ hash: HashString }>
    
    // Методы для webhook
    createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<{ version: number }>
}