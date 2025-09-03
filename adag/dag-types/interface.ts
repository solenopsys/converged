export type Hash = Uint8Array[32];
export type HashString = string;
export type EntityType = "node" | "receipt" | "provider";

type Node = {
    id: number;
    name: string;
    current_version: Uint8Array;
}

export type Workflow = {
    nodes: { [name: string]:  HashString }; 
    links: { from: string, to: string }[]; 
    description?: string
}

export type NodeCode = {
    hash: Hash;
    body: Uint8Array;
    created_at: string;
}

export type CodeSource = {
    name: string;
    version: number;
    hash: HashString;
    fields: { name: string, type: string }[]
}

export interface PaginationParams {
    offset: number;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalCount?: number; // если хочешь знать общее число
}


export type { Node, NodeCode }

export type Base64 = {
    base64: string;
}

export interface DagService {
    status(): Promise<{ status: string }>

    setCodeSource(name: string, code: string): Promise<CodeSource>
    getCodeSourceVersions(name: string): Promise<{ versions: CodeSource[] }>
    createNode(codeSourceName: string, config: any): Promise<{ hash: HashString }>
    createProvider(name: string, codeSourceName: string, config: any): Promise<{ hash: HashString }>

    createWorkflow(name:string,workflow: Workflow): Promise<{ hash: HashString }>
    getWorkflowConfig(hash: HashString): Promise<Workflow>
    getWorkflowVersions(name: string): Promise<{ versions: string[] }>
    getWorkflowConfigByName(name: string,version: string): Promise<Workflow> ;
    getNode(hash: HashString): Promise<{ config: any }>

    codeSourceList(): Promise<{ names: string[] }>
    nodeList(): Promise<{ names: string[] }>
    providerList(): Promise<{ names: string[] }>
    workflowList(): Promise<{ names: string[] }> 

    runCode(hash: HashString, params: any): Promise<{ result: any }>

    run(pid: string,workflow: HashString,command: string, params?: any): AsyncIterable<{ result: any }>

    setParam(name: string, value: any): Promise<{ replaced: boolean }>
    getParam(name: string): Promise<{ value: any }>

    startProcess(workflowId?: string, meta?: any): Promise<{ processId: string }>
    createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<{ version: number }>
}