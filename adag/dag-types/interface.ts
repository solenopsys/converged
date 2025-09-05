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
    version: string;
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

    // source
    setCodeSource(name: string, code: string): Promise<CodeSource>
    getCodeSourceVersions(name: string): Promise<{ versions: CodeSource[] }>
    codeSourceList(): Promise<{ names: string[] }>

    // nodes
    createNode(nodeName: string, hash: HashString): Promise<{ key: string }>
    createNodeConfig(codeSourceName: string, config: any): Promise<{ hash: HashString }>
    getNode(hash: HashString): Promise<{ config: any }>
    nodeList(): Promise<{ names: string[] }>

    // workflows
    createWorkflow(name:string,workflow: Workflow): Promise<{ hash: HashString }>
    getWorkflowConfig(hash: HashString): Promise<Workflow>
    getWorkflowVersions(name: string): Promise<{ versions: string[] }>
    getWorkflowConfigByName(name: string,version: string): Promise<Workflow> ;
    workflowList(): Promise<{ names: string[] }> 

    // providers
    createProvider(name: string, codeSourceName: string, config: any): Promise<{ hash: HashString }>
    providerList(): Promise<{ names: string[] }>

    // run
    runLambda(name: string, params: any): Promise<{ result: any }>
    runCode(hash: HashString, params: any): Promise<{ result: any }>
    run(pid: string,workflow: HashString,command: string, params?: any): AsyncIterable<{ result: any }>

    // params
    setParam(name: string, value: any): Promise<{ replaced: boolean }>
    getParam(name: string): Promise<{ value: any }>
    paramsList(): Promise<{ params: {[name:string]: string} }>

    startProcess(workflowId?: string, meta?: any): Promise<{ processId: string }>
    createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<{ version: number }>
}