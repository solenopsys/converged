import { createHash } from "node:crypto";

export function generateHash(content: ArrayBuffer | Uint8Array): string { 
    const data = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
    
    return createHash("sha256").update(data).digest("hex");
}