import {JSONPath} from "jsonpath-plus"
import { ContextAccessor } from "../../store/processing.store";
 

import { ExecutionContext } from "./abstract";

function evaluateJsonPath(data: any, jsonPath: string): any {
    console.log("EVALUATE ", data, jsonPath);
    if (!jsonPath) return "";

    try {
        const result = JSONPath({ path: jsonPath, json: data });
        const value = Array.isArray(result) ? result[0] : result;
        const ret=value !== undefined ? value : null
        console.log("RESULT EVALUATE",ret)
        return ret;
    } catch (error) {
        return null;
    }
}

function evaluateJsonPathString(data: any, jsonPath: string): string {
    return evaluateJsonPath(data, jsonPath).toString() ?? "";
}

export class StoreExecutionContext implements ExecutionContext {
    context:any;
    constructor(private accessor: ContextAccessor,private contextKey:string) {
        this.context = this.accessor.getContext(this.contextKey);
    }
    
    getFromPath(path: string): any { 
        console.log("GET FROM PATH", path,this.context);
        return evaluateJsonPath(this.context, path);
    }
    
    setToPath(path: string, value: any): void {
        if(path.indexOf(".")>0){
            throw new Error("Only simple paths are supported");
            // todo support complex paths
        }
        this.accessor.addDataToContext(this.contextKey, path, value);
    }
}

// Реализация ExecutionContext с JSONPath
export class JsonPathExecutionContext implements ExecutionContext {
    constructor(private data: any) {}
    
    getFromPath(path: string): any {
        console.log("GET FROM PATH", path,this.data);
        return evaluateJsonPath(this.data, path);
    }
    
    setToPath(path: string, value: any): void {
        console.log("SET TO PATH", path, value);
        const normalizedPath = path.replace(/^\$\./, '');
        const parts = normalizedPath.split('.');
        
        let current = this.data;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[parts[parts.length - 1]] = value;

    }
}


class Semaphore {
    private permits: number;
    private waiting: (() => void)[] = [];
    
    constructor(permits: number) {
        this.permits = permits;
    }
    
    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        
        return new Promise(resolve => {
            this.waiting.push(resolve);
        });
    }
    
    release(): void {
        this.permits++;
        const next = this.waiting.shift();
        if (next) {
            this.permits--;
            next();
        }
    }
}

export {Semaphore}
